const HEX_RADIX = 16
const UUID_VERSION_4_MASK = 0x40
const UUID_VARIANT_MASK = 0x80

const toHex = (byte: number): string => byte.toString(HEX_RADIX).padStart(2, '0')

/**
 * Builds a version 4 UUID from `getRandomValues`, which stays available on plain http pages.
 * @returns A UUID string in the 8-4-4-4-12 layout
 */
export const randomUuidFromRandomValues =
  (): `${string}-${string}-${string}-${string}-${string}` => {
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    bytes[6] = (bytes[6] & 0x0f) | UUID_VERSION_4_MASK
    bytes[8] = (bytes[8] & 0x3f) | UUID_VARIANT_MASK
    const hex = Array.from(bytes, toHex).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }

/**
 * `crypto.randomUUID` exists only in secure contexts (https or localhost), so a site served
 * over plain http throws on it. Installs a fallback when it is missing.
 */
export const polyfillRandomUuid = (): void => {
  if (typeof crypto.randomUUID !== 'function') {
    crypto.randomUUID = randomUuidFromRandomValues
  }
}
