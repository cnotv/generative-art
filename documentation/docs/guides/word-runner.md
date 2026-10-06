---
sidebar_position: 25
---

# Word Runner: learning a phrase as a path

Word Runner is a three-lane runner at `/games/WordRunner`. Each gate across the track shows one
word per lane, and the player runs through the lane holding the next word of a phrase in another
language. The first language pack is Spanish.

:::note Source files
`src/views/Games/WordRunner/phrases/es.json`, `src/views/Games/WordRunner/types.ts`,
`src/views/Games/WordRunner/config.ts`, `src/views/Games/WordRunner/sequence/`
:::

<video controls loop muted playsinline width="720" src="/video/word-runner/run.webm">
  A run through "Caminante, no hay camino": the first lap with the right words glowing, a
  wrong lane that makes the runner stumble and turns the right word green, the recap between
  laps, the final lap with every word moved to a new lane, and the end-of-run summary.
</video>

## How a run teaches the phrase

The order of the words is learned the way a route is learned: by running it again and again
until the moves are automatic. Three things make that work.

- **Each word keeps its lane.** The lane is picked once from a seed made from the phrase id, and
  it is the same on every lap. The same lane never comes up three times in a row, so the path has
  a shape to remember.
- **Each word has a landmark.** A tree, a tower, a ball, a ring or a gem stands beside its gate,
  always the same one for the same word. It is the memory-palace idea: the word is remembered at
  a place.
- **The phrase arrives three words at a time, and the hints fade.** Each new chunk is first run
  with full hints, then with late ones, while the words already learned run with none. Then the
  whole phrase is run without hints, and a final lap moves every word into a different lane.
  Getting through that lap takes knowing the words, not just the moves.

![Four moments of a run: a full hint on the first lap, a wrong lane, the recap between laps, and the shuffled last lap](/img/word-runner/run-beats.webp)

A wrong lane never ends the run. The runner stumbles, the right word is shown in green and
spoken, and the lap is run again with stronger hints on the chunk that went wrong, at most twice
in a row. Each gate's two decoys are chosen to test order as well as meaning: one is a later word
of the same phrase, the other a look-alike such as _sé_ next to _se_.

![The laps of a nine-word phrase, and the lane each word keeps](/img/word-runner/sequence-layout.webp)

The run ends with a summary of how often each word was met and how often its lane was right.

![The end-of-run summary, one row per word with its meaning and score](/img/word-runner/summary.webp)

## Playing

| Input    | Change lane                         |
| -------- | ----------------------------------- |
| Keyboard | Left and right arrows, or A and D   |
| Gamepad  | Left stick or D-pad                 |
| Touch    | Swipe or tap the left or right side |

The Config panel sets the run speed and turns speech on or off. Words are spoken through the
browser's Web Speech API, and the game stays silent where a browser has no voice for the
language.

## Adding a language

A language is one JSON file in `src/views/Games/WordRunner/phrases/`, shaped as the
`LanguagePack` type in `types.ts`:

```json
{
  "language": "it",
  "languageName": "Italian",
  "speechLanguage": "it-IT",
  "phrases": [
    {
      "id": "chi-va-piano",
      "title": "Chi va piano",
      "translation": "Slow and steady wins the race.",
      "words": [
        { "text": "chi", "gloss": "who", "decoys": ["chiù", "che"] },
        { "text": "va", "gloss": "goes", "decoys": ["fa", "vai"] },
        { "text": "piano", "gloss": "slowly", "decoys": ["pieno", "pane"] }
      ]
    }
  ]
}
```

- `text` is the word exactly as it should be read, accents included: _se_ and _sé_ are
  different words, and a decoy may be the other one.
- `decoys` are look-alikes of that word. Two per word is plenty, since the other decoy on each
  gate comes from the phrase itself. A word must never list itself.
- `id` seeds the lane path, so changing it gives the phrase a different path.
- Phrases are memorised word by word, so prefer short sayings, proverbs and lines of verse
  that are in the public domain.

The unit tests in `sequence/gateLayout.test.ts` check the Spanish pack for empty words, duplicate
ids and words listed as their own decoy. Point the same checks at a new pack when adding one.
