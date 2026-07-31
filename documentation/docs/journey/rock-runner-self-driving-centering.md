---
sidebar_position: 116
---

# Rock Runner: a self-driving centering assist

## The problem

Rock Runner's track is an endless, procedurally generated ribbon: heading and
height are each a sum of sine terms evaluated against the distance travelled,
so the curve shape is a pure function of the seed (see
[Rock Runner's endless track](./rock-runner-endless-track.md)). Sharp bends
are common, and a player who steers a beat late clips the outer wall. "Self
driving" is a Config-panel toggle, on by default, that continuously tries to
hold the rock to the middle of the track until the player takes over.

## Velocity, not impulse

The rock's own steering is impulse-based: a discrete push added to whatever
momentum the rock already carries, capped by a lateral speed limit and a wall
standoff so the push can never overpower the body faster than the physics
lets it accelerate. An assist built the same way — an added corrective
impulse — was tried first, but an added force always has to fight whatever
momentum is already there; a rock drifting hard toward a wall needs several
frames of accumulated impulse before its actual velocity turns around.

The assist instead commands the rock's lateral velocity directly:

```mermaid
flowchart LR
    A[Rock's current offset from centreline] --> B[autopilotLateralVelocity]
    B --> C["Clamped target lateral velocity, opposing the offset"]
    C --> D["body.setLinvel: forward + vertical kept, lateral replaced"]
    E[Player presses left/right] -->|turns autopilot off| D
```

Each frame, while the toggle is on, the rock's current velocity is
decomposed into its forward and lateral components against the track's local
frame (the same `sample.forward` / `sample.right` vectors steering already
uses). The forward and vertical (gravity, jump) components are left exactly
as they are; only the lateral component is replaced outright with a target
value proportional to, and opposing, the rock's current offset from the
centreline — a proportional controller, not a nudge. Because it's a direct
velocity command rather than a force, the correction is felt immediately
rather than building up over several frames, and a jump or a wall bounce
still behaves exactly as it would without the assist, since only the lateral
axis is touched.

## Handing control back, not fighting for it

An earlier version ran the centering command every frame and let the
player's own steering impulse apply on top of it, so the two blended
continuously. In practice that meant the assist was always at least a
little bit active, second-guessing a player who was already steering
exactly where they wanted to go — a hands-off default should get out of
the way the moment the player takes the wheel, not keep contributing
alongside them.

`autopilot` now turns itself off the instant `steerDirection` reads
anything but zero — the very first frame the player presses left or right.
It's a one-way latch: once handed back, control stays with the player until
they re-enable the toggle from the Config panel themselves, it doesn't
reactivate the moment the player lets go of the key. The rock is a normal
dynamic physics body throughout either way: collisions, restitution and
jumping are unaffected, since the assist only ever overwrites the lateral
component of velocity, one axis out of three.

## Where it lives

Rock Runner's tunables already follow one pattern: a single reactive
`RockConfig` object is read directly by the run loop every frame, and
registered into both the elements panel and the Config panel from the same
field schema. The toggle is one more field on that object —
`autopilot: boolean`, defaulting **on** — following the boolean-field
convention already used by Maze Game's own auto-mode toggle. The correction
gain and maximum centering speed are tuned constants, not exposed controls:
this is one on/off option, not a tuning surface.

## Verification

`rockMotion.test.ts` covers `autopilotLateralVelocity` directly (sign
correctness — an offset to one side commands velocity toward the other —
and clamping to the maximum centering speed), plus the small
`lateralPushAllowed` / `clampLateralMagnitude` helpers pulled out of the
player's own `steerImpulseMagnitude` along the way, with the existing suite
serving as a regression check that player-only steering is unchanged. In the
browser: confirm the Config panel's checkbox starts checked; watch the rock
hold to the middle through a run of curves with no input; tap left or right
and confirm the checkbox unchecks itself the instant the key is pressed and
the rock stays under manual control from then on.
