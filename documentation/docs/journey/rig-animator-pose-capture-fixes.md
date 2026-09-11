---
sidebar_position: 127
---

# Rig Animator: pose-capture fixes

A cluster of unrelated but easy-to-conflate fixes to the Rig Animator's camera pose capture and
manual posing: turning the torso instead of the viewport camera (then turning it correctly), a
root-follow priority for dragging a foot or the head, two dead ends chasing the thumb's detected
curl before a real recorded gesture sequence settled it, a from-scratch hand orientation feature
that needed the same real-footage testing to get right twice over, and, once undriven bones
started holding their last pose instead of resetting every frame, an invariant that reset had
been quietly propping up the whole time.

## Torque, not rotate: turning the torso

Matching a captured photo's viewing angle first turned the 3D view's own camera around the
model, so the model stayed square to a fixed rest orientation while the camera swung to the
angle the photo implied. That fights manual orbiting: every applied frame (continuous for a
live webcam) yanked the camera back to the estimated angle, undoing whatever the person driving
the tool had just done with the mouse. Turning the whole model instead, rigidly, fixed that, but
read as the entire rig spinning on the spot like a turntable rather than a body turning, feet
and all. Retargeting the same yaw onto the torso bone alone leaves the hips and feet planted and
only the chest, arms and head twist, the way a real turn reads.

That torso bone doubles as the root of the head-aim IK chain (aiming the head at a detected face
position bends this same bone), so it can already carry a real, camera-driven pitch before the
torque ever runs. The first version set the bone's own Euler Y component directly, which was
exactly as safe as it had been on the untouched top-level model (where X and Z were always
zero) and not remotely as safe here: once the head-aim solve had already given the bone a
substantial X, composing an unrelated Y write on top of it read as the body flipping rather than
turning, confirmed against a real recorded gesture sequence (the person's hand frequently
crosses in front of their own face, which is exactly when the head-aim solve's own target gets
least reliable). The fix composes the torque as a world-space quaternion twist around the true
vertical axis instead, on top of whatever orientation the bone already has, the same
current-independent composition `ikApplyWorldDirectionToBone` already uses elsewhere in this
package: predictable regardless of what else already rotated the bone, rather than reading the
result as one more Euler component fighting whatever the other two already were.

## Root-follow is a drag-time behavior, not a pose-application one

Dragging a foot or the head now also translates the skeleton's root bone by however far that
end effector still has to travel, so the two-bone (or spine) solve only has to close a small
residual gap instead of bending the whole way to the target. A leg carries the body's weight and
a head sits on the spine, so in life, pulling either moves the body along with it; the old
behavior kept the hips fixed and let the knee or neck absorb the entire drag, which read as
excessive, constant bending for anything but a small adjustment.

The trap: camera pose capture reuses the exact same drag-to-chain solve for every mapped bone,
applying several independent targets (both feet, the head, both hands) in one pass per detected
frame. Root-follow fires per bone by design, so turning it on unconditionally meant the second
limb processed in that pass moved the root out from under the first limb's already-correct
target, and the third out from under the first two, corrupting the whole-body reconstruction in
a way that only showed up as a subtly wrong T-pose, not an error. The existing pose-mapping test
suite caught this immediately once it ran end to end, well before it could reach a browser.

Root-follow is therefore an opt-in the caller passes explicitly: on for an interactive
single-bone drag (the mouse, or a pole-hint re-aim), off for camera pose capture's own loop over
several simultaneous targets. The lesson generalizes: a shared low-level solve reused by both an
interactive single-target caller and a batch multi-target caller cannot safely default a
whole-body side effect to on, even when that side effect is exactly right for the interactive
case.

## The thumb: two dead ends, then a way to actually check

An earlier fix corrected the _sign_ of the thumb's first joint (its CMC) for the canned preset
poses, negating that one joint's angle since its own rest pose carries a real anatomical tilt
that a positive flexion curls away from the palm instead of into it. That fix held for presets,
but live tracking still looked wrong against a real camera: curled in an implausible direction,
barely responsive to the real thumb's own movement.

