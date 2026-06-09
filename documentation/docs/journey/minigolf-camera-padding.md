---
sidebar_position: 101
---

# Minigolf: Padding the Camera Fit Around the Track

`fitCamera()` (in `useMinigolfGame.ts`) frames each hole from directly overhead by computing how high the perspective camera must sit so the whole green is visible. Without any allowance for the wall thickness or breathing room, the wall perimeter rendered flush against the canvas edge — the track looked clipped, with no separation between the play area and the viewport border.

## What the camera height is solving for

A perspective camera's vertical field of view, `fov`, defines a cone. At a given height `y` above the ground, the cone's half-angle `fov / 2` determines how much world-space extent fits inside the frame: `extent = y · tan(fov / 2)`. Inverting that gives the height needed to fit a target extent:

```
y = extent / tan(fov / 2)
```

The hole has two extents to satisfy — depth (Z) and width (X) — and the camera's horizontal field of view is the vertical one scaled by the canvas `aspect` ratio (`width / height`). So two candidate heights are computed, one per axis, and the larger wins (the binding constraint):

```ts
const heightForDepth = halfDepth / Math.tan(halfFovRad)
const heightForWidth = halfWidth / (aspect * Math.tan(halfFovRad))
camera.position.y = Math.max(heightForDepth, heightForWidth)
```

Whichever axis is _not_ the binding constraint ends up with extra slack — only the binding axis sits at the exact computed extent.

## Where the perimeter gap comes from

`halfWidth` and `halfDepth` aren't just half the green's `width`/`depth` — each adds `WALL_THICKNESS` (so the wall's outer face, not the green's edge, is the true boundary) plus `CAMERA_FIT_PADDING`:

```ts
const halfWidth = ground.width / 2 + WALL_THICKNESS + CAMERA_FIT_PADDING
const halfDepth = ground.depth / 2 + WALL_THICKNESS + CAMERA_FIT_PADDING
```

`CAMERA_FIT_PADDING` is the only term that exists purely for visual breathing room — it pushes the binding axis's target extent outward, which raises the camera, which in turn leaves a margin of empty space (background/floor beyond the walls) between the wall perimeter and the canvas edge on _every_ side, not just the binding axis.

## Tuning it

A `CAMERA_FIT_PADDING` of `0.6` produced almost no visible gap — the wall on the binding axis sat right at the frame edge. Raising it to `1.5` adds roughly that many world units of clearance around the binding axis (and proportionally more on the slack axis, since the same camera height applies to both). The constant is a single tunable knob: lower values frame the track tightly (more pixels devoted to gameplay), higher values trade some of that density for a clearer separation between the playfield and the surrounding viewport.

This is independent of the earlier fix that removed the `CAMERA_OFFSET_TOPDOWN[1]` height floor from the `Math.max(...)` call — that floor was a _minimum_ camera height that, for small holes, overrode the fit computation entirely and zoomed the view out far beyond the track. Removing it let the fit formula govern framing for every hole size; `CAMERA_FIT_PADDING` then governs how generous that framing is.
