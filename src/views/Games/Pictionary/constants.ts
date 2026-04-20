export const PLAYER_COLORS = [
  '#d32f2f',
  '#1565c0',
  '#ef6c00',
  '#2e7d32',
  '#6a1b9a',
  '#ad1457',
  '#37474f'
]

export const NAME_ADJECTIVES = ['Swift', 'Clever', 'Bold', 'Brave', 'Wild', 'Silent', 'Happy']
export const NAME_ANIMALS = ['Fox', 'Otter', 'Panda', 'Hawk', 'Wolf', 'Cat', 'Koala']

const GRADIENT_COLORS = [
  'rgba(255, 217, 61, 0.45)',
  'rgba(255, 107, 203, 0.4)',
  'rgba(78, 205, 196, 0.4)',
  'rgba(255, 140, 66, 0.4)',
  'rgba(160, 108, 213, 0.4)',
  'rgba(107, 207, 127, 0.4)',
  'rgba(72, 219, 251, 0.4)'
]
const GRADIENT_STOP_PERCENT = 45
const GRADIENT_LAYER_COUNT = 4
const GRADIENT_PERCENT_MAX = 100

const randomPercent = (): number => Math.round(Math.random() * GRADIENT_PERCENT_MAX)

/**
 * Build a random multi-layer radial gradient background string.
 * @returns A CSS background value with layered radial gradients.
 */
export const buildRandomGradient = (): string => {
  const layers = Array.from({ length: GRADIENT_LAYER_COUNT }, () => {
    const x = randomPercent()
    const y = randomPercent()
    const color = GRADIENT_COLORS[Math.floor(Math.random() * GRADIENT_COLORS.length)]
    return `radial-gradient(circle at ${x}% ${y}%, ${color}, transparent ${GRADIENT_STOP_PERCENT}%)`
  })
  return [...layers, '#fff7e6'].join(', ')
}

/**
 * Pick a random element from a readonly array.
 * @param list - Array to pick from.
 * @returns A random element.
 */
export const randomPick = <T>(list: readonly T[]): T =>
  list[Math.floor(Math.random() * list.length)]

export const ROUND_DURATION_OPTIONS = [30, 60, 90, 120, 150]
export const WORD_COUNT_OPTIONS = [1, 2, 3]
export const HINT_COUNT_OPTIONS = [0, 1, 2, 3, 4, 5]

export const POINTS_BASE = 100
export const POINTS_FIRST_BONUS = 50
export const POINTS_DRAWER_PER_GUESS = 25
