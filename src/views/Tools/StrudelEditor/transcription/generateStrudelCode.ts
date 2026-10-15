import type { TranscriptionBar, TranscriptionResult, TranscriptionStep } from '../types'

const REST = '~'

type SequenceItem = {
  value: string
  repeatCount: number
}

const shortestRepeatingPrefix = (values: string[]): string[] => {
  const periodLength =
    Array.from({ length: values.length }, (_, index) => index + 1).find(
      (candidate) =>
        values.length % candidate === 0 &&
        values.every((value, index) => value === values[index % candidate])
    ) ?? values.length
  return values.slice(0, periodLength)
}

const runLengthEncode = (values: string[]): SequenceItem[] =>
  values.reduce<SequenceItem[]>((items, value) => {
    const lastItem = items.at(-1)
    return lastItem?.value === value
      ? [...items.slice(0, -1), { value, repeatCount: lastItem.repeatCount + 1 }]
      : [...items, { value, repeatCount: 1 }]
  }, [])

const formatSequenceItem = (item: SequenceItem): string => {
  const grouped = item.value.includes(' ') ? `[${item.value}]` : item.value
  return item.repeatCount > 1 ? `${grouped}!${item.repeatCount}` : grouped
}

/**
 * Mini-notation for one value per bar. A loop is cut down to its shortest repeating
 * prefix, consecutive repeats become "!n", and more than one bar alternates per cycle
 * inside "<...>".
 * @param barStrings - mini-notation of each bar, in order
 * @returns the mini-notation sequence
 */
export const formatBarSequence = (barStrings: string[]): string => {
  if (barStrings.length === 0) {
    return REST
  }
  const items = runLengthEncode(shortestRepeatingPrefix(barStrings))
  if (items.length === 1) {
    return items[0].value
  }
  return `<${items.map(formatSequenceItem).join(' ')}>`
}

const drumToken = (step: TranscriptionStep): string => {
  if (step.drums.length === 0) {
    return REST
  }
  return step.drums.length === 1 ? step.drums[0] : `[${step.drums.join(',')}]`
}

const barPattern = (bar: TranscriptionBar, tokenOf: (step: TranscriptionStep) => string): string =>
  bar.steps.map(tokenOf).join(' ')

const hasDrums = (bars: TranscriptionBar[]): boolean =>
  bars.some((bar) => bar.steps.some((step) => step.drums.length > 0))

const hasBass = (bars: TranscriptionBar[]): boolean =>
  bars.some((bar) => bar.steps.some((step) => step.bassNote !== null))

const hasChords = (bars: TranscriptionBar[]): boolean => bars.some((bar) => bar.chord !== null)

const buildLayers = (bars: TranscriptionBar[]): string[] =>
  [
    hasDrums(bars) && `s("${formatBarSequence(bars.map((bar) => barPattern(bar, drumToken)))}")`,
    hasBass(bars) &&
      `note("${formatBarSequence(
        bars.map((bar) => barPattern(bar, (step) => step.bassNote ?? REST))
      )}").s("sawtooth").lpf(400).gain(.7)`,
    hasChords(bars) &&
      `chord("${formatBarSequence(
        bars.map((bar) => bar.chord ?? REST)
      )}").voicing().s("triangle").gain(.4)`
  ].filter((layer): layer is string => layer !== false)

/**
 * Strudel code that replays a transcription: tempo, then drums, bass and chords stacked,
 * leaving out any layer the audio did not have.
 * @param result - the analysed bars and tempo
 * @param sourceName - file name for the header comment
 * @returns code ready for the editor
 */
export const generateStrudelCode = (result: TranscriptionResult, sourceName: string): string => {
  const safeName = sourceName.replaceAll(/[\n\r]+/g, ' ')
  const header = [
    `// Transcribed from "${safeName}": ${result.beatsPerMinute} BPM, ${result.bars.length} bars`,
    `setcps(${result.beatsPerMinute}/60/4)`,
    ''
  ]
  const layers = buildLayers(result.bars)
  if (layers.length === 0) {
    return [...header, 'silence'].join('\n')
  }
  return [...header, 'stack(', layers.map((layer) => `  ${layer}`).join(',\n'), ')'].join('\n')
}
