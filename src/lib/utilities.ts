import { type ClassValue, clsx } from 'clsx'

/**
 * Joins class names, skipping falsy ones.
 * @param inputs Class names, arrays or conditional objects.
 * @returns The joined class string.
 */
export const cn = (...inputs: ClassValue[]) => clsx(inputs)