**First dead end.** Reasoning from a plausible-sounding anatomical argument (the four straight
fingers use the wrist as their first joint's zero-bend reference because a relaxed finger
continues roughly the same direction the wrist-to-knuckle line points, but the thumb's own
metacarpal sits at a real angle off the wrist even relaxed, so the same reference should read a
large, curl-unrelated baseline), the reference landmark was swapped to the index finger's own
knuckle. Tried against a live feed, it made the thumb curl worse, not better: further to the
wrong side of the hand than before. The reasoning was self-consistent and still wrong.

**Second dead end.** With two failed reference points, the mechanism itself looked suspect:
composing any nonzero magnitude around a single fixed local axis, on top of a joint whose rest
pose already carries a real tilt on every axis, seemed like it could swing the bone toward
whatever direction that axis happens to point rather than toward the palm. The thumb's first
joint was left undriven entirely, frozen at its own rest pose, trading the wrong-side flip for a
thumb that mostly just stopped tracking. Reported back plainly: it no longer looked broken, but
it no longer followed a real thumb either.

**What actually settled it**: a real recorded gesture sequence (a hand counting on camera) fed
into the live pipeline through Chromium's fake video-capture flag
(`--use-fake-device-for-media-stream --use-file-for-fake-video-capture=<file>`), driving the
exact same code path a real webcam would, with no code changes needed to test it. That is a
categorically better source of truth than a synthetic landmark fixture or a plausible-sounding
argument about which reference point should behave better: a synthetic fixture only proves an
assumption self-consistent, never that the assumption matches anatomy. Reading the composed
bone rotation at intervals through the clip showed the _original_ wrist-referenced version
(the one before either dead end) producing smooth, bounded values a few tenths of a radian off
rest, never near the extremes that would send it to the wrong side of the hand; extracted stills
from the same timestamps, held up against the rig's own pose at that instant, showed the overall
hand shape tracking a closed fist and a spread-open hand both reasonably. The wrong-side flip
traced specifically to the index-knuckle reference point, not to composing a live angle onto
this joint at all. The fix landed back where it started, this time with recorded evidence instead
of a plausible argument for why it should work.

The fixture lesson still holds independently: a synthetic test that builds every finger, thumb
included, as points running in a straight line from one shared origin passes even when the
underlying assumption (that the origin is a valid zero-bend reference for every finger) is false
for one of them. It just was not, on its own, enough to tell a plausible-but-wrong fix from a
plausible-and-right one; only a real gesture sequence run through the real pipeline could.

## Hand orientation: driving a bone's rotation that never moved before

Before this, a detected hand only ever drove two things: where its wrist bone sat (the arm's own
two-bone reach) and how curled each finger was. The hand bone's own rotation, which way the palm
faces, was never touched by any of it — position and curl both leave the dragged bone's own
local transform alone by design, only ever rotating its ancestors or its children. Turning that
into a real feature needed two attempts, each caught by the same real-footage harness the thumb
fix used.

**The first version was a handedness bug**, caught by a synthetic unit test before it ever
reached a browser. Orienting a bone from two independent directions (along the fingers, across
the knuckle row) needs a third, their cross product, to build a complete basis; `along × across`
gives a vector such that `(along, across, normal)` is a right-handed triple in that order.
Building the basis as `(along, normal, across)` instead, an easy transcription slip, silently
swaps two axes: a reflection, not a rotation, and decomposing a reflection into a quaternion
(which can only ever represent rotations) produces something with no defined meaning rather than
an obvious error. The bone ends up perpendicular to where it should point, not merely wrong; a
minimal test that constructs a known basis and checks the bone's own resulting world directions
against it catches this immediately, since the synthetic test doesn't require anatomical realism
to expose a pure linear-algebra mistake, unlike the thumb's reference-point question.

