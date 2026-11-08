import {
  STRUDEL_AI_ERRORS,
  STRUDEL_COMPOSER_ACTIONS,
  STRUDEL_COMPOSER_SYSTEM_PROMPT
} from './config'
import { askOpenRouter, buildStrictJsonFormat } from './openRouter'
import type {
  StrudelComposerAction,
  StrudelComposerAnswer,
  StrudelComposerRequestOptions
} from './types'

const STRUDEL_COMPOSER_SCHEMA = {
  type: 'object',
  properties: {
    explanation: { type: 'string' },
    code: { type: 'string' }
  },
  required: ['explanation', 'code'],
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

/**
 * Reads the model's answer. A review keeps only its explanation; compose and revise must return
 * code, with any Markdown fence the model wrapped it in removed.
 * @param action - the action the answer is for
 * @param parsed - the JSON object the model answered with
 * @returns the explanation and, except for a review, the code
 * @throws {Error} a readable error when compose or revise returned no code
 */
export const parseStrudelComposerAnswer = (
  action: StrudelComposerAction,
  parsed: Record<string, unknown>
): StrudelComposerAnswer => {
  const explanation = typeof parsed.explanation === 'string' ? parsed.explanation.trim() : ''
  if (action === 'review') {
    return { action, explanation, code: '' }
  }
  const code = typeof parsed.code === 'string' ? stripMarkdownFence(parsed.code) : ''
  if (code.length === 0) {
    throw new Error(STRUDEL_AI_ERRORS.noCode)
  }
  return { action, explanation, code }
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
