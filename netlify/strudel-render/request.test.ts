import { describe, expect, it } from 'vitest'
import { parseStrudelRenderRequest } from './request'

describe('parseStrudelRenderRequest', () => {
  it('fills in the defaults for a bare pattern', () => {
    const result = parseStrudelRenderRequest({ code: 's("bd sd")' })

    expect(result).toEqual({
      ok: true,
      request: {
        code: 's("bd sd")',
        format: 'wav',
        cycles: 1,
        startCycle: 0,
        sampleRate: 48_000
      }
    })
  })

  it('keeps the requested format, range and sample rate', () => {
    const result = parseStrudelRenderRequest({
      code: 'note("c3 e3")',
      format: 'midi',
      cycles: 4,
      startCycle: 2,
      sampleRate: 44_100
    })

    expect(result).toEqual({
      ok: true,
      request: {
        code: 'note("c3 e3")',
        format: 'midi',
        cycles: 4,
        startCycle: 2,
        sampleRate: 44_100
      }
    })
  })

  it('accepts a fraction of a cycle', () => {
    const result = parseStrudelRenderRequest({ code: 's("bd")', cycles: 0.5 })

    expect(result).toMatchObject({ ok: true, request: { cycles: 0.5 } })
  })

  it.each<[string, unknown, number]>([
    ['a missing body', undefined, 400],
    ['a null body', null, 400],
    ['an array body', [], 400],
    ['a missing code', {}, 400],
    ['a non-string code', { code: 42 }, 400],
    ['an empty code', { code: ' \n\t' }, 400],
    ['an unknown format', { code: 's("bd")', format: 'mp3' }, 400],
    ['zero cycles', { code: 's("bd")', cycles: 0 }, 400],
    ['too many cycles', { code: 's("bd")', cycles: 17 }, 400],
    ['a string cycle count', { code: 's("bd")', cycles: '2' }, 400],
    ['a negative start cycle', { code: 's("bd")', startCycle: -1 }, 400],
    ['a start cycle past the limit', { code: 's("bd")', startCycle: 1001 }, 400],
    ['an unsupported sample rate', { code: 's("bd")', sampleRate: 96_000 }, 400]
  ])('rejects %s', (_label, body, status) => {
    const result = parseStrudelRenderRequest(body)

    expect(result).toMatchObject({ ok: false, status })
  })

  it('rejects code over the size limit with 413', () => {
    const result = parseStrudelRenderRequest({ code: 'a'.repeat(16_385) })

    expect(result).toMatchObject({ ok: false, status: 413 })
  })

  it('accepts code exactly at the size limit', () => {
    const result = parseStrudelRenderRequest({ code: 'a'.repeat(16_384) })

    expect(result.ok).toBe(true)
  })
})
