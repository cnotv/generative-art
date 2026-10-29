import { playAudioFile } from '@webgamekit/audio'
import runTheme from '@/assets/audio/rockrunner/run-theme.ogg'
import jumpSound from '@/assets/audio/rockrunner/jump.wav'
import finishSound from '@/assets/audio/rockrunner/finish.wav'
import { RUN_THEME_VOLUME, SOUND_EFFECT_VOLUME } from '../config'

/**
 * Soundtrack and effects for a run. The theme is one looping element that is paused rather than
 * discarded, so a retry resumes from the same element the browser already allowed to play.
 * @returns Controls to start and stop the theme and to play the jump and finish effects.
 */
export const useRockRunnerAudio = () => {
  const theme = Object.assign(document.createElement('audio'), { src: runTheme })
  theme.loop = true
  theme.volume = RUN_THEME_VOLUME

  return {
    startTheme: (): void => {
      theme.currentTime = 0
      theme.play().catch(() => undefined)
    },
    stopTheme: (): void => theme.pause(),
    playJump: (): void => playAudioFile(jumpSound, SOUND_EFFECT_VOLUME),
    playFinish: (): void => playAudioFile(finishSound, SOUND_EFFECT_VOLUME)
  }
}
