---
sidebar_position: 25
---

# Word Runner: learning a phrase as a path

Word Runner is a three-lane runner at `/games/WordRunner`, set on Rock Runner's course: the same
seeded track, forest, drawn edges and haze. Each gate across the track shows one word per lane,
and the player runs through the lane holding the next word of a phrase in another language. The
first language pack is Spanish.

:::note Source files
`src/views/Games/WordRunner/phrases/es.json`, `src/views/Games/WordRunner/types.ts`,
`src/views/Games/WordRunner/config.ts`, `src/views/Games/WordRunner/sequence/`,
`src/views/Games/WordRunner/runner/routeAdvantage.ts`
:::

<video controls loop muted playsinline width="720" src="/video/word-runner/run.webm">
  A run through "Caminante, no hay camino" on Rock Runner's forest course: the first lap with
  the right words glowing and a ramp behind the first one, a wrong lane on a bend that is
  revealed in green while the runner slows on gravel, rocks blocking the wrong lanes on a later
  lap, and the recap between laps.
</video>

## How a run teaches the phrase

The order of the words is learned the way a route is learned: by running it again and again
until the moves are automatic. Four things make that work.

- **Every lap is the same course.** A lap restarts at the start of the phrase's own seeded
  course, so each word's gate stands on the same stretch of track, with the same bends, hills
  and trees around it, every time.
- **Each word keeps its lane.** The lane is picked once from a seed made from the phrase id and
  stays the same on every lap. Where a gate opens onto a bend, its word takes the inside lane.
  The same lane never comes up three times in a row, so the path has a shape to remember.
- **The right word is the better route.** Each gate leads onto a ramp, rocks or a bend, as the
  next section explains, so the path the player memorises is also the fastest way round.
- **The phrase arrives three words at a time, and the hints fade.** Each new chunk is first run
  with full hints, then with late ones, while the words already learned run with none. Then the
  whole phrase is run without hints, and a final lap moves every word into a different lane.
  Getting through that lap takes knowing the words, not just the moves.

![Four moments of a run: a full hint with a ramp behind the right lane, a wrong lane on a bend, rocks in the wrong lanes, and the recap between laps](/img/word-runner/run-beats.webp)

## The right word is the better route

Just past each gate stands what its lanes lead onto. The feature belongs to the word's place on
the course, so a word meets the same one on every lap its lane stays put.

| Feature | Right lane                           | Other lanes                        |
| ------- | ------------------------------------ | ---------------------------------- |
| Ramp    | launches the runner and speeds it up | plain track                        |
| Rocks   | clear                                | rocks that make the runner stumble |
| Bend    | the inside line, at full speed       | run wide onto gravel and slow down |

Each effect wears off back to full speed within about a second and a half. A bend is used
wherever the stretch after a gate turns hard enough. Elsewhere, ramps and rocks alternate along
the phrase. The laps are timed, so the route advantages are worth chasing, and the best time
for each phrase is kept in the browser.

A wrong lane never ends the run. The right word is shown in green, and the lap is run again
with stronger hints on the chunk that went wrong, at most twice in a row. Each gate's two decoys
are chosen to test order as well as meaning: one is a later word of the same phrase, the other a
look-alike such as _sé_ next to _se_.

![The laps of a nine-word phrase, the lane each word keeps, and the feature each gate leads onto](/img/word-runner/sequence-layout.webp)

The run ends with the time, the best time for the phrase, and how often each word was met and
how often its lane was right.

![The end-of-run summary: the time, then one row per word with its meaning and score](/img/word-runner/summary.webp)

## Playing

| Input    | Change lane                         |
| -------- | ----------------------------------- |
| Keyboard | Left and right arrows, or A and D   |
| Gamepad  | Left stick or D-pad                 |
| Touch    | Swipe or tap the left or right side |

The Config panel sets the run speed.

## Adding a language

A language is one JSON file in `src/views/Games/WordRunner/phrases/`, shaped as the
`LanguagePack` type in `types.ts`:

```json
{
  "language": "it",
  "languageName": "Italian",
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
- `id` seeds both the course and the lane path, so changing it gives the phrase a different
  route.
- Phrases are memorised word by word, so prefer short sayings, proverbs and lines of verse
  that are in the public domain.

The unit tests in `sequence/gateLayout.test.ts` check the Spanish pack for empty words, duplicate
ids and words listed as their own decoy. Point the same checks at a new pack when adding one.
