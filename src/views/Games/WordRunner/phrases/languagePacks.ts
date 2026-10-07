import { DEFAULT_LANGUAGE } from '../config'
import type { LanguagePack } from '../types'
import germanPack from './de.json'
import spanishPack from './es.json'
import frenchPack from './fr.json'
import italianPack from './it.json'

/** Every language a phrase can be learned in, in the order the start screen offers them. */
export const LANGUAGE_PACKS: LanguagePack[] = [germanPack, spanishPack, frenchPack, italianPack]

/** The pack for a language, or the default one when that language is not offered. */
export const packFor = (language: string): LanguagePack =>
  LANGUAGE_PACKS.find((pack) => pack.language === language) ??
  LANGUAGE_PACKS.find((pack) => pack.language === DEFAULT_LANGUAGE) ??
  LANGUAGE_PACKS[0]
