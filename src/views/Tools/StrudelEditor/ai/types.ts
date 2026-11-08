export type StrudelComposerAction = 'compose' | 'revise' | 'review' | 'fix'

export type StrudelComposerActionDefinition = {
  id: StrudelComposerAction
  label: string
  /** What the model is told to do with the request and the current code. */
  instruction: string
}

export type StrudelComposerRequestOptions = {
  action: StrudelComposerAction
  /** What the player wants, in their own words, or for a fix the error the editor reported. */
  request: string
  currentCode: string
  model: string
  /** Instrument preset names the code can play, such as "stoner". */
  presetNames: string[]
}

export type StrudelComposerAnswer = {
  action: StrudelComposerAction
  explanation: string
  /** Empty for a review, which only comments. */
  code: string
}

export type OpenRouterRequestOptions = {
  apiKey: string
  body: Record<string, unknown>
  fetchImplementation?: typeof fetch
}
