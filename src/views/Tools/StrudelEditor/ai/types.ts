import type { InstrumentKind } from '../instruments/types'

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

/** An instrument preset the model designed for the piece, described in words. */
export type StrudelComposerInstrument = {
  name: string
  kind: InstrumentKind
  /** The wanted sound, which the sound model turns into the kind's knobs. */
  description: string
}

export type StrudelComposerAnswer = {
  action: StrudelComposerAction
  explanation: string
  /** Empty for a review, which only comments. */
  code: string
  /** New presets the code plays; empty for a review or a fix. */
  instruments: StrudelComposerInstrument[]
}

/** What applying the answer did with one designed instrument. */
export type StrudelComposerInstrumentStatus = 'creating' | 'ready' | 'existed' | 'failed'

export type StrudelComposerInstrumentResult = {
  status: StrudelComposerInstrumentStatus
  /** Why it failed, or empty. */
  message: string
}

export type OpenRouterRequestOptions = {
  apiKey: string
  body: Record<string, unknown>
  fetchImplementation?: typeof fetch
}
