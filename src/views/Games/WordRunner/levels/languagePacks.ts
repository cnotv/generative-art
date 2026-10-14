import { CEFR_LEVELS, DEFAULT_LANGUAGE } from '../config'
import type { CefrLevel, LanguagePack, Level } from '../types'
import germanPack from './de.json'
import spanishPack from './es.json'
import frenchPack from './fr.json'
import italianPack from './it.json'

type PackFile = typeof germanPack

const cefrLevelOf = (levelId: string, value: string): CefrLevel => {
  const cefr = CEFR_LEVELS.find((candidate) => candidate === value)
  if (!cefr) throw new Error(`Level ${levelId} has no CEFR level "${value}"`)
  return cefr
}

/**
 * A pack file as the game reads it, with each level's CEFR code checked rather than assumed.
 * @param file The pack as imported.
 * @returns The pack with checked CEFR codes.
 */
const readPack = (file: PackFile): LanguagePack => ({
  ...file,
  levels: file.levels.map((level) => ({ ...level, cefr: cefrLevelOf(level.id, level.cefr) }))
})

/** Every language a level can be run in, in the order the start screen offers them. */
export const LANGUAGE_PACKS: LanguagePack[] = [
  germanPack,
  spanishPack,
  frenchPack,
  italianPack
].map(readPack)

/**
 * The pack for a language, or the default one when that language is not offered.
 * @param language The language code.
 * @returns The pack.
 */
export const packFor = (language: string): LanguagePack =>
  LANGUAGE_PACKS.find((pack) => pack.language === language) ??
  LANGUAGE_PACKS.find((pack) => pack.language === DEFAULT_LANGUAGE) ??
  LANGUAGE_PACKS[0]

/**
 * A level by its id, with the pack it belongs to and where it stands in that pack.
 * @param levelId The level's id.
 * @returns The pack, the level and its index, or undefined.
 */
export const findLevel = (
  levelId: string
): { pack: LanguagePack; level: Level; levelIndex: number } | undefined =>
  LANGUAGE_PACKS.flatMap((pack) =>
    pack.levels.map((level, levelIndex) => ({ pack, level, levelIndex }))
  ).find((entry) => entry.level.id === levelId)

/**
 * The level after this one in its language, or null after the last.
 * @param levelId The current level's id.
 * @returns The next level's id, or null.
 */
export const nextLevelId = (levelId: string): string | null => {
  const found = findLevel(levelId)
  return found?.pack.levels[found.levelIndex + 1]?.id ?? null
}
