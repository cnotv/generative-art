import { STRUDEL_AI_ERRORS } from '../ai/config'
import { askOpenRouter, buildStrictJsonFormat } from '../ai/openRouter'
import { INSTRUMENT_KINDS } from './config'
import type {
  InstrumentKind,
  InstrumentKnobs,
  InstrumentToneRequestOptions,
  InstrumentToneSuggestion
} from './types'

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
  response_format: buildStrictJsonFormat(
    `${kind.replaceAll('-', '_')}_knobs`,
    buildInstrumentToneSchema(kind)
  )
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
        throw new Error(STRUDEL_AI_ERRORS.badAnswer)
      }
      return [id, clampToUnit(value)]
    })
  )

/**
 * Reads the model's answer, checking every field and clamping each knob to 0 to 1.
 * @param kind - the kind the answer is for
 * @param parsed - the JSON object the model answered with
 * @returns the knobs and the model's explanation
 * @throws {Error} a readable error when a knob is missing
 */
export const parseInstrumentToneAnswer = (
  kind: InstrumentKind,
  parsed: Record<string, unknown>
): InstrumentToneSuggestion => ({
  knobs: parseInstrumentKnobs(kind, parsed),
  explanation: typeof parsed.explanation === 'string' ? parsed.explanation : ''
})

/**
 * Asks OpenRouter for knob settings.
 * @param options - the request options plus the player's own key and, for tests, a fetch
 * @returns the suggested knobs and explanation
 * @throws {Error} a readable error for a refused key, no credit, a network failure or a bad answer
 */
export const askInstrumentToneAssistant = async (
  options: InstrumentToneRequestOptions & { apiKey: string; fetchImplementation?: typeof fetch }
): Promise<InstrumentToneSuggestion> =>
  parseInstrumentToneAnswer(
    options.kind,
    await askOpenRouter({
      apiKey: options.apiKey,
      body: buildInstrumentToneRequest(options),
      fetchImplementation: options.fetchImplementation
    })
  )
