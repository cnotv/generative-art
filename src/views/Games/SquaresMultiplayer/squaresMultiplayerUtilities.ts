import { POINTS_3_4, POINTS_5, POINTS_6, POINTS_7, POINTS_8_PLUS } from './constants'

const LETTER_WEIGHTS: Record<string, number> = {
  E: 12,
  T: 9,
  A: 8,
  O: 7,
  I: 7,
  N: 6,
  S: 6,
  H: 6,
  R: 5,
  D: 4,
  L: 4,
  C: 3,
  U: 3,
  M: 2,
  W: 2,
  F: 2,
  G: 2,
  Y: 2,
  P: 2,
  B: 1,
  V: 1,
  K: 1,
  J: 1,
  X: 1,
  Q: 1,
  Z: 1
}

const WEIGHTED_LETTERS: string[] = Object.entries(LETTER_WEIGHTS).flatMap(([letter, weight]) =>
  Array(weight).fill(letter)
)

const pickWeightedLetter = (): string =>
  WEIGHTED_LETTERS[Math.floor(Math.random() * WEIGHTED_LETTERS.length)]

/**
 * Shuffle array in place, returning a new shuffled copy.
 * @param arr - Input array.
 * @returns New shuffled array.
 */
export const shuffleArray = <T>(array: T[]): T[] =>
  array.reduceRight(
    (copy, _, i) => {
      const index = Math.floor(Math.random() * (i + 1))
      return copy.map((value, index_) =>
        index_ === i ? copy[index] : index_ === index ? copy[i] : value
      )
    },
    [...array]
  )

const DIRECTIONS: [number, number][] = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1]
]

type MutableGrid = Array<Array<string | null>>

const tryPlaceWord = (grid: MutableGrid, word: string): boolean => {
  const rows = grid.length
  const cols = grid[0].length
  const upperWord = word.toUpperCase()

  const dfs = (
    r: number,
    c: number,
    index: number,
    visited: Set<number>
  ): [number, number][] | null => {
    if (index === upperWord.length) return []
    if (r < 0 || r >= rows || c < 0 || c >= cols) return null
    const key = r * cols + c
    if (visited.has(key)) return null
    const cell = grid[r][c]
    if (cell !== null && cell !== upperWord[index]) return null

    visited.add(key)
    const result = shuffleArray([...DIRECTIONS]).reduce<[number, number][] | null>(
      (found, [dr, dc]) => found ?? dfs(r + dr, c + dc, index + 1, visited),
      null
    )
    if (result !== null) {
      visited.delete(key)
      return [[r, c], ...result]
    }
    visited.delete(key)
    return null
  }

  const startCells = shuffleArray(
    Array.from(
      { length: rows * cols },
      (_, k) => [Math.floor(k / cols), k % cols] as [number, number]
    )
  )

  const foundPath = startCells.reduce<[number, number][] | null>(
    (accumulator, [startR, startC]) => accumulator ?? dfs(startR, startC, 0, new Set<number>()),
    null
  )

  if (foundPath !== null) {
    foundPath.forEach(([r, c], i) => {
      grid[r][c] = upperWord[i]
    })
    return true
  }
  return false
}

/**
 * Build an NxN letter grid containing the given target words via adjacency paths.
 * Words are placed first, remaining cells filled with weighted random letters.
 * @param words - Target words to embed in the grid.
 * @param size - Grid dimension (size × size).
 * @returns Grid of uppercase letters and the list of successfully placed words.
 */
export const generateGrid = (
  words: string[],
  size: number
): { grid: string[][]; placedWords: string[] } => {
  const grid: MutableGrid = Array.from({ length: size }, () => Array(size).fill(null))

  const placedWords = words.reduce<string[]>((accumulator, word) => {
    const placed = tryPlaceWord(grid, word)
    return placed ? [...accumulator, word.toUpperCase()] : accumulator
  }, [])

  const filledGrid = grid.map((row) => row.map((cell) => cell ?? pickWeightedLetter()))
  return { grid: filledGrid, placedWords }
}

/**
 * Check if a word can be formed via adjacent (including diagonal) unique cells in the grid.
 * @param grid - 2D letter grid (uppercase).
 * @param word - Word to search for.
 * @returns True if the word exists as a valid adjacency path.
 */
export const findWordInGrid = (grid: string[][], word: string): boolean => {
  const rows = grid.length
  const cols = grid[0].length
  const upperWord = word.toUpperCase()

  const dfs = (r: number, c: number, index: number, visited: Set<number>): boolean => {
    if (index === upperWord.length) return true
    if (r < 0 || r >= rows || c < 0 || c >= cols) return false
    const key = r * cols + c
    if (visited.has(key) || grid[r][c] !== upperWord[index]) return false

    visited.add(key)
    const found = DIRECTIONS.some(([dr, dc]) => dfs(r + dr, c + dc, index + 1, visited))
    visited.delete(key)
    return found
  }

  return Array.from(
    { length: rows * cols },
    (_, k) => [Math.floor(k / cols), k % cols] as [number, number]
  ).some(([r, c]) => dfs(r, c, 0, new Set()))
}

/**
 * Compute Boggle-style points for a word based on its length.
 * @param word - The found word.
 * @returns Point value.
 */
export const scoreWord = (word: string): number => {
  const length_ = word.length
  if (length_ <= 4) return POINTS_3_4
  if (length_ === 5) return POINTS_5
  if (length_ === 6) return POINTS_6
  if (length_ === 7) return POINTS_7
  return POINTS_8_PLUS
}
