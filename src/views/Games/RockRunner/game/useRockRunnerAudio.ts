import { playAudioFile } from '@webgamekit/audio'
import runTheme from '@/assets/audio/rockrunner/run-theme.ogg'
import jumpSound from '@/assets/audio/rockrunner/jump.wav'
import finishSound from '@/assets/audio/rockrunner/finish.wav'
import fallSound from '@/assets/audio/rockrunner/fall.wav'
import bumpSound from '@/assets/audio/rockrunner/bump.wav'
import rollSound from '@/assets/audio/rockrunner/roll.wav'
import {
  BUMP_VOLUME,
  FALL_VOLUME,
  ROLL_MAX_RATE,
  ROLL_MIN_RATE,
  RUN_THEME_VOLUME,
  SOUND_EFFECT_VOLUME
} from '../config'
import type { RockImpact } from '../types'

const IMPACT_SOUNDS = { fall: fallSound, bump: bumpSound }
const IMPACT_VOLUMES = { fall: FALL_VOLUME, bump: BUMP_VOLUME }
// Even the lightest hit stays audible; strength only scales it from here up.
const IMPACT_MIN_SHARE = 0.4

const createLoopingElement = (source: string, volume: number): HTMLAudioElement =>
  Object.assign(document.createElement('audio'), { src: source, loop: true, volume })

/**
 * Soundtrack and effects for a run. The theme and the rolling rumble are looping elements that
 * are paused rather than discarded, so a retry resumes on elements the browser already allowed
 * to play.
 * @returns Controls for the theme, the rolling rumble, impacts and the one-shot effects.
 */
export const useRockRunnerAudio = () => {
  const theme = createLoopingElement(runTheme, RUN_THEME_VOLUME)
  const rolling = createLoopingElement(rollSound, 0)

  const setRolling = (level: number): void => {
    rolling.volume = level * SOUND_EFFECT_VOLUME
    rolling.playbackRate = ROLL_MIN_RATE + level * (ROLL_MAX_RATE - ROLL_MIN_RATE)
    if (level > 0 && rolling.paused) rolling.play().catch(() => undefined)
  }

  return {
    startTheme: (): void => {
      theme.currentTime = 0
      theme.play().catch(() => undefined)
    },
    stopTheme: (): void => {
      theme.pause()
      rolling.pause()
    },
    setRolling,
    playImpact: ({ kind, strength }: RockImpact): void =>
      playAudioFile(
        IMPACT_SOUNDS[kind],
        IMPACT_VOLUMES[kind] * (IMPACT_MIN_SHARE + (1 - IMPACT_MIN_SHARE) * strength)
      ),
    playJump: (): void => playAudioFile(jumpSound, SOUND_EFFECT_VOLUME),
    playFinish: (): void => playAudioFile(finishSound, SOUND_EFFECT_VOLUME)
  }
}