**The second version was the same antipodal instability the torso torque hit**, independently.
The very first cut aligned the hand's own current wrist-to-middle-knuckle direction to the
detected one with `ikApplyWorldDirectionToBone`, the same primitive the arm and leg IK chains
already use safely. The difference: in those chains, "current" is the chain's own rest geometry,
essentially fixed frame to frame. Here, "current" was wherever the arm's own independently
re-solving position IK happened to leave the hand pointing, which has no relationship at all to
the detected hand orientation — on some frames of the real recorded clip the two ended up close
to antipodal, the exact degenerate case `setFromUnitVectors` cannot resolve consistently, and the
hand (visibly, in extracted screenshots) snapped between wildly different rotations frame to
frame. The fix builds the bone's target world orientation directly from the two detected
directions and the rig's own fixed rest-local equivalents (read straight off the finger bones'
own rest positions, since they are direct children of the hand bone and so need no world
transform at all), with no reference to wherever the bone currently happens to be pointing. The
general lesson, stated once for both this and the torso torque: `ikApplyWorldDirectionToBone`'s
minimal-rotation-from-current approach is only as stable as "current" is close to "desired"; the
moment a caller's own "current" is itself driven by something unrelated to the target, building
the result directly is the safer choice, not a minor style preference.

## The reset a global reset had been quietly guaranteeing

Removing the per-frame reset to rest (so an undriven bone holds its last pose instead of
flickering back to rest and forward again) surfaced a second, unrelated bug the reset had been
masking the whole time: the head-aim solve and the torso torque, composed together on the same
bone, would occasionally leave the model bent over or twisted into a pose with no relation to
what the camera actually showed, and the bad pose would then simply sit there, held rather than
overwritten on the very next frame the way it always used to be.

The mechanism was already documented, just not where it could be checked against this call site.
`ikApplyWorldDirectionToBone`'s own doc comment names two chains as safe because their "current"
is each chain's own rest geometry, reset immediately before every solve. That was true for the
two-bone chains (a dragged hand or foot resets its own local position from `restPoses` before
`ikSolveTwoBoneChain` runs) and had, before this session, also been true for the one-bone aim
that drives the head: the reset every captured pose did to the _whole rig_ first meant the torso
bone always started an aim solve from its own rest orientation too, incidentally, without the
aim's own call site ever asking for that itself. Deleting the whole-rig reset removed that
incidental guarantee along with the flicker it was meant to fix, and nothing was left resetting
the torso bone's rotation before the aim solve read its "current" direction from it. Once that
"current" carried forward whatever the previous frame's aim, or the torque composed after it, had
left behind, the shortest-rotation construction was reading from an increasingly arbitrary
starting point rather than a fixed one, occasionally landing far from anything a real turn of the
head would produce, and holding that instead of correcting itself the next frame.

