/**
 * Says a word or phrase through the browser's own voice. Silent wherever the Web Speech API is
 * missing, so the game never depends on it. Anything still being said is cut off first: the
 * runner reaches the next gate faster than a slow voice finishes the last word.
 */
export const speak = (text: string, language: string, rate: number): void => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = language
  utterance.rate = rate
  window.speechSynthesis.speak(utterance)
}

export const stopSpeaking = (): void => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
}
