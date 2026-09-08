---
sidebar_position: 127
---

# Rig Animator: three pose-capture fixes

Three unrelated but easy-to-conflate fixes to the Rig Animator's camera pose capture and manual
posing: turning the model instead of the viewport camera, a root-follow priority for dragging a
foot or the head, and why the thumb's detected curl looked wrong regardless of sign.

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

## The thumb's curl looked wrong regardless of sign

An earlier fix corrected the _sign_ of the thumb's first joint (its CMC) for the canned preset
poses, negating that one joint's angle since its own rest pose carries a real anatomical tilt
that a positive flexion curls away from the palm instead of into it. That fix held for presets,
but a live-detected thumb curl still looked wrong, curled in an implausible direction and barely
responsive to the real thumb's own movement.

The root cause was upstream of any sign: every finger's first joint is measured as the angle
between the wrist-to-knuckle segment and that finger's own first bone, and for the four straight
fingers this is a reasonable zero-baseline, since a relaxed hand's finger continues roughly the
same direction the wrist-to-knuckle line already points. The thumb's own metacarpal does not
share that property. Even fully relaxed, it sits at a real anatomical angle off the wrist (thumb
opposition), so measuring its first joint's bend the wrist-relative way read a large, constant,
curl-unrelated offset on every single frame, curled or not. That offset then composed on top of
the bone's own already-tilted rest quaternion, a second, unrelated tilt, and no amount of sign
correction on the composed result could make that combination track the thumb's real, live
motion.

The fix changes which landmark the thumb's first joint is measured against: the index finger's
own knuckle instead of the wrist. A relaxed thumb's metacarpal already points roughly toward
that area across the palm, much closer to collinear with it at rest than the far-away wrist ever
is, so the same "wrist-relative for straight fingers, index-knuckle-relative for the thumb"
recipe now gives the thumb a genuine near-zero baseline too. The general lesson: a synthetic test
fixture that builds every finger, thumb included, as points running in a straight line from one
shared origin will pass even when the underlying assumption (that origin is a valid zero-bend
reference for every finger) is false for one of them. The fixture has to encode the same
anatomical relationship the real detector reads, not just produce a plausible-looking straight
hand.
