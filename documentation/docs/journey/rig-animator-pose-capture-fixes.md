---
sidebar_position: 127
---

# Rig Animator: three pose-capture fixes

Three unrelated but easy-to-conflate fixes to the Rig Animator's camera pose capture and manual
posing: turning the model instead of the viewport camera, a root-follow priority for dragging a
foot or the head, and two dead ends chasing the thumb's detected curl before a real recorded
gesture sequence, run through the real pipeline, showed which fix actually held.

## Turning the model, not the viewport camera

Matching a captured photo's viewing angle used to turn the 3D view's own camera around the
model, so the model always stayed square to a fixed rest orientation while the camera swung to
the angle the photo implied. That fights manual orbiting: every applied frame (continuous for a
live webcam) yanked the camera back to the estimated angle, undoing whatever the person driving
the tool had just done with the mouse.

The fix keeps the same yaw estimate (still the one camera-relative detail a single photo's body
landmarks can support, since MediaPipe's world landmarks carry no cue about the original
camera's distance or zoom) but applies it to the model's own rotation instead. The viewport
camera is never touched by pose capture again; orbiting stays entirely under manual control
throughout a live session. The same rotation formula that used to offset the camera around the
model's bounding-sphere center now turns the model itself by that angle, which reproduces the
same relative on-screen appearance whenever the camera sits at its default framing, the common
case right after loading a model or closing the capture panel.

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
