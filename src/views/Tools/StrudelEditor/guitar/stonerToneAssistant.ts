import { isRecordModule } from '../strudelModules'
import {
  STONER_GUITAR_ASSISTANT_ERRORS,
  STONER_GUITAR_ASSISTANT_SYSTEM_PROMPT,
  STONER_GUITAR_DEFAULT_MODEL,
  STONER_GUITAR_MODEL_OPTIONS,
  STONER_GUITAR_OPENROUTER_URL,
  STONER_GUITAR_TONE_JSON_SCHEMA
} from './config'
import type { StonerGuitarTone, StonerToneRequestOptions, StonerToneSuggestion } from './types'

/**
 * The model the dropdown should show. A model saved before the list changed, or typed in by an
 * older version of the tab, falls back to the default so the dropdown never shows a blank choice.
 * @param storedModel - the model id kept in local storage, if any
 * @returns a model id from the dropdown's options
 */
export const readKnownStonerToneModel = (storedModel: string | null): string =>
  storedModel !== null && STONER_GUITAR_MODEL_OPTIONS.some(({ value }) => value === storedModel)
    ? storedModel
    : STONER_GUITAR_DEFAULT_MODEL

const clampToUnit = (value: number): number => Math.min(1, Math.max(0, value))

const readKnob = (parsed: Record<string, unknown>, knobName: keyof StonerGuitarTone): number => {
  const value = parsed[knobName]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(STONER_GUITAR_ASSISTANT_ERRORS.badAnswer)
  }
  return clampToUnit(value)
}

const readMessageContent = (responseBody: unknown): string => {
  const firstChoice =
    isRecordModule(responseBody) && Array.isArray(responseBody.choices)
      ? responseBody.choices[0]
      : undefined
  const message = isRecordModule(firstChoice) ? firstChoice.message : undefined
  const content = isRecordModule(message) ? message.content : undefined
  if (typeof content !== 'string') {
    throw new Error(STONER_GUITAR_ASSISTANT_ERRORS.badAnswer)
  }
  return content
}

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(STONER_GUITAR_ASSISTANT_ERRORS.badAnswer)
  }
}

/**
 * The chat completion body that asks the model for tone settings as strict JSON.
 * @param options - the wanted sound in words, the knobs as they are now and the model id
 * @returns the request body to post to OpenRouter
 */
export const buildStonerToneRequest = ({
  description,
  currentTone,
  model
}: StonerToneRequestOptions): Record<string, unknown> => ({
  model,
  messages: [
    { role: 'system', content: STONER_GUITAR_ASSISTANT_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Current knobs: ${JSON.stringify(currentTone)}\nWanted sound: ${description}`
    }
  ],
  response_format: {
    type: 'json_schema',
    json_schema: {
      name: 'stoner_guitar_tone',
      strict: true,
      schema: STONER_GUITAR_TONE_JSON_SCHEMA
    }
  }
})

/**
 * Reads the five knobs from a parsed object, clamping each to 0 to 1.
 * @param parsed - an object with a number under each knob name
 * @returns the knobs
 * @throws {Error} a readable error when a knob is missing or not a number
 */
export const parseToneKnobs = (parsed: Record<string, unknown>): StonerGuitarTone => ({
  drive: readKnob(parsed, 'drive'),
  tone: readKnob(parsed, 'tone'),
  bass: readKnob(parsed, 'bass'),
  mids: readKnob(parsed, 'mids'),
  sustain: readKnob(parsed, 'sustain')
})

/**
 * Reads the model's answer, checking every field and clamping each knob to 0 to 1.
 * @param responseBody - the parsed OpenRouter response
 * @returns the five knobs and the model's explanation
 * @throws {Error} a readable error when the answer is missing a field or is not JSON
 */
export const parseStonerToneResponse = (responseBody: unknown): StonerToneSuggestion => {
  const parsed = parseJson(readMessageContent(responseBody))
  if (!isRecordModule(parsed)) {
    throw new Error(STONER_GUITAR_ASSISTANT_ERRORS.badAnswer)
  }
  return {
    tone: parseToneKnobs(parsed),
    explanation: typeof parsed.explanation === 'string' ? parsed.explanation : ''
  }
}

const readStatusMessage = (status: number): string => {
  if (status === 401 || status === 403) {
    return STONER_GUITAR_ASSISTANT_ERRORS.unauthorised
  }
  if (status === 402) {
    return STONER_GUITAR_ASSISTANT_ERRORS.noCredit
  }
  if (status === 429) {
    return STONER_GUITAR_ASSISTANT_ERRORS.rateLimited
  }
  return `${STONER_GUITAR_ASSISTANT_ERRORS.other} (${status}).`
}

/**
 * Asks OpenRouter for tone settings. The key goes only in the Authorization header of this one
 * request to OpenRouter.
 * @param options - the request options plus the user's own key and, for tests, a fetch
 * @returns the suggested knobs and explanation
 * @throws {Error} a readable error for a refused key, no credit, a network failure or a bad answer
 */
export const askStonerToneAssistant = async (
  options: StonerToneRequestOptions & { apiKey: string; fetchImplementation?: typeof fetch }
): Promise<StonerToneSuggestion> => {
  const { apiKey, fetchImplementation = fetch } = options
  const response = await fetchImplementation(STONER_GUITAR_OPENROUTER_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(buildStonerToneRequest(options))
  }).catch(() => {
    throw new Error(STONER_GUITAR_ASSISTANT_ERRORS.network)
  })
  if (!response.ok) {
    throw new Error(readStatusMessage(response.status))
  }
  return parseStonerToneResponse(await response.json().catch(() => null))
}
