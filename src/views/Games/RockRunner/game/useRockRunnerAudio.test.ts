import { describe, it, expect, vi, beforeEach } from 'vitest'

const playAudioFile = vi.hoisted(() => vi.fn())
vi.mock('@webgamekit/audio', () => ({ playAudioFile }))

import { useRockRunnerAudio } from './useRockRunnerAudio'
import { RUN_THEME_VOLUME, SOUND_EFFECT_VOLUME } from '../config'

const themeElements: Array<{
  loop: boolean
  volume: number
  currentTime: number
  play: ReturnType<typeof vi.fn>
  pause: ReturnType<typeof vi.fn>
}> = []

beforeEach(() => {
  playAudioFile.mockClear()
  themeElements.length = 0
  vi.stubGlobal(
    'Audio',
    vi.fn(() => {
      const element = {
        loop: false,
        volume: 1,
        currentTime: 5,
        play: vi.fn(() => Promise.resolve()),
        pause: vi.fn()
      }
      themeElements.push(element)
      return element
    })
  )
})

describe('useRockRunnerAudio', () => {
  it('loops the theme quietly, restarting it from the top on each run', () => {
    const audio = useRockRunnerAudio()
    audio.startTheme()

    const [theme] = themeElements
    expect(theme.loop).toBe(true)
    expect(theme.volume).toBe(RUN_THEME_VOLUME)
    expect(theme.currentTime).toBe(0)
    expect(theme.play).toHaveBeenCalledTimes(1)
  })

  it('pauses the theme when asked to stop', () => {
    const audio = useRockRunnerAudio()
    audio.stopTheme()

    expect(themeElements[0].pause).toHaveBeenCalledTimes(1)
  })

  it('plays the jump and finish effects at the effect volume', () => {
    const audio = useRockRunnerAudio()
    audio.playJump()
    audio.playFinish()

    expect(playAudioFile).toHaveBeenCalledTimes(2)
    expect(playAudioFile.mock.calls.map(([, volume]) => volume)).toEqual([
      SOUND_EFFECT_VOLUME,
      SOUND_EFFECT_VOLUME
    ])
  })
})