The fix adds back exactly the reset the aim's own contract always assumed, but scoped to the one
call site missing it (`applyGizmoDragToChain`'s one-bone-parent branch, right where the dragged
bone's own position was already being reset) rather than to the whole rig: the torso bone's
rotation is set back to rest immediately before the aim solve runs, every time the head is
actually driven that frame. That, in turn, meant the torso torque no longer needed the delta
bookkeeping an earlier version of this fix added (twisting only by the change since the last
applied frame, to avoid winding up further every frame): once the aim underneath it reliably
starts from rest each time, applying the full estimated yaw on top is correct again, the same
simple form the very first version used before any of this. The general lesson: a reset applied
broadly, "to the whole rig" or "every frame," is easy to mistake for incidental cleanup when it
is actually load-bearing for a specific downstream assumption. Narrowing that reset to only the
bones actually needing a fresh pose is the right fix for the flicker it caused, but it also
removes whatever else was quietly relying on the broad version, and those call sites need their
own, scoped reset added back explicitly rather than assumed.

## An assumption that held almost always, until it didn't

The delta-bookkeeping fix above was itself replaced within the same session, by real feedback
against real footage catching what reasoning about the "almost always" case had missed. Its logic
depended on the head aim resetting the torso bone every frame the torque also ran; that holds
whenever the head is confidently and plausibly detected in the same frame as the shoulders, which
is nearly always true, but "nearly always" is not "always," and a single frame where it wasn't
left the delta bookkeeping computing a total against a baseline the bone no longer actually had,
under-rotating by however much the previous frame contributed. The general version of this: a
value derived from "the last time X ran" needs X to run essentially in lockstep with the value's
own consumer, and a codebase evolving two related solves independently can quietly break that
lockstep in a way no single frame of testing surfaces. The fix removed the dependency entirely,
resetting the torso bone to rest unconditionally right where the delta was previously tracked
starting from, before either solve gets near it. Absolute application on top of that fixed
baseline needs no bookkeeping at all, the same simplification a fixed reset already brought the
head aim.

## Scaling a detector's confident nonsense into an absurd position

Fixing the winding-up bug did not fix the report that prompted looking at it again: the model
still, and now more visibly, snapped into inverted, flung-apart poses during exactly the same
kind of stretch that broke the head aim, a close-up hand with no real body in frame. Two
increasingly specific guesses, checked directly against the numbers rather than assumed, is what
it took to find where.

**First guess: the hip landmarks are nearly coincident.** A detector confidently misreading a
hand as a torso seemed likely to place the "hips" essentially on top of each other, and dividing
the rig's own real hip width by a landmark-space span that tiny would blow the resulting scale up
enormously. Raising the degenerate-span floor from a literal near-zero guard (`1e-6`, only large
enough to avoid an actual division by zero) to something a real hip span is never close to made
the reported hip scale look almost identical across several bad frames, a coincidence that read
as confirmation. It was the wrong mechanism: logging every value feeding the target computation
directly showed the _shoulder_-based scale, driving the head and hands that stayed visually
correct throughout, sitting in the exact same range as the supposedly-degenerate hip scale. Both
were simply large because the loaded rig itself is at native FBX scale, roughly a hundred times a
typical glTF asset's; a scale factor in the hundreds is normal for this rig, on any bone, not a
symptom of anything.

**Second guess, this time checked against the actual numbers first:** working the real logged
values through the target formula by hand for one bad frame put the computed ankle target above
the rig's own shoulder height and off to the side by several times its shoulder width. That is
where the flung-apart pose was coming from, and it had nothing to do with the scale factor's
magnitude: an ordinary-looking scale multiplying a garbage landmark offset still produces a
garbage world position, just not a suspiciously large number that stands out on its own. The
fix that actually resolved the reported symptom mirrors the head-below-the-shoulders check
already in place, applied at the other end: a foot, knee-pole or hip target that maps _above_ the
shoulders is anatomically impossible in any pose this feature supports and is dropped, regardless
of how ordinary the scale and the hip anchor that produced it looked on their own.

The lesson generalizes past this one feature: a derived value can look unremarkable at every
individual step (a normal-ish scale, a landmark within its own visibility threshold, a hip pair
technically below the shoulders) and still combine into a physically absurd result, because
none of those individual checks constrain the _combination_. Two visually near-identical
first-hypothesis fixes (a stricter span floor, then a stricter same-shaped hip-position check)
both shipped, tested, and looked plausible before the real numbers, read directly rather than
inferred from a plausible mechanism, showed neither was where the actual bug lived.

## A capable pipeline that still reads as barely moving

A report that live-tracked fingers "barely move" looked, at first read, like it should be the
same class of bug as everything above: something clamping or damping the signal before it
reaches the rig. It wasn't. Logging the raw per-joint curl angle (before any composition, any
smoothing, any scaling) directly against a real recorded clip showed real, substantial motion:
the thumb's outer two joints reached 0.632 and 0.839 radians across the clip, at or past the
canned "curled fist" preset's own reference values for those same joints (0.6 and 0.5). A
synthetic unit test independently confirmed the underlying geometry, `into.angleTo(outOf)`
between three landmarks, has no structural ceiling either: given a clean 90-degree fold it
reports exactly that, regardless of which finger or which joint.

What stayed narrow was one specific number: the thumb's own first joint (the CMC, closest to the
wrist) topped out at 0.486 across the whole clip, well short of the same preset's 0.7 for that
joint, even during a gesture the recording showed visibly closing toward a fist. The presets
were never derived from any geometric measurement; they are values a person picked by eye,
adjusting a slider until the 3D model looked like a closed fist. There is no guarantee a real
hand's own geometry, measured the same way live detection measures it, ever produces that same
number for what looks like an equivalent gesture, and for this joint specifically it mostly
didn't.

