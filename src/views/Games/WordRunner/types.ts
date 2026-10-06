/** One word of a phrase, with what it means and the look-alikes offered against it. */
export type PhraseWord = {
  text: string
  gloss: string
  decoys: string[]
}

/** A sequence of words to memorise, run as one gate per word. */
export type Phrase = {
  id: string
  title: string
  translation: string
  words: PhraseWord[]
}

/** Every phrase of one language, plus what the speech engine needs to pronounce it. */
export type LanguagePack = {
  language: string
  languageName: string
  speechLanguage: string
  phrases: Phrase[]
}

/**
 * How much help a gate gives: `full` glows the right lane from afar and shows the gloss,
 * `late` glows it only close to the gate, `none` gives nothing away.
 */
export type HintLevel = 'full' | 'late' | 'none'

/** One gate of a lap: which word of the phrase it asks for and how much it helps. */
export type LapWord = {
  position: number
  chunk: number
  hint: HintLevel
}

/**
 * One run along the track. `shuffled` deals every correct word into a lane other than its
 * usual one; `attempt` counts how many times in a row this lap has been re-run after a
 * mistake, zero for the lap as first scheduled.
 */
export type Lap = {
  words: LapWord[]
  shuffled: boolean
  attempt: number
}

/** What every gate of a phrase is dealt from: the phrase, its seed, the lanes and spare words. */
export type GateDeal = {
  phrase: Phrase
  seed: number
  laneCount: number
  fallbackPool: string[]
}

/** A gate as it stands on the track: a word per lane, one of them right. */
export type Gate = {
  position: number
  options: string[]
  correctLane: number
  hint: HintLevel
}

/** What happened when the runner went through a gate. */
export type GateResult = {
  position: number
  chosenLane: number
  correct: boolean
}

/** Every gate result of one finished lap. */
export type LapRecord = {
  lapIndex: number
  results: GateResult[]
}

/** Where the runner is in the lap schedule, and what has been answered so far. */
export type RunState = {
  laps: Lap[]
  lapIndex: number
  gateIndex: number
  currentResults: GateResult[]
  history: LapRecord[]
  finished: boolean
}

/** How one word of the phrase went across the whole run. */
export type WordSummary = {
  position: number
  attempts: number
  correct: number
}
