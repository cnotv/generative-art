import { describe, it, expect, vi, beforeEach } from 'vitest'
import { playPreview } from './soundPreview'

const play = vi.spyOn(HTMLMediaElement.prototype, 'play')
const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause')
const created = vi.fn(() => 'blob:preview')
const revoked = vi.fn()

beforeEach(() => {
  play.mockReset().mockResolvedValue(undefined)
  pause.mockReset().mockImplementation(() => undefined)
  created.mockClear()
  revoked.mockClear()
  vi.stubGlobal('URL', { createObjectURL: created, revokeObjectURL: revoked })
})

describe('playPreview', () => {
  it('plays the file from a blob url', () => {
    playPreview(new ArrayBuffer(8), false, vi.fn())

    const audio = play.mock.contexts[0] as HTMLAudioElement
    expect(audio.getAttribute('src')).toBe('blob:preview')
    expect(audio.loop).toBe(false)
  })

  it('loops when asked to', () => {
    playPreview(new ArrayBuffer(8), true, vi.fn())

    expect((play.mock.contexts[0] as HTMLAudioElement).loop).toBe(true)
  })

  it('stops and frees the file when the stop function is called', () => {
    const stop = playPreview(new ArrayBuffer(8), true, vi.fn())

    stop()

    expect(pause).toHaveBeenCalledTimes(1)
    expect(revoked).toHaveBeenCalledWith('blob:preview')
  })

  it('reports the end of a sound and frees the file', () => {
    const onEnded = vi.fn()
    playPreview(new ArrayBuffer(8), false, onEnded)
    ;(play.mock.contexts[0] as HTMLAudioElement).dispatchEvent(new Event('ended'))

    expect(onEnded).toHaveBeenCalledTimes(1)
    expect(revoked).toHaveBeenCalledWith('blob:preview')
  })

  it('reports an end when the browser refuses to play', async () => {
    play.mockRejectedValue(new Error('blocked'))
    const onEnded = vi.fn()

    playPreview(new ArrayBuffer(8), false, onEnded)
    await Promise.resolve()
    await Promise.resolve()

    expect(onEnded).toHaveBeenCalledTimes(1)
  })
})
