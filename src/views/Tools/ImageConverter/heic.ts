const BRAND_START_BYTE = 8
const BRAND_END_BYTE = 12

const HEIF_BRANDS = new Set([
  'heic',
  'heix',
  'heim',
  'heis',
  'hevc',
  'hevx',
  'hevm',
  'hevs',
  'mif1',
  'msf1'
])

/**
 * Reads the ISO base media file format brand. The brand is checked rather
 * than `File.type`, which browsers routinely leave empty for `.heic`, and rather than the
 * `isHeic` helper in `heic-to`, which would pull that package's three megabytes of wasm in
 * for every JPEG just to answer the question.
 */
export const isHeicBuffer = (buffer: ArrayBuffer): boolean =>
  HEIF_BRANDS.has(new TextDecoder().decode(buffer.slice(BRAND_START_BYTE, BRAND_END_BYTE)))
