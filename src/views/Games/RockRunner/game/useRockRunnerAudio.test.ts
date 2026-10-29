import { describe, it, expect, vi, beforeEach } from 'vitest'

const playAudioFile = vi.hoisted(() => vi.fn())
vi.mock('@webgamekit/audio', () => ({ playAudioFile }))

import { useRockRunnerAudio } from './useRockRunnerAudio'
import { BUMP_VOLUME, FALL_VOLUME, RUN_THEME_VOLUME, SOUND_EFFECT_VOLUME } from '../config'

const play = vi.spyOn(HTMLMediaElement.prototype, 'play')
const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause')

beforeEach(() => {
  playAudioFile.mockClear()
  play.mockReset().mockResolvedValue(undefined)
  pause.mockReset().mockImplementation(() => undefined)
})

describe('useRockRunnerAudio', () => {
  it('loops the theme quietly, restarting it from the top on each run', () => {
    const audio = useRockRunnerAudio()
    audio.startTheme()

    const theme = play.mock.contexts[0] as HTMLAudioElement
    expect(theme.loop).toBe(true)
    expect(theme.volume).toBe(RUN_THEME_VOLUME)
    expect(theme.currentTime).toBe(0)
    expect(play).toHaveBeenCalledTimes(1)
  })

  it('pauses the theme and the rumble when asked to stop', () => {
    const audio = useRockRunnerAudio()
    audio.stopTheme()

    expect(pause).toHaveBeenCalledTimes(2)
  })

  it('plays the jump and finish effects at the effect volume', () => {
    const audio = useRockRunnerAudio()
    audio.playJump()
    audio.playFinish()

    expect(playAudioFile.mock.calls.map(([, volume]) => volume)).toEqual([
      SOUND_EFFECT_VOLUME,
      SOUND_EFFECT_VOLUME
    ])
  })

  it('plays an impact quieter when it is weak and at full volume when it is strong', () => {
    const audio = useRockRunnerAudio()
    audio.playImpact({ kind: 'fall', strength: 0 })
    audio.playImpact({ kind: 'fall', strength: 1 })
    audio.playImpact({ kind: 'bump', strength: 1 })

    const volumes = playAudioFile.mock.calls.map(([, volume]) => volume)
    expect(volumes[0]).toBeGreaterThan(0)
    expect(volumes[0]).toBeLessThan(volumes[1])
    expect(volumes[1]).toBe(FALL_VOLUME)
    expect(volumes[2]).toBe(BUMP_VOLUME)
  })

  it('starts the rumble once it has a level, and speeds it up as the level rises', () => {
    play.mockImplementation(function (this: HTMLMediaElement) {
      Object.defineProperty(this, 'paused', { value: false })
      return Promise.resolve()
    })
    const audio = useRockRunnerAudio()
    audio.setRolling(0)
    expect(play).not.toHaveBeenCalled()

    audio.setRolling(0.2)
    audio.setRolling(1)

    const rumble = play.mock.contexts[0] as HTMLAudioElement
    expect(play).toHaveBeenCalledTimes(1)
    expect(rumble.volume).toBe(SOUND_EFFECT_VOLUME)
    expect(rumble.playbackRate).toBeGreaterThan(1)
  })
})
