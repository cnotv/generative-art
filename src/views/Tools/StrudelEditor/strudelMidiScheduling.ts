import { getAudioContext } from '@strudel/webaudio'

/**
 * Stands in for superdough's `scheduleAtTime`, which `@strudel/midi` imports through a path
 * that only exists inside the Strudel monorepo. Its published build inlines a private copy
 * with its own, never resumed, AudioContext, so `.midi()` notes were timed against a clock
 * that never runs. This one schedules on the audio context the patterns play on.
 * @param callback - what to run once the target time arrives
 * @param targetTime - when to run it, in seconds on the audio context's clock
 * @param audioContext - the clock to schedule against, the playing context by default
 */
export const scheduleAtTime = (
  callback: () => void,
  targetTime: number,
  audioContext: BaseAudioContext = getAudioContext()
): void => {
  // A muted ConstantSource ends exactly at the target time on the audio clock, unlike a timer.
  const clockSource = new ConstantSourceNode(audioContext)
  const silentGain = new GainNode(audioContext, { gain: 0 })
  silentGain.connect(audioContext.destination)
  clockSource.connect(silentGain)
  clockSource.addEventListener(
    'ended',
    () => {
      clockSource.disconnect()
      silentGain.disconnect()
      callback()
    },
    { once: true }
  )
  clockSource.start(audioContext.currentTime)
  clockSource.stop(targetTime)
}
