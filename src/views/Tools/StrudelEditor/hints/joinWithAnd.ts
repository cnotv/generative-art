/**
 * Joins words the way a sentence lists them: "kick", "kick and snare", "kick, snare and hats".
 * @param words - the words to list
 * @returns the list as text, empty for no words
 */
export const joinWithAnd = (words: string[]): string =>
  words.length <= 1 ? (words[0] ?? '') : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`
