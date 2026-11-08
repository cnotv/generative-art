import { isRecordModule } from '../strudelModules'
import {
  STRUDEL_AI_ERRORS,
  STRUDEL_AI_MODEL_OPTIONS,
  STRUDEL_AI_OPENROUTER_URL,
  STRUDEL_AI_STATUS_ERRORS
} from './config'
import type { OpenRouterRequestOptions } from './types'

/**
 * The model a dropdown should show. A model saved before the list changed falls back to the
 * default so the dropdown never shows a blank choice.
 * @param storedModel - the model id kept in local storage, if any
 * @param defaultModel - the model to use when the stored one is missing or no longer listed
 * @returns a model id from the dropdown's options
 */
export const readKnownOpenRouterModel = (
  storedModel: string | null,
  defaultModel: string
): string =>
  storedModel !== null && STRUDEL_AI_MODEL_OPTIONS.some(({ value }) => value === storedModel)
    ? storedModel
    : defaultModel

/**
 * The response format that makes the model answer with an object matching the schema.
 * @param name - a name for the schema, letters, digits and underscores
 * @param schema - the JSON schema the answer must match
 * @returns the `response_format` field of a chat completion body
 */
export const buildStrictJsonFormat = (
  name: string,
  schema: Record<string, unknown>
): Record<string, unknown> => ({
  type: 'json_schema',
  json_schema: { name, strict: true, schema }
})

const readMessageContent = (responseBody: unknown): string => {
  const firstChoice =
    isRecordModule(responseBody) && Array.isArray(responseBody.choices)
      ? responseBody.choices[0]
      : undefined
  const message = isRecordModule(firstChoice) ? firstChoice.message : undefined
  const content = isRecordModule(message) ? message.content : undefined
  if (typeof content !== 'string') {
    throw new Error(STRUDEL_AI_ERRORS.badAnswer)
  }
  return content
}

const parseJsonObject = (text: string): Record<string, unknown> => {
  const parsed: unknown = (() => {
    try {
      return JSON.parse(text)
    } catch {
      throw new Error(STRUDEL_AI_ERRORS.badAnswer)
    }
  })()
  if (!isRecordModule(parsed) || Array.isArray(parsed)) {
    throw new Error(STRUDEL_AI_ERRORS.badAnswer)
  }
  return parsed
}

/**
 * Reads the JSON object a chat completion answered with.
 * @param responseBody - the parsed OpenRouter response
 * @returns the object in the first choice's message
 * @throws {Error} a readable error when there is no message or it is not a JSON object
 */
export const readOpenRouterJsonAnswer = (responseBody: unknown): Record<string, unknown> =>
  parseJsonObject(readMessageContent(responseBody))

const readStatusMessage = (status: number): string => {
  const errorKey = STRUDEL_AI_STATUS_ERRORS[status]
  return errorKey === undefined
    ? `${STRUDEL_AI_ERRORS.other} (${status}).`
    : STRUDEL_AI_ERRORS[errorKey]
}

/**
 * Posts a chat completion to OpenRouter and reads its JSON answer. The key goes only in the
 * Authorization header of this one request to OpenRouter.
 * @param options - the player's own key, the request body and, for tests, a fetch
 * @returns the JSON object the model answered with
 * @throws {Error} a readable error for a missing or refused key, no credit, a network failure or
 * a bad answer
 */
export const askOpenRouter = async ({
  apiKey,
  body,
  fetchImplementation = fetch
}: OpenRouterRequestOptions): Promise<Record<string, unknown>> => {
  if (apiKey.trim().length === 0) {
    throw new Error(STRUDEL_AI_ERRORS.noKey)
  }
  const response = await fetchImplementation(STRUDEL_AI_OPENROUTER_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey.trim()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).catch(() => {
    throw new Error(STRUDEL_AI_ERRORS.network)
  })
  if (!response.ok) {
    throw new Error(readStatusMessage(response.status))
  }
  return readOpenRouterJsonAnswer(await response.json().catch(() => null))
}
