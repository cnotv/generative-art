import { describe, it, expect, vi, beforeEach } from 'vitest'

const playAudioFile = vi.hoisted(() => vi.fn())
vi.mock('@webgamekit/audio', () => ({ playAudioFile }))

import { useRockRunnerAudio } from './useRockRunnerAudio'
import { RUN_THEME_VOLUME, SOUND_EFFECT_VOLUME } from '../config'

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

  it('pauses the theme when asked to stop', () => {
    const audio = useRockRunnerAudio()
    audio.stopTheme()

    expect(pause).toHaveBeenCalledTimes(1)
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
})