The fix is a scaling factor, `CAMERA_HAND_SENSITIVITY_DEFAULT`, applied to every detected joint's
curl angle before it drives the rig, the same shape `CAMERA_REACH_MULTIPLIER_RANGE` already gives
body-pose reach for exactly the same underlying reason: a rig's own proportions, or here a
preset's own hand-picked drama, do not have to match what a real body's geometry naturally
produces, and a fixed escape-hatch multiplier is the simpler fix over trying to make the
detection itself somehow guess the "correct" scale. The lesson distinguishes this from the
sections above it: not every report of "the pipeline isn't working" is a bug in the pipeline.
Confirming the underlying capability first, with a real number rather than an assumption, is
what kept this from becoming a fourth speculative patch to code that was already doing exactly
what it measured.

## A safety clamp that traded a real capability for a rejected false positive

The yaw clamp above (`MAXIMUM_PLAUSIBLE_YAW`) fixed a real bug: a hand filling the frame could
be misread as a torso turned to some arbitrary, often near-180-degree angle, snapping the model
into an unrelated pose. The fix at the time was a flat magnitude cap at 100 degrees, past which
any reading was rejected outright. It worked, but it was a broader fix than the bug needed: it
rejected every large angle, not just the false ones, so a subject genuinely turning most of the
way around in front of the camera lost torso tracking at exactly the same threshold a hand
filling the frame did. Reported back as "no node ever reaches anywhere near a full turn," across
every bone downstream of the torso as well as the hips-and-shoulders read directly.

The two cases turn out to differ on more than the angle itself: a hand filling the frame has no
reason to also produce a confident pair of hip landmarks, where a subject actually turning their
back to the camera does. Requiring that corroborating signal past the clamp threshold, rather
than rejecting the angle outright, keeps the original false positive rejected (no hips detected)
while letting a real full turn read all the way around (hips detected, same as the shoulders).
The general shape carries beyond this one case: a flat threshold on a single signal is often a
proxy for "this reading is probably not real," and reaching for a second, independent signal that
the false case lacks but the real case has is usually a tighter fix than moving the threshold.

## A reference value nobody had actually looked at

A live-detected thumb still curled to an unnatural, splayed-out position even after the earlier
sensitivity fix scaled its raw angle up to reach the canned Fist preset's own reference. The
first useful step was ruling out the camera pipeline entirely: applying the bundled Fist preset
directly, with no camera, no detection, no `applyHandOrientation`, produced the exact same wrong
thumb. Whatever was wrong lived in the preset's own reference value, `CURLED_THUMB`, not in
anything reading a real hand.

That value had one thing going for it that felt like proof: a unit test asserting the thumb's tip
lands closer to a palm reference point after applying it, passing cleanly. The test's geometry was
a straight-line approximation, though, every thumb joint's local position set to `(0, 1, 0)`, the
same simplification an earlier fixture used for the finger-curl reference point and was
explicitly flagged as a trap back then. Reading the bundled model's own real thumb joint
positions and plugging them into the same test did not change the outcome: distance to the palm
reference shrank whether the CMC curled 0.35 radians or 1.0, monotonically, with no minimum in
between. A single point-distance metric cannot distinguish "wraps naturally" from "swings past
it and keeps getting numerically closer from the other side" — realistic geometry fixed one blind
spot in the fixture but not the one that actually mattered here.

What settled it was the same tool this whole investigation kept returning to: screenshots of the
real model. Sweeping the CMC angle downward from the original 0.7 (0.4, then 0.35, then 0.3) and
capturing the Fist preset at each value showed the thumb visibly overshooting into the splayed
position somewhere above 0.4, and sitting naturally alongside the curled fingers at 0.35 and
below. Re-running the same real recorded clip that first surfaced the bug, unmodified, against
the corrected value confirmed it: the live-detected thumb, still scaled by the same sensitivity
multiplier as before, now tucks in rather than splaying out, no further changes needed to the
detection or scaling logic at all.

The lesson is not "write a better geometric test," because no single-point distance check was
ever going to capture "looks like a natural fist" — that is fundamentally a visual property, not
a distance. It is instead that a passing test proves the code did what the test measured, never
that the test measured the thing that actually matters, and a magnitude tuned by eye against the
real asset belongs in the code as a value someone looked at, not as a number a geometric proxy
happened to also accept.
