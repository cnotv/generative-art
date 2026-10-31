---
sidebar_position: 130
---

# Balancing the Strudel hints

Each hint in the Strudel Editor was written as a good line on its own, and none had been heard
with the others. Rendering all eight styles offline and measuring them, with every layer of a
style stacked, showed the snippets could each be right and the result still be wrong. No style's
stack left any headroom, and several layers were doing nothing a listener could hear.

## What the measurements found

| Finding                                                               | Why it was invisible                                                                      |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Every stack peaked within 0.2 dB of 0 dBFS, or over it                | each layer alone peaks safely; only their sum clips                                       |
| Hi-hats sat 15 to 20 dB under the kick                                | the sampled hat is quiet to begin with, and the snippets turned it down further           |
| Drum and bass kick fell on the snare                                  | the reason text described the correct beat, so it read as right                           |
| Subs at 33 Hz and 44 Hz, with nothing above                           | they measure as loud, on speakers that cannot play them                                   |
| A filter on a sine, and a filter sweep offered on one                 | a sine has no harmonics, so the filter removes nothing and the code still looks plausible |
| Percussion loudest below 60 Hz                                        | the sample is named for its job, not its frequency content                                |
| A sawtooth bass held through the kick                                 | short notes were described in the reason and never written in the code                    |
| Reversing a clap for stereo moved it off the backbeat in one ear only | reversal is harmless on a melody, and the idea was offered to both                        |

## Two engine facts that cost a pass each

The default level in Strudel's audio engine is 0.8, not 1. Setting a sample's gain to 0.8 therefore
changes nothing, and the first round of level fixes measured exactly as before. Any gain above
0.8 is a boost, which is what the quiet hats needed, and every other value has to be read against
0.8 rather than against 1.

Saturation sits after gain and before the post-gain. Turning a saturated bass down with gain feeds
the shaper less and takes away the harmonics that were the point of adding it, so the bass measured
cleaner and vanished from small speakers. Post-gain lowers the level after the shaper and keeps
them.

```mermaid
flowchart LR
  A[Sound] --> B[Gain] --> C[Filters] --> D[Saturation] --> E[Effects] --> F[Post-gain]
```

## Why the songs are built from masked layers

The hints read top-level statements, and a song that only names its parts in constants showed
every instrument as missing, however many it played. That reader now counts constants too, which
corrects the hints for the older songs, but layers are still the better form here. Each style song
is one block per instrument with a mask holding one number a bar, so a layer can be muted or
rearranged on its own and the review hints have something to work with.

A mask rather than an arrangement of sections keeps each layer's whole life on its own line. The
structure of a song is then readable as a column of numbers, and two layers entering together are
visibly two masks that change on the same bar.

## What is still unknown

Everything above was measured, and nobody has listened to it. The measurements catch clipping,
balance, missing bands and notes outside their chord. They do not catch a groove that feels stiff or
a melody that is dull, so these songs are correct rather than proven good.
