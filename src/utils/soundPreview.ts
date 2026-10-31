/**
 * Plays a rendered WAV through its own audio element, separate from any game's audio, so a
 * sound can be heard before it is applied.
 * @param wav The rendered file.
 * @param loop Whether to repeat until stopped.
 * @param onEnded Called when a non-looping sound finishes, or the browser refuses to play it.
 * @returns A function that stops it and frees the file.
 */
export const playPreview = (wav: ArrayBuffer, loop: boolean, onEnded: () => void): (() => void) => {
  const url = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }))
  const audio = Object.assign(document.createElement('audio'), { src: url, loop })
  const release = (): void => {
    audio.pause()
    URL.revokeObjectURL(url)
  }
  audio.addEventListener('ended', () => {
    release()
    onEnded()
  })
  audio.play().catch(() => {
    release()
    onEnded()
  })
  return release
}
