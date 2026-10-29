import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { useRockRunnerAudio } from './useRockRunnerAudio'
import { BUMP_VOLUME, FALL_VOLUME, IMPACT_COOLDOWN_MS, RUN_THEME_VOLUME } from '../config'

const play = vi.spyOn(HTMLMediaElement.prototype, 'play')
const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause')

const createFakeContext = () => {
  const sources: {
    buffer: unknown
    loop: boolean
    start: ReturnType<typeof vi.fn>
    stop: ReturnType<typeof vi.fn>
    playbackRate: { setTargetAtTime: ReturnType<typeof vi.fn> }
    connect: ReturnType<typeof vi.fn>
    gain: { value: number; setTargetAtTime: ReturnType<typeof vi.fn> }
  }[] = []
  const context = {
    currentTime: 0,
    destination: {},
    resume: vi.fn(() => Promise.resolve()),
    decodeAudioData: vi.fn(() => Promise.resolve({ decoded: true })),
    createGain: vi.fn(() => {
      const gain = { value: 0, setTargetAtTime: vi.fn() }
      return { gain, connect: (target: unknown) => target, owner: gain }
    }),
    createBufferSource: vi.fn(() => {
      const source = {
        buffer: null,
        loop: false,
        start: vi.fn(),
        stop: vi.fn(),
        playbackRate: { setTargetAtTime: vi.fn() },
        connect: vi.fn((node: { owner: unknown }) => node),
        gain: { value: 0, setTargetAtTime: vi.fn() }
      }
      sources.push(source)
      return source
    })
  }
  return { context: context as unknown as AudioContext, sources, raw: context }
}

const setup = async () => {
  const fake = createFakeContext()
  const audio = useRockRunnerAudio(() => fake.context)
  audio.startTheme()
  await vi.waitFor(() => expect(fake.raw.decodeAudioData).toHaveBeenCalledTimes(5))
  await new Promise((resolve) => setTimeout(resolve))
  return { ...fake, audio }
}

beforeEach(() => {
  play.mockReset().mockResolvedValue(undefined)
  pause.mockReset().mockImplementation(() => undefined)
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }))
  )
  vi.spyOn(performance, 'now').mockReturnValue(10_000)
})

describe('useRockRunnerAudio theme', () => {
  it('loops the theme quietly from the top, and decodes every effect once', async () => {
    const { audio, raw } = await setup()

    const theme = play.mock.contexts[0] as HTMLAudioElement
    expect(theme.loop).toBe(true)
    expect(theme.volume).toBe(RUN_THEME_VOLUME)
    expect(theme.currentTime).toBe(0)
    expect(raw.decodeAudioData).toHaveBeenCalledTimes(5)
    audio.startTheme()
    expect(raw.decodeAudioData).toHaveBeenCalledTimes(5)
  })

  it('pauses the theme when asked to stop', async () => {
    const { audio } = await setup()
    pause.mockClear()

    audio.stopTheme()

    expect(pause).toHaveBeenCalledTimes(1)
  })

  it('does not start the theme while music is off, and starts it when switched back on', async () => {
    const fake = createFakeContext()
    const audio = useRockRunnerAudio(() => fake.context)
    audio.settings.music = false
    await nextTick()

    audio.startTheme()
    expect(play).not.toHaveBeenCalled()

    audio.settings.music = true
    await nextTick()
    expect(play).toHaveBeenCalledTimes(1)
  })

  it('pauses a playing theme the moment music is switched off', async () => {
    const { audio } = await setup()
    pause.mockClear()

    audio.settings.music = false
    await nextTick()

    expect(pause).toHaveBeenCalledTimes(1)
  })
})

describe('useRockRunnerAudio effects', () => {
  it('plays the jump and finish effects at the effect volume', async () => {
    const { audio, sources } = await setup()

    audio.playJump()
    audio.playFinish()

    expect(sources).toHaveLength(2)
    expect(sources.every((source) => source.start.mock.calls.length === 1)).toBe(true)
  })

  it('plays an impact quieter when weak and at full volume when strong', async () => {
    const { audio, raw } = await setup()
    const volumes: number[] = []
    raw.createGain.mockImplementation(() => {
      const gain = { value: 0, setTargetAtTime: vi.fn() }
      Object.defineProperty(gain, 'value', {
        set: (value: number) => {
          volumes.push(value)
        },
        get: () => 0
      })
      return { gain, connect: (target: unknown) => target }
    })
    const now = vi.spyOn(performance, 'now')

    now.mockReturnValue(20_000)
    audio.playImpact({ kind: 'fall', strength: 0 })
    now.mockReturnValue(30_000)
    audio.playImpact({ kind: 'fall', strength: 1 })
    now.mockReturnValue(40_000)
    audio.playImpact({ kind: 'bump', strength: 1 })

    expect(volumes[0]).toBeGreaterThan(0)
    expect(volumes[0]).toBeLessThan(volumes[1])
    expect(volumes[1]).toBe(FALL_VOLUME)
    expect(volumes[2]).toBe(BUMP_VOLUME)
  })

  it('plays a burst of the same impact once, then again after the cooldown', async () => {
    const { audio, sources } = await setup()
    const now = vi.spyOn(performance, 'now')

    now.mockReturnValue(50_000)
    audio.playImpact({ kind: 'bump', strength: 1 })
    now.mockReturnValue(50_000 + IMPACT_COOLDOWN_MS.bump - 1)
    audio.playImpact({ kind: 'bump', strength: 1 })
    expect(sources).toHaveLength(1)

    now.mockReturnValue(50_000 + IMPACT_COOLDOWN_MS.bump)
    audio.playImpact({ kind: 'bump', strength: 1 })
    expect(sources).toHaveLength(2)
  })

  it('plays nothing while effects are off', async () => {
    const { audio, sources } = await setup()
    audio.settings.effects = false

    audio.playJump()
    audio.playImpact({ kind: 'fall', strength: 1 })

    expect(sources).toHaveLength(0)
  })
})

describe('useRockRunnerAudio rumble', () => {
  it('stays silent and unstarted until the rock has a level', async () => {
    const { audio, sources } = await setup()

    audio.setRolling(0)

    expect(sources.filter((source) => source.loop)).toHaveLength(0)
  })

  it('runs one looping source and eases volume and pitch toward the level', async () => {
    const { audio, sources } = await setup()

    audio.setRolling(0.5)
    audio.setRolling(1)

    const loops = sources.filter((source) => source.loop)
    expect(loops).toHaveLength(1)
    expect(loops[0].playbackRate.setTargetAtTime).toHaveBeenCalledTimes(2)
  })

  it('leaves the nodes alone while the level has not moved a step', async () => {
    const { audio, sources } = await setup()

    audio.setRolling(0.5)
    audio.setRolling(0.501)

    const loop = sources.find((source) => source.loop)
    expect(loop.playbackRate.setTargetAtTime).toHaveBeenCalledTimes(1)
  })

  it('fades to silence when effects are switched off', async () => {
    const { audio, sources } = await setup()
    audio.setRolling(1)
    audio.settings.effects = false

    audio.setRolling(1)

    const loop = sources.find((source) => source.loop)
    expect(loop.playbackRate.setTargetAtTime).toHaveBeenCalledTimes(2)
  })

  it('stops the source with the theme, so a new run starts a fresh one', async () => {
    const { audio, sources } = await setup()
    audio.setRolling(1)

    audio.stopTheme()
    audio.setRolling(1)

    const loops = sources.filter((source) => source.loop)
    expect(loops[0].stop).toHaveBeenCalledTimes(1)
    expect(loops).toHaveLength(2)
  })
})
