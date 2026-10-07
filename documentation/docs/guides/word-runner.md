---
sidebar_position: 25
---

# Word Runner: racing a text, one word at a time

Word Runner is a three-lane race at `/games/WordRunner`, run on Rock Runner's course: the same
seeded track, forest, drawn edges and haze. The player is a ball. Across the track, one gate per
word, float three words in another language, and the player rolls through the one that comes
next in the text. A bot races alongside, and the first ball over the finish line wins.

:::note Source files
`src/views/Games/WordRunner/levels/`, `src/views/Games/WordRunner/types.ts`,
`src/views/Games/WordRunner/config.ts`, `src/views/Games/WordRunner/sequence/`,
`src/views/Games/WordRunner/runner/`
:::

![Four moments of a race: the first German sentence with its hint, the player 20 m ahead after taking the right words, a Spanish race with missed words where the bot's ghost ball pulls ahead, and the end screen of a clean run](/img/word-runner/race.webp)

## Levels

Every language has six levels, one for each step of the Common European Framework of Reference
(CEFR), the scale language exams such as the Goethe-Zertifikat, DELE, DELF and CELI are graded
on. Each level is one connected text about one situation, and the text means the same in every
language, so a level is equally hard whichever language it is run in.

| Level | Situation                              | Words |
| ----- | -------------------------------------- | ----- |
| A1    | Ordering at a café                     | 25–28 |
| A2    | Buying a train ticket                  | 41–47 |
| B1    | Telling a friend about the weekend     | 46–54 |
| B2    | Calling the landlord about the heating | 50–54 |
| C1    | Discussing remote work                 | 45–49 |
| C2    | Reflecting on language and thought     | 43–49 |

A first visit opens German, and after that the start screen opens on the language picked last.
Only A1 is open at first: winning a level's race opens the next one in that language.

![The start screen: the language picker with German selected, A1 won and A2 open, and the four levels after it still closed](/img/word-runner/start.webp)

## How a race works

The level is run once, from its first word to its last. The English of the current sentence
stands at the top of the screen, and the words already passed build the sentence underneath it.
The first sentence glows the right word from afar and shows its meaning, the second glows it
only close to the gate, and from the third on the text is the test.

- **Each word keeps its lane.** The lane comes from a seed made from the level id, so it is the
  same on every attempt and the route can be learned as well as the text. Where a gate opens onto
  a bend, its word takes the inside lane. The same lane never comes up three times in a row.
- **The right word is the faster route, and a wrong one slows the ball.** Just in front of each word
  lies what its lanes run over:

| Feature | Right lane                         | Other lanes                        |
| ------- | ---------------------------------- | ---------------------------------- |
| Ramp    | launches the ball and speeds it up | slows it down                      |
| Rocks   | clear                              | rocks that make the ball stumble   |
| Bend    | the inside line, at full speed     | run wide onto gravel and slow down |

- **The bot plays by the same rules.** It takes the right word at a rate set for each level,
  from 60% at A1 to 80% at C2, and its ramps, rocks and gravel speed it up and slow it down
  exactly as they do the player. A player who reads the text beats it; one who guesses does not.
- **Each effect wears off** back to full speed within about a second and a half.

## The feedback at the end

The end screen says who got there first and by how much, the time against the level's best (the fastest race won on it),
and how many words were right. Then it gives:

- **What the level shows.** A won race clears the level and says what clearing it means, such
  as "You can handle a routine task such as buying a ticket". A lost one says the race has to be
  won to open the next level.
- **One line of advice**, from how the race went: a clean run, a win with mistakes to go over,
  a close loss, or a loss to read up on.
- **The words to go over**: each missed word with its meaning and the word taken instead.
- **The whole text with its English**, after a lost race.

![The end screen after a lost race: the bot's margin, the score, the words to go over and the text with its translation](/img/word-runner/summary.webp)

## Playing

| Input    | Change lane                                                               |
| -------- | ------------------------------------------------------------------------- |
| Keyboard | Left and right arrows, or A and D                                         |
| Gamepad  | Left stick or D-pad                                                       |
| Touch    | The arrow buttons in the bottom corners, a swipe, or a tap on either side |

The Config panel sets the speed of both balls.

## Adding a language

A language is one JSON file in `src/views/Games/WordRunner/levels/`, shaped as the
`LanguagePack` type in `types.ts`, and listed in `LANGUAGE_PACKS` in `levels/languagePacks.ts`,
whose order is the order of the picker. It carries all six levels, translating the same six
texts as the other languages:

```json
{
  "language": "pt",
  "languageName": "Portuguese",
  "levels": [
    {
      "id": "pt-a1",
      "cefr": "A1",
      "title": "No café",
      "situation": "Ordering at a café",
      "sentences": [
        {
          "translation": "Good morning!",
          "words": [
            { "text": "Bom", "gloss": "good", "decoys": ["Boa", "Bem"] },
            { "text": "dia", "gloss": "day", "decoys": ["dias", "tia"], "punctuation": "!" }
          ]
        }
      ]
    }
  ]
}
```

- `text` is the word exactly as it is read, accents and capitals included, with no spaces and
  no punctuation: whatever follows it goes in `punctuation`, which the sentence shows and the sign
  does not. An elision such as French _l'eau_ stays one word.
- `decoys` are two words a learner could take for the right one at that place: a near spelling,
  or the wrong gender, case, tense or person of the same word. Neither may also be correct there.
- Keep each word to about fourteen letters, or it will not fit on a sign.
- `id` is the language code and the level, such as `pt-a1`. It seeds the course and the lanes,
  and keys the best time, so it has to be unique across every language.
- Where the language marks the speaker's gender, pick one for each text and keep the decoys
  clear of the other: the Italian B1 narrator is a woman, the French B1 and B2 one a man.

The unit tests in `levels/languagePacks.test.ts` check every listed pack: the six levels in
order, the same situation and sentence count as the other languages at each level, two decoys
per word that are neither the word nor punctuated, and ids unique across all of them. A new pack
is covered as soon as it is listed, though the test that names the offered languages needs the
new code added.
