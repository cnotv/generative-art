/** Drum sound tokens (and a rest) from the dirt-samples bank used to assemble
 *  random patterns. (`ho` is the open hi-hat; dirt has no `oh`.) */
const DRUM_TOKENS = ['bd', 'hh', 'sd', 'ho', 'cp', '~']

/**
 * Build a random single-cycle drum pattern as a Strudel source string, e.g.
 * `s("bd hh ~ sd hh ~ cp hh")`.
 * @param steps - Number of steps in the cycle (default 8)
 * @param random - Random source returning 0..1 (default `Math.random`, injectable for tests)
 * @returns A playable Strudel pattern string
 */
export const musicRandomDrums = (steps = 8, random: () => number = Math.random): string => {
  const tokens = Array.from(
    { length: Math.max(1, Math.floor(steps)) },
    () => DRUM_TOKENS[Math.floor(random() * DRUM_TOKENS.length)]
  )
  return `s("${tokens.join(' ')}")`
}
