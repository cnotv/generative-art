---
sidebar_position: 99
---

# Word Runner: racing a clock that physics does not share

What it took to make a ball race fair: the order a word's route takes effect in, a rival that
covers the player, and a physics ball racing a bot that keeps a different time.

## A perfect run lost to the bot

Each word's route piece first stood a few metres past the word, and took effect in whichever lane
the ball was in when it got there. A player steers for the next word as soon as a gate is passed,
so by the time the ball reached a piece it was often already moving to the next lane: a run with
every word right was judged in the wrong lanes, missed its ramps and hit rocks. The verdict now
belongs to the word, settled in the lane the ball went through it in, and the piece is only what
that verdict looks like. Once the pieces became pure illustration they could also stay hidden
until the word is picked, so the route never gives the answer away.

![A German race: the ramp shows under the ball only once its word, Guten, has been picked](/img/word-runner/race.webp)

## Two balls in one place

Every ball starts in the centre lane, and the bot drawn after the player simply covered it. The
rival is a ghost: see-through and writing no depth, so the player's ball always shows through.

## The physics ball ran in slow motion, then shot off the course

Free steering makes the player's ball a real body, with Rock Runner's rock handling, while the bot
and the race clock still advance by frame time. Three faults surfaced in order, each hidden by the
one before:

| Symptom                                                  | Cause                                                                                                                                                                                                                                                                                             |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The ball fell behind the bot on a slow device            | The scene loop steps the world once per tick at a fixed sixtieth of a second, whatever the tick lasted, so physics time runs slower than the clock whenever the frame rate drops. The loop's own delta is the last animation frame alone, which on a fast display is less than a tick stands for. |
| Stepping once by the whole tick sent it through the deck | A long step under twenty times gravity adds more downward speed in one step than the deck is thick                                                                                                                                                                                                |
| The ball overshot its speed and a ramp threw it 50 m up  | The package builds a ball's collider with a mass and then a density, and the density wins, so the mass passed in never applies: the ball weighed under 6 rather than 100, and every impulse tuned for 100 was eighteen times too strong                                                           |

What holds: time each tick directly, take the fixed step as often as the tick lasted, and set the
mass on the collider after the package has built it. With the push also capped at what the speed
limit still allows, a long frame can no longer throw the ball past it.

Rock Runner's weight tuning (see [Rock Runner weight](./rock-runner-weight.md)) was measured
through its panel, which sets the collider's mass directly, which is why the package default went
unnoticed there.

## A ball that drifts to the wall stops there

Pushed only along the track, an unsteered ball keeps its old heading through every bend, drifts
outwards and grips the wall hard enough to stall, and then rolls back down whatever hill it was
on. Rock Runner leaves this to the player's steering. Here the ball sheds its sideways speed while
it is not steered, so it holds the line it was put on, and its push is strong enough to out-climb
the heavy gravity, since a rolling ball spends part of any push on spin.

## The drawn ball rolled backwards

The track's forward is a ball's own negative Z, so rolling onwards is a negative turn about its X
axis. The drawn balls turned the other way, which reads at once in motion and not at all in a
still frame.

## Gendered narrators

Where a past participle carries the speaker's gender, the decoy of the other gender would also be
correct. Each text picks one narrator and keeps every decoy clear of the other: the Italian B1
narrator is a woman, the French B1 and B2 one a man.
