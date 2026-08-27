import { describe, it, expect } from 'vitest'
import { isHeicBuffer } from './heic'

const bufferWithBrand = (brand: string): ArrayBuffer => {
  const bytes = new Uint8Array(16)
  bytes.set(
    [...brand].map((character) => character.charCodeAt(0)),
    8
  )
  return bytes.buffer
}

describe('isHeicBuffer', () => {
  it.each(['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'hevm', 'hevs', 'mif1', 'msf1'])(
    'recognises the HEIF brand %s',
    (brand) => {
      const buffer = bufferWithBrand(brand)

      const result = isHeicBuffer(buffer)

      expect(result).toBe(true)
    }
  )

  it.each([
    ['avif', 'a still AVIF, which the browser decodes without help'],
    ['avis', 'an AVIF sequence, which the browser decodes without help'],
    ['isom', 'a plain MP4 sharing the same container'],
    ['qt  ', 'a QuickTime movie sharing the same container']
  ])('rejects the brand %s, %s', (brand) => {
    const buffer = bufferWithBrand(brand)

    const result = isHeicBuffer(buffer)

    expect(result).toBe(false)
  })

  it.each([
    ['a JPEG header', [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]],
    ['a PNG header', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]],
    ['a buffer too short to hold a brand', [0x00, 0x00, 0x00, 0x18, 0x66, 0x74]],
    ['an empty buffer', []]
  ])('rejects %s', (_label, bytes) => {
    const buffer = new Uint8Array(bytes).buffer

    const result = isHeicBuffer(buffer)

    expect(result).toBe(false)
  })
})
