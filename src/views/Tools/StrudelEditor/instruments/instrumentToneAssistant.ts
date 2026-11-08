import { isRecordModule } from '../strudelModules'
import {
  INSTRUMENT_ASSISTANT_ERRORS,
  INSTRUMENT_DEFAULT_MODEL,
  INSTRUMENT_KINDS,
  INSTRUMENT_MODEL_OPTIONS,
  INSTRUMENT_OPENROUTER_URL
} from './config'
import type {
  InstrumentKind,
  InstrumentKnobs,
  InstrumentToneRequestOptions,
  InstrumentToneSuggestion
} from './types'

/**
 * The model the dropdown should show. A model saved before the list changed falls back to the
 * default so the dropdown never shows a blank choice.
 * @param storedModel - the model id kept in local storage, if any
 * @returns a model id from the dropdown's options
 */
export const readKnownInstrumentToneModel = (storedModel: string | null): string =>
  storedModel !== null && INSTRUMENT_MODEL_OPTIONS.some(({ value }) => value === storedModel)
    ? storedModel
    : INSTRUMENT_DEFAULT_MODEL

/**
 * The strict JSON schema a kind's answer must match: its own knobs plus an explanation.
 * @param kind - the kind of instrument
 * @returns a JSON schema object
 */
export const buildInstrumentToneSchema = (kind: InstrumentKind): Record<string, unknown> => {
  const knobIds = INSTRUMENT_KINDS[kind].knobs.map(({ id }) => id)
  return {
    type: 'object',
    properties: {
      ...Object.fromEntries(knobIds.map((id) => [id, { type: 'number', minimum: 0, maximum: 1 }])),
      explanation: { type: 'string' }
    },
    required: [...knobIds, 'explanation'],
    additionalProperties: false
  }
}

const clampToUnit = (value: number): number => Math.min(1, Math.max(0, value))

const readMessageContent = (responseBody: unknown): string => {
  const firstChoice =
    isRecordModule(responseBody) && Array.isArray(responseBody.choices)
      ? responseBody.choices[0]
      : undefined
  const message = isRecordModule(firstChoice) ? firstChoice.message : undefined
  const content = isRecordModule(message) ? message.content : undefined
  if (typeof content !== 'string') {
    throw new Error(INSTRUMENT_ASSISTANT_ERRORS.badAnswer)
  }
  return content
}

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(INSTRUMENT_ASSISTANT_ERRORS.badAnswer)
  }
}

/**
 * The chat completion body that asks the model for a kind's knobs as strict JSON.
 * @param options - the wanted sound in words, the kind and its knobs as they are, and the model id
 * @returns the request body to post to OpenRouter
 */
export const buildInstrumentToneRequest = ({
  description,
  kind,
  currentKnobs,
  model
}: InstrumentToneRequestOptions): Record<string, unknown> => ({
  model,
  messages: [
    { role: 'system', content: INSTRUMENT_KINDS[kind].assistantPrompt },
    {
      role: 'user',
      content: `Current knobs: ${JSON.stringify(currentKnobs)}\nWanted sound: ${description}`
    }
  ],
  response_format: {
    type: 'json_schema',
    json_schema: {
      name: `${kind.replaceAll('-', '_')}_knobs`,
      strict: true,
      schema: buildInstrumentToneSchema(kind)
    }
  }
})

/**
 * Reads a kind's knobs from a parsed object, clamping each to 0 to 1.
 * @param kind - the kind whose knobs are wanted
 * @param parsed - an object with a number under each knob name
 * @returns the knobs
 * @throws {Error} a readable error when a knob is missing or not a number
 */
export const parseInstrumentKnobs = (
  kind: InstrumentKind,
  parsed: Record<string, unknown>
): InstrumentKnobs =>
  Object.fromEntries(
    INSTRUMENT_KINDS[kind].knobs.map(({ id }) => {
      const value = parsed[id]
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(INSTRUMENT_ASSISTANT_ERRORS.badAnswer)
      }
      return [id, clampToUnit(value)]
    })
  )

/**
 * Reads the model's answer, checking every field and clamping each knob to 0 to 1.
 * @param kind - the kind the answer is for
 * @param responseBody - the parsed OpenRouter response
 * @returns the knobs and the model's explanation
 * @throws {Error} a readable error when the answer is missing a field or is not JSON
 */
export const parseInstrumentToneResponse = (
  kind: InstrumentKind,
  responseBody: unknown
): InstrumentToneSuggestion => {
  const parsed = parseJson(readMessageContent(responseBody))
  if (!isRecordModule(parsed)) {
    throw new Error(INSTRUMENT_ASSISTANT_ERRORS.badAnswer)
  }
  return {
    knobs: parseInstrumentKnobs(kind, parsed),
    explanation: typeof parsed.explanation === 'string' ? parsed.explanation : ''
  }
}

const readStatusMessage = (status: number): string => {
  if (status === 401 || status === 403) {
    return INSTRUMENT_ASSISTANT_ERRORS.unauthorised
  }
  if (status === 402) {
    return INSTRUMENT_ASSISTANT_ERRORS.noCredit
  }
  if (status === 429) {
    return INSTRUMENT_ASSISTANT_ERRORS.rateLimited
  }
  return `${INSTRUMENT_ASSISTANT_ERRORS.other} (${status}).`
}

/**
 * Asks OpenRouter for knob settings. The key goes only in the Authorization header of this one
 * request to OpenRouter.
 * @param options - the request options plus the user's own key and, for tests, a fetch
 * @returns the suggested knobs and explanation
 * @throws {Error} a readable error for a refused key, no credit, a network failure or a bad answer
 */
export const askInstrumentToneAssistant = async (
  options: InstrumentToneRequestOptions & { apiKey: string; fetchImplementation?: typeof fetch }
): Promise<InstrumentToneSuggestion> => {
  const { apiKey, fetchImplementation = fetch } = options
  const response = await fetchImplementation(INSTRUMENT_OPENROUTER_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(buildInstrumentToneRequest(options))
  }).catch(() => {
    throw new Error(INSTRUMENT_ASSISTANT_ERRORS.network)
  })
  if (!response.ok) {
    throw new Error(readStatusMessage(response.status))
  }
  return parseInstrumentToneResponse(options.kind, await response.json().catch(() => null))
}
