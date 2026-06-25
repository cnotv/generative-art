import { ref, onUnmounted } from 'vue'
import { musicPlay, musicStop, musicSetTempo } from '@webgamekit/music'

/**
 * Vue lifecycle wrapper around the `@webgamekit/music` (Strudel) engine: tracks
 * play state and tempo, surfaces errors, and stops playback on unmount.
 * @returns Reactive state and play/stop/tempo controls
 */
export const useStrudel = () => {
  const isPlaying = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  // Intent flag: play() awaits engine init/sample loading, so a stop pressed
  // during that wait must cancel the pattern that is about to start.
  const wantPlaying = ref(false)

  const play = async (pattern: string): Promise<void> => {
    error.value = null
    isLoading.value = true
    wantPlaying.value = true
    try {
      await musicPlay(pattern)
      if (!wantPlaying.value) {
        musicStop()
        return
      }
      isPlaying.value = true
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : String(caught)
    } finally {
      isLoading.value = false
    }
  }

  const stop = (): void => {
    wantPlaying.value = false
    musicStop()
    isPlaying.value = false
  }

  const setTempo = (cyclesPerSecond: number): void => musicSetTempo(cyclesPerSecond)

  onUnmounted(stop)

  return { isPlaying, isLoading, error, play, stop, setTempo }
}
