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

/** A pack file as the game reads it, with each level's CEFR code checked rather than assumed. */
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

/** The pack for a language, or the default one when that language is not offered. */
export const packFor = (language: string): LanguagePack =>
  LANGUAGE_PACKS.find((pack) => pack.language === language) ??
  LANGUAGE_PACKS.find((pack) => pack.language === DEFAULT_LANGUAGE) ??
  LANGUAGE_PACKS[0]

/** A level by its id, with the pack it belongs to and where it stands in that pack. */
export const findLevel = (
  levelId: string
): { pack: LanguagePack; level: Level; levelIndex: number } | undefined =>
  LANGUAGE_PACKS.flatMap((pack) =>
    pack.levels.map((level, levelIndex) => ({ pack, level, levelIndex }))
  ).find((entry) => entry.level.id === levelId)

/** The level after this one in its language, or null after the last. */
export const nextLevelId = (levelId: string): string | null => {
  const found = findLevel(levelId)
  return found?.pack.levels[found.levelIndex + 1]?.id ?? null
}
