---
sidebar_position: 127
---

# Rig Animator: pose-capture fixes

Five unrelated but easy-to-conflate fixes to the Rig Animator's camera pose capture and manual
posing: turning the torso instead of the viewport camera (then turning it correctly), a
root-follow priority for dragging a foot or the head, two dead ends chasing the thumb's detected
curl before a real recorded gesture sequence settled it, and a from-scratch hand orientation
feature that needed the same real-footage testing to get right, twice over.

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
