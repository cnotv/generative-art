---
sidebar_position: 129
---

# The Body That Turns Round and Back

Why a camera capture would spin the whole rig away from the camera and back inside a second, why
the first three things we tried made it worse, and what a real clip had to say about all of them.

## The complaint, and the wrong suspect

A limb rolling over is the obvious suspect, because a roll is inferred rather than seen. A bone's
swing comes from the detection directly, but how it is turned about its own length has no landmark
of its own and is read from a second direction: which way a bent elbow points, which way a palm
faces. Two directions only ever report an angle within half a turn of zero, so a limb rolling past
that point reads as having jumped to the opposite sign, and the roll applied is a fraction of the
angle rather than the whole of it, which makes the two very far apart.

That story is coherent, and a test built to demonstrate it demonstrates it. On the attached clip,
played through the whole pipeline with its shipped settings, it is not what happens: the joint
speed cap already absorbs a flipped roll, and a guard built on the same reasoning left the count of
single-frame roll flips exactly where it found it while adding an artefact of its own. Every
threshold tried scored worse than no guard at all.

The clip was clear about where the flip actually is. The whole body's facing:

| Frame                         | 270 | 274 | 276 | 278  | 280 | 284 | 290 | 294  | 300 |
| ----------------------------- | --- | --- | --- | ---- | --- | --- | --- | ---- | --- |
| Degrees off facing the camera | -12 | +20 | +68 | +116 | +68 | -20 | -65 | -115 | -14 |

## Why the torso, and why depth

Facing the camera and facing away are the same pose as far as a width is concerned: a hip line
square to the camera projects its full width whichever way the body faces. What separates them is
depth, read across a torso barely wider than the depth error itself, so the detector lands on
either reading from one frame to the next and the rig spins with it. The shoulder line is no
steadier despite being sixty per cent wider, which is what rules out span as the explanation.

Two further things this hid behind:

- **The joint speed cap hides it at playing speed.** A cap spreads a bad reading over several
  frames instead of rejecting it, so at thirty frames a second the spin is a fast slide and at a
  sixth of that it is a spin. The complaint arrived from someone slowing the clip down, which is
  the only reason it was visible at all.
- **Time cannot tell a misread from a turn.** The detector reads "facing away" for five consecutive
  frames that agree with one another. No waiting period separates that from a real turn without
  delaying every real turn by as long. A confirm counter that counts disagreements rather than
  agreements is worse still: it will confirm a reading that is merely bouncing.

## What the geometry says instead

A body cannot get from facing the camera to facing away without passing side-on, and side-on is
exactly where the hip line stops lying across the image and starts lying along depth. That share
is a number every frame already carries, and it is the evidence that a turn is happening at all.

Writing the line as a unit vector makes the relation exact: its side component is the cosine of the
facing and its depth component the sine, so a body turning at some rate moves the side component by
precisely the depth component times that rate. Holding each frame's step to that is no more than
saying a body turns no faster than a body can turn. A square body barely moves, because it has
offered no evidence of turning; a body passing through side-on follows within a frame or two.

Nothing is gated and nothing is decided, which is what keeps it from latching. A reading that stays
put wins eventually whatever the body is doing, and one that bounces cancels itself out. The rate
is taken from whichever of the believed and the observed facings says the body is turned, so coming
back to square is as quick as leaving it; measuring only the observed facing leaves the rig stuck
facing away long after the performer has come back.

## The clock the rate is measured against

A rate limit is only as good as the time it divides by. Slowing a video down does not slow the
performance down, so a pipeline handed wall-clock time believes the performer had six times longer
to move and lets six times as much through — which is why the artefact grew when the clip was
slowed. The capture clock, which already existed for recording so that a slowed video still records
at its real speed, is the right clock for every rate the pose is held to: bone smoothing, the joint
cap, and how fast the body may turn.

## Measuring it at all

None of the above was arrived at by reasoning. Each step was a measurement against the same clip,
detected once through the app's own detectors and kept as a fixture, and each of the first three
ideas was abandoned because the measurement contradicted it.

The metric matters as much as the fix. Counting single-frame flips measures nothing once a speed
cap is spreading them. Counting facing excursions catches real turns along with false ones. What
finally separates them is the physical question: over the frames where the facing swung, was the
body ever turned enough for that swing to be possible? Judged over the departure rather than over
the whole return, and on the median rather than every frame, since the same depth noise that swings
the facing also throws the odd single frame past side-on.
