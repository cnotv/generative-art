import {
  STRUDEL_AI_ERRORS,
  STRUDEL_COMPOSER_ACTIONS,
  STRUDEL_COMPOSER_MAX_INSTRUMENTS,
  STRUDEL_COMPOSER_SYSTEM_PROMPT
} from './config'
import { INSTRUMENT_KINDS } from '../instruments/config'
import { isRecordModule } from '../strudelModules'
import { askOpenRouter, buildStrictJsonFormat } from './openRouter'
import type { InstrumentKind } from '../instruments/types'
import type {
  StrudelComposerAction,
  StrudelComposerAnswer,
  StrudelComposerInstrument,
  StrudelComposerRequestOptions
} from './types'

const INSTRUMENT_KIND_IDS = Object.keys(INSTRUMENT_KINDS)

const STRUDEL_COMPOSER_SCHEMA = {
  type: 'object',
  properties: {
    explanation: { type: 'string' },
    code: { type: 'string' },
    instruments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          kind: { type: 'string', enum: INSTRUMENT_KIND_IDS },
          description: { type: 'string' }
        },
        required: ['name', 'kind', 'description'],
        additionalProperties: false
      }
    }
  },
  required: ['explanation', 'code', 'instruments'],
  additionalProperties: false
}

const describePresets = (presetNames: string[]): string =>
  presetNames.length === 0
    ? ''
    : `\n\nInstrument presets in this editor, each played as <name> for single notes, <name>:mute and <name>:chord: ${presetNames.join(', ')}.`

const findInstruction = (action: StrudelComposerAction): string =>
  STRUDEL_COMPOSER_ACTIONS.find(({ id }) => id === action)?.instruction ?? ''

/**
 * The chat completion body that asks for Strudel code, or a review of it, as strict JSON.
 * @param options - the action, the player's request, the code in the editor, the model id and
 * the instrument presets the code can play
 * @returns the request body to post to OpenRouter
 */
export const buildStrudelComposerRequest = ({
  action,
  request,
  currentCode,
  model,
  presetNames
}: StrudelComposerRequestOptions): Record<string, unknown> => ({
  model,
  messages: [
    { role: 'system', content: `${STRUDEL_COMPOSER_SYSTEM_PROMPT}${describePresets(presetNames)}` },
    {
      role: 'user',
      content: `Task: ${findInstruction(action)}\n\nRequest: ${request}\n\nCurrent code:\n${currentCode}`
    }
  ],
  response_format: buildStrictJsonFormat('strudel_composition', STRUDEL_COMPOSER_SCHEMA)
})

const stripMarkdownFence = (code: string): string =>
  code
    .trim()
    .replace(/^```[\w-]*\n/, '')
    .replace(/\n?```$/, '')
    .trim()

const isInstrumentKind = (kind: unknown): kind is InstrumentKind =>
  typeof kind === 'string' && INSTRUMENT_KIND_IDS.includes(kind)

const readInstrument = (candidate: unknown): StrudelComposerInstrument[] => {
  if (!isRecordModule(candidate)) {
    return []
  }
  const { name, kind, description } = candidate
  return typeof name === 'string' && typeof description === 'string' && isInstrumentKind(kind)
    ? [{ name: name.trim(), kind, description: description.trim() }]
    : []
}

const readInstruments = (instruments: unknown): StrudelComposerInstrument[] =>
  Array.isArray(instruments)
    ? instruments.flatMap(readInstrument).slice(0, STRUDEL_COMPOSER_MAX_INSTRUMENTS)
    : []

/**
 * Reads the model's answer. A review keeps only its explanation; compose and revise must return
 * code, with any Markdown fence the model wrapped it in removed, and keep the first few instruments they
 * designed whose kind exists. A fix keeps the music as it is, so it designs none.
 * @param action - the action the answer is for
 * @param parsed - the JSON object the model answered with
 * @returns the explanation, the code except for a review, and any designed instruments
 * @throws {Error} a readable error when compose or revise returned no code
 */
export const parseStrudelComposerAnswer = (
  action: StrudelComposerAction,
  parsed: Record<string, unknown>
): StrudelComposerAnswer => {
  const explanation = typeof parsed.explanation === 'string' ? parsed.explanation.trim() : ''
  if (action === 'review') {
    return { action, explanation, code: '', instruments: [] }
  }
  const code = typeof parsed.code === 'string' ? stripMarkdownFence(parsed.code) : ''
  if (code.length === 0) {
    throw new Error(STRUDEL_AI_ERRORS.noCode)
  }
  const instruments = action === 'fix' ? [] : readInstruments(parsed.instruments)
  return { action, explanation, code, instruments }
}

/**
 * Asks OpenRouter to compose, revise or review Strudel code.
 * @param options - the request options plus the player's own key and, for tests, a fetch
 * @returns the explanation and the code to apply
 * @throws {Error} a readable error for a missing or refused key, no credit, a network failure or
 * a bad answer
 */
export const askStrudelComposer = async (
  options: StrudelComposerRequestOptions & { apiKey: string; fetchImplementation?: typeof fetch }
): Promise<StrudelComposerAnswer> =>
  parseStrudelComposerAnswer(
    options.action,
    await askOpenRouter({
      apiKey: options.apiKey,
      body: buildStrudelComposerRequest(options),
      fetchImplementation: options.fetchImplementation
    })
  )
