import { reactive, watch } from 'vue'
import runTheme from '@/assets/audio/rockrunner/run-theme.mp3'
import jumpSound from '@/assets/audio/rockrunner/jump.wav'
import finishSound from '@/assets/audio/rockrunner/finish.wav'
import fallSound from '@/assets/audio/rockrunner/fall.wav'
import bumpSound from '@/assets/audio/rockrunner/bump.wav'
import rollSound from '@/assets/audio/rockrunner/roll.wav'
import {
  BUMP_VOLUME,
  FALL_VOLUME,
  IMPACT_COOLDOWN_MS,
  IMPACT_MIN_SHARE,
  ROLL_EASE_SECONDS,
  ROLL_LEVEL_STEPS,
  ROLL_MAX_RATE,
  ROLL_MIN_RATE,
  RUN_THEME_VOLUME,
  SOUND_EFFECT_VOLUME
} from '../config'
import type { RockImpact, SoundSettings } from '../types'

const EFFECT_URLS = {
  jump: jumpSound,
  finish: finishSound,
  fall: fallSound,
  bump: bumpSound,
  roll: rollSound
}
type EffectName = keyof typeof EFFECT_URLS

const IMPACT_VOLUMES = { fall: FALL_VOLUME, bump: BUMP_VOLUME }

type Rumble = { source: AudioBufferSourceNode; gain: GainNode }

const createDefaultContext = (): AudioContext => new AudioContext()

/**
 * Soundtrack and effects for a run.
 *
 * Effects are decoded once into memory and replayed from there: creating an audio element per
 * hit made the browser decode the same file again and again, which stuttered. The long theme
 * is the only thing that streams. Music and effects can each be switched off.
 * @param createContext Builds the audio context on first use; replaceable in tests.
 * @returns The settings and the controls for the theme, the rumble, impacts and one-shots.
 */
export const useRockRunnerAudio = (createContext: () => AudioContext = createDefaultContext) => {
  const settings = reactive<SoundSettings>({ music: true, effects: true })
  const theme = Object.assign(document.createElement('audio'), {
    src: runTheme,
    loop: true,
    volume: RUN_THEME_VOLUME
  })
  const session = {
    context: null as AudioContext | null,
    buffers: {} as Partial<Record<EffectName, AudioBuffer>>,
    rumble: null as Rumble | null,
    rollingStep: -1,
    themeWanted: false,
    lastImpactAt: { fall: -Infinity, bump: -Infinity }
  }

  const loadEffects = async (context: AudioContext): Promise<void> => {
    await Promise.all(
      (Object.entries(EFFECT_URLS) as [EffectName, string][]).map(async ([name, url]) => {
        if (session.buffers[name]) return
        const response = await fetch(url)
        session.buffers[name] = await context.decodeAudioData(await response.arrayBuffer())
      })
    )
  }

  const prepareEffects = (): void => {
    if (!session.context) session.context = createContext()
    session.context.resume().catch(() => undefined)
    loadEffects(session.context).catch(() => undefined)
  }

  const playOneShot = (name: EffectName, volume: number): void => {
    const { context } = session
    const buffer = session.buffers[name]
    if (!settings.effects || !context || !buffer) return
    const source = context.createBufferSource()
    const gain = context.createGain()
    source.buffer = buffer
    gain.gain.value = volume
    source.connect(gain).connect(context.destination)
    source.start()
  }

  const startRumble = (): Rumble | null => {
    const { context } = session
    const buffer = session.buffers.roll
    if (!context || !buffer) return null
    const source = context.createBufferSource()
    const gain = context.createGain()
    source.buffer = buffer
    source.loop = true
    gain.gain.value = 0
    source.connect(gain).connect(context.destination)
    source.start()
    return { source, gain }
  }

  const stopRumble = (): void => {
    session.rumble?.source.stop()
    session.rumble = null
    session.rollingStep = -1
  }

  // Called every frame, but the nodes are only touched when the level moves a step.
  const setRolling = (requestedLevel: number): void => {
    const level = settings.effects ? requestedLevel : 0
    const step = Math.round(level * ROLL_LEVEL_STEPS)
    if (step === session.rollingStep || !session.context) return
    if (step === 0 && !session.rumble) return
    session.rumble = session.rumble ?? startRumble()
    if (!session.rumble) return
    session.rollingStep = step
    const steppedLevel = step / ROLL_LEVEL_STEPS
    const now = session.context.currentTime
    session.rumble.gain.gain.setTargetAtTime(
      steppedLevel * SOUND_EFFECT_VOLUME,
      now,
      ROLL_EASE_SECONDS
    )
    session.rumble.source.playbackRate.setTargetAtTime(
      ROLL_MIN_RATE + steppedLevel * (ROLL_MAX_RATE - ROLL_MIN_RATE),
      now,
      ROLL_EASE_SECONDS
    )
  }

  const playTheme = (): void => {
    if (session.themeWanted && settings.music) theme.play().catch(() => undefined)
    else theme.pause()
  }

  watch(
    () => settings.music,
    () => playTheme()
  )

  return {
    settings,
    startTheme: (): void => {
      session.themeWanted = true
      theme.currentTime = 0
      playTheme()
      prepareEffects()
    },
    stopTheme: (): void => {
      session.themeWanted = false
      theme.pause()
      stopRumble()
    },
    setRolling,
    playImpact: ({ kind, strength }: RockImpact): void => {
      const now = performance.now()
      if (now - session.lastImpactAt[kind] < IMPACT_COOLDOWN_MS[kind]) return
      session.lastImpactAt[kind] = now
      playOneShot(
        kind,
        IMPACT_VOLUMES[kind] * (IMPACT_MIN_SHARE + (1 - IMPACT_MIN_SHARE) * strength)
      )
    },
    playJump: (): void => playOneShot('jump', SOUND_EFFECT_VOLUME),
    playFinish: (): void => playOneShot('finish', SOUND_EFFECT_VOLUME)
  }
}
