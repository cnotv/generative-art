import { readStorage, writeStorage } from './storage'

/**
 * A value from outside, as one of the choices on offer, or the fallback when it is none.
 * @param value The value to check.
 * @param available The choices on offer.
 * @param fallback The choice when value is none of them.
 * @returns A valid choice.
 */
export const oneOf = <T extends string>(value: unknown, available: T[], fallback: T): T =>
  available.find((choice) => choice === value) ?? fallback

/**
 * The choice made last time under a key, if it is still offered, otherwise the fallback.
 * @param key The storage key.
 * @param available The choices on offer.
 * @param fallback The choice when nothing valid is stored.
 * @returns A valid choice.
 */
export const loadChoice = <T extends string>(key: string, available: T[], fallback: T): T =>
  oneOf(readStorage(key), available, fallback)

/**
 * Stores a choice under a key.
 * @param key The storage key.
 * @param choice The choice.
 */
export const saveChoice = (key: string, choice: string): void => {
  writeStorage(key, choice)
}
