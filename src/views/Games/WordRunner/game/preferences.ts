import { readStorage, writeStorage } from './storage'

/** A value from outside, as one of the choices on offer, or the fallback when it is none. */
export const oneOf = <T extends string>(value: unknown, available: T[], fallback: T): T =>
  available.find((choice) => choice === value) ?? fallback

/** The choice made last time under a key, if it is still offered, otherwise the fallback. */
export const loadChoice = <T extends string>(key: string, available: T[], fallback: T): T =>
  oneOf(readStorage(key), available, fallback)

export const saveChoice = (key: string, choice: string): void => writeStorage(key, choice)
