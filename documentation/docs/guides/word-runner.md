---
sidebar_position: 25
---

# Word Runner: racing a text, one word at a time

Word Runner is a race at `/games/WordRunner`, run on Rock Runner's course: the same seeded
track, forest, drawn edges and haze. The player is a ball. Across the track, one gate per word,
float three words in another language, and the player rolls through the one that comes next in
the text. A bot races alongside, or everyone else in the room, and the first ball over the
finish line wins.

:::note Source files
`src/views/Games/WordRunner/levels/`, `src/views/Games/WordRunner/types.ts`,
`src/views/Games/WordRunner/config.ts`, `src/views/Games/WordRunner/sequence/`,
`src/views/Games/WordRunner/runner/`, `src/views/Games/WordRunner/game/`
:::

![Four moments of a German race: the first sentence glowing its next word, the ramp showing under the ball once that word is picked, a wrong pick marked red in the sentence being built, and a new sentence with nothing built yet](/img/word-runner/race.webp)

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

The race is set up in the lobby, which remembers every choice for the next visit:

| Choice     | Options                                                                    |
| ---------- | -------------------------------------------------------------------------- |
| Language   | German, Spanish, French or Italian. A first visit opens German             |
| Level      | the levels open in that language: only A1 at first, and winning opens more |
| Difficulty | the run speed of every ball: Easy 15, Normal 18, Difficult 22, Extreme 25  |
| Steering   | Free, rolling under physics anywhere across the track, or Lanes            |

![The lobby: name and colour, then the Language, Level, Difficulty and Steering dropdowns above the Start button](/img/word-runner/start.webp)

## How a race works

The first race after the course loads opens with its controls drawn over the course: a pulsing
word for each of the four buttons in the bottom corners, each with a hand-drawn arrow down to it,
and "Press any key to start" ("Tap to start" on a touch screen) in the middle. On a touch screen
the buttons are the real ones; elsewhere they are drawn keys. The ball waits on the line until a
key or a tap, which clears the hints. In a room the player counts as ready only once they have
pressed, and the race still goes after fifteen seconds at most.

![The start of a race: Press any key to start across the middle, Steer and Speed up pointing at the left and up keys bottom left, and Brake and Steer pointing at the down and right keys bottom right](/img/word-runner/intro.webp)

The level is run once, from its first word to its last. Only two lines sit over the course: the
English of the current sentence, and underneath it the sentence the words passed so far build, a
wrong pick shown in red with the word it should have been.
The first sentence glows the right word from afar and shows its meaning, the second glows it
only close to the gate, and from the third on the text is the test.

- **Each word keeps its lane.** The lane comes from a seed made from the level id, so it is the
  same on every attempt and the route can be learned as well as the text. Where a gate opens onto
  a bend, its word takes the inside lane. The same lane never comes up three times in a row.
- **The right word is the faster route, and a wrong one slows the ball.** Just past each word
  lies what its lanes run over, hidden until the word is picked and then springing up out of the
  deck in the lane taken alone, so the route never gives the answer away:

| Feature | Right lane                         | Other lanes                        |
| ------- | ---------------------------------- | ---------------------------------- |
| Ramp    | launches the ball and speeds it up | gravel that slows it down          |
| Rocks   | clear                              | a rock that makes the ball stumble |
| Bend    | the inside line, at full speed     | run wide onto gravel and slow down |

![A race in Lanes steering, sped up from a recording: the ball takes the left lane, the wrong word, and gravel springs up out of the deck under it while the bot's ghost, in the right lane, hops off the ramp its right word revealed; the booster arc beside the ball refills from the bottom and turns gold](/img/word-runner/race-penalties.webp)

- **The bot plays by the same rules.** It takes the right word at a rate set for each level,
  from 60% at A1 to 80% at C2, and its ramps, rocks and gravel speed it up and slow it down
  exactly as they do the player. A player who reads the text beats it; one who guesses does not.
- **Each effect wears off** back to full speed within two seconds. A wrong word costs far more
  than a right one gains: a rock all but stops the ball and jolts the camera, gravel off a missed
  ramp takes three quarters of its speed and a wide bend about two thirds, while a ramp's boost is
  a nudge, a quarter faster, not a sprint.
- **With free steering the ball is a real body**, with Rock Runner's rock handling: it is pushed
  along the track up to the difficulty's speed, gathers a little more downhill and keeps the line it is
  put on. A word counts in the lane nearest the ball as it goes through. A ramp also throws the
  ball into the air, a slowing lane takes its speed away at once, and a rock knocks it off the
  deck as well. A soft cushion along each
  wall turns it back before it touches, and a ball knocked through the deck or caught on
  something for a second is set back on the track where it was, clear of the wall.

## The end screen

From the top: a small line saying whether the next level is now open, the result ("Level
complete", or who got there first), the time, gold when it beats the level's best (the fastest
race won on it), and the words right. The buttons come last.

![The end screen of a won race: next level unlocked, level complete, the time and the words right, then Next level, Race again and Levels](/img/word-runner/summary.webp)

## Racing a room

Anyone joining the lobby's room races too, in place of the bot, each ball a ghost in its player's
colour. The host picks the level and the difficulty, and the race starts once everyone has loaded
the course, or after fifteen seconds, so a slow device cannot hold the room at the line. At the end
only the host chooses what comes next.

The sidebar lists the room by distance, each score live. A new order shows only once it has held
for a fifth of a second, so two players neck and neck do not keep swapping places in it.

## Playing

| Button | Key               | Gamepad                                    | Does                                                               |
| ------ | ----------------- | ------------------------------------------ | ------------------------------------------------------------------ |
| ←      | Left arrow, or A  | Left stick or D-pad left                   | Steers left                                                        |
| ↑      | Up arrow, or W    | O (B on Xbox), or left stick or D-pad up   | Speed up: an impulse half as fast again, wearing off over a second |
| ↓      | Down arrow, or S  | X (A on Xbox), or left stick or D-pad down | Brakes                                                             |
| →      | Right arrow, or D | Left stick or D-pad right                  | Steers right                                                       |

On a touch screen ← and ↑ are bottom left, ↓ and → bottom right, and a swipe or a tap on either
side of the course steers too. With free steering the ball turns for as long as a steer is held;
with lanes, each press moves it one lane. Holding the brake brings the free ball to a stop and
holds it there, even on a slope, and runs the lanes ball at under half its speed.

Speed up can be used once every three seconds. A see-through arc hugging the left of the ball
fills from the bottom as it recharges and turns gold once it is ready.

![The ball mid-race with the gold booster arc hugging its left side, ready to use](/img/word-runner/booster-arc.webp)

The Config panel tunes the race as it runs:

| Setting              | Does                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------ |
| Run Speed            | starts at the difficulty's speed and tunes it for every ball                         |
| Booster Opacity      | how see-through the booster arc is; at 0 it is hidden                                |
| Booster Gap          | how far the arc stands off the ball                                                  |
| Guessed Words Height | moves the English and the sentence built so far down the screen, in hundredths of it |

![The Config panel open beside a race, with the Run, Booster and Words sections, and Guessed Words Height at 30 moving the English down to the middle of the course](/img/word-runner/config-panel.webp)

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
