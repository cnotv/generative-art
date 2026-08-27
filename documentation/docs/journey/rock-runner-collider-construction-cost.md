---
sidebar_position: 117
---

# Rock Runner: what a trimesh collider costs, and what would be cheaper

This is a deep dive into one lever identified while chasing a mobile FPS
drop at track/scatter chunk boundaries, deliberately _not_ pulled: replacing
the deck's physics collider. The streaming fix that shipped alongside this
write-up (staggering scatter areas, capping chunk builds to one per frame —
see the commit on `perf/rockrunner-chunk-streaming`) addresses _when_ and
_how often_ expensive work happens. This document is about the other half:
making the expensive work itself cheaper, which nothing in that fix touches.

![The debug panel over Rock Runner, showing the frame budget a trimesh collider rebuild has to fit inside](/img/rock-runner/debug-panel.webp)

## Where the cost actually is

Every new track chunk (`trackChunks.ts`, `buildChunk`) does two kinds of
work: building visual meshes (deck, terrain, walls, the ink stroke), and
building one physics collider for the deck and walls together:

```typescript
const colliderGeometry = buildSweepGeometry(
  colliderStations,
  deckWithWallsCrossSection(context.width, context.wall, DECK_THICKNESS)
)
const body = context.world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
addTrimeshCollider(context.world, body, colliderGeometry, DECK_FRICTION, DECK_RESTITUTION)
```

`addTrimeshCollider` hands Rapier raw triangle soup —
`RAPIER.ColliderDesc.trimesh(vertices, indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES)`.
That single call is the suspect: of everything a chunk build does, it's the
only step that isn't "make some buffers and hand them to Three.js" — it's a
physics-engine construction step that has to build an acceleration
structure before the collider is usable at all.

## What a trimesh collider is, and why the deck uses one

A **trimesh** collider is exactly what it sounds like: an arbitrary soup of
triangles, no assumptions about shape. To answer "does this ball touch this
mesh" efficiently, Rapier can't test every triangle every physics step — it
builds a **BVH** (bounding volume hierarchy) once, up front: a tree of
nested bounding boxes that lets a query discard most of the mesh in a few
comparisons instead of checking every triangle. Building that tree is what
`ColliderDesc.trimesh(...)` actually does under the hood, and it's genuinely
the most expensive of Rapier's collider constructors — it's also the only
one general enough to represent _anything_, which is exactly why it was
reached for here.

The deck's cross-section (`deckWithWallsCrossSection`) is a fixed profile —
flat deck, inset lip, two vertical walls — swept along a path that curves
in heading, banks, and rises and falls in height, all at once
(`buildSweepGeometry`). There's no primitive shape (box, cylinder, capsule)
that profile fits, so a trimesh is the only collider type that represents it
exactly. And it's built as **one** collider for deck and walls together
deliberately: the code comment above the call site is explicit about why —

> One collider for deck and walls together, so their junction is an
> internal edge Rapier can correct rather than a seam between two meshes.

`FIX_INTERNAL_EDGES` is part of the same story: it makes the mesh's winding
physically meaningful so Rapier can smooth contact normals across a shared
edge between triangles, which is what stops a ball catching on the crease
where the flat deck meets the wall's base. That flag adds its own pass on
top of the BVH build. Anything that touches this collider has to keep that
fix intact, or the exact bug it solved comes back.

## Why it's expensive regardless of triangle count

The instinct is "reduce the triangle count." Worth doing the arithmetic
first: `stationsBetween` is inclusive on both ends, and the collider spans
`fromIndex - COLLIDER_OVERLAP_STATIONS` to `toIndex + COLLIDER_OVERLAP_STATIONS`
— `CHUNK_STATIONS` (12) stations for the chunk itself, plus one extra
station of overlap on each side, comes to 15 rings, each an 8-point open
cross-section (`deckWithWallsCrossSection` — the two walls' four corners
each, deck implicit between the inner two). A ring of 8 points connects to
the next ring with 7 quads (it's an open profile, not a closed loop), so
the whole collider sweeps out roughly 15 × 8 = 120 vertices and
14 × 7 × 2 = 196 triangles. That is not a lot of geometry — a trimesh with
a couple hundred triangles is nowhere near where naive "reduce the poly
count" advice usually pays off.

That's the actual point worth taking away: the cost here is much more likely
the **fixed overhead of the operation type** — BVH allocation, the
WASM call boundary, `FIX_INTERNAL_EDGES`'s extra edge-welding pass — than
the volume of data going into it. Halving the triangle count would likely
make a small dent, not fix the spike. This should be verified before
trusting it, though: wrapping the `addTrimeshCollider` call in
`performance.now()` timestamps and reading the actual milliseconds would
turn this from "very likely" into "confirmed," and is the natural next step
before spending real effort on any of the alternatives below.

## Alternative 1: heightfield

A **heightfield** collider is a regular 2D grid of height samples in a
flat, axis-aligned local rectangle. Rapier (and every other physics engine)
can build one in roughly linear time and query it in O(1) — "which cell is
under this point" is array indexing, not a tree descent, and there's no BVH
to build because the regular grid structure already tells you where
everything is. This is the standard answer to "trimesh collider is too
slow" for terrain, and it would very likely make chunk builds dramatically
cheaper.

The catch is real, not a technicality: a heightfield stores **one height
per (x, z) grid cell**. It cannot represent a vertical wall, let alone the
current profile's overhang-free-but-still-multi-height cross-section (deck,
then a vertical jump up to the wall top). The deck alone — no walls — maps
onto a heightfield reasonably (it's a single surface, curving and banking
but still one height per point along the ribbon in the path's local frame).
The walls fundamentally cannot: they'd need to become their own, separate
colliders (a thin box or two per chunk is the obvious shape), splitting the
single collider back into deck-plus-walls-as-three-pieces — undoing the
exact unification the current code put in specifically to stop the rock
catching on that internal seam.

That doesn't make this a dead end, but it does mean it isn't a drop-in
swap — it's "solve the seam problem a different way, then get the cheap
construction." The same trick already used for the seam **between**
chunks (`TRACK_CONTACT_SKIN`, a small collider margin that bridges the
hairline gap at a chunk boundary) is the natural candidate: give the
deck-heightfield and the wall-boxes a shared contact skin so a ball crossing
from one onto the other doesn't catch on the geometric discontinuity between
two different collider shapes, the same way it doesn't catch crossing from
one trimesh chunk to the next today. That's a real physics-tuning task with
its own failure modes (a skin too generous reads as a soft, spongy wall; too
tight and the old bug is back) — it would need the same kind of iterative,
in-browser verification the original deck/wall unification presumably went
through.

## Alternative 2: compound collider (boxes instead of one mesh)

A **compound** collider is a fixed body with several simple child colliders
— boxes, in this case — instead of one mesh. Since the deck is already
built from discrete stations (`STATION_SPACING` = 4 world units apart), it's
already a faceted approximation of a smooth curve, not a true curve; nothing
stops each station-to-station segment from being its own slightly rotated
box for the deck and two more for the walls, instead of all being welded
into one trimesh. Boxes are one of the cheapest collider shapes there is —
effectively free to construct, no BVH, no acceleration structure beyond the
compound's own (much smaller, much cheaper) top-level bounding volume tree
over a handful of children rather than hundreds of triangles.

The tradeoff is the same seam problem as the heightfield option, in a
different shape: adjacent boxes meeting at an angle (wherever the path
curves) present a hard edge to the ball, exactly the crease the unified
trimesh was built to avoid. A contact skin across every box-to-box junction
is a much bigger surface of "please don't catch here" than the heightfield
option's single deck/wall seam, since there's now one per station instead
of one per chunk boundary. This is probably the higher-risk, lower-payoff
option of the two shape alternatives for that reason — more seams to tune,
for a shape that (unlike the heightfield) doesn't even solve the "can't
represent a wall" problem, since a compound of boxes can, but only by
keeping wall geometry as its own set of child shapes either way.

## Alternative 3: build off the main thread

Rapier ships as WebAssembly, which raises the question of whether the
expensive part — specifically the BVH build — could happen in a Web Worker
while the main thread keeps rendering. In principle, yes: WASM runs happily
in a worker. In practice, Rapier's `World`, `RigidBody` and `Collider`
objects aren't plain data — they're live handles into one simulation's
internal state. There is no supported way to build a collider against a
`World` that lives in a worker and hand the finished result to a different
`World` on the main thread; the object model doesn't serialize across that
boundary. Making this work would mean running the _entire_ physics
simulation in the worker and shuttling transforms back to the main thread
every frame for rendering — a full architecture change to how this game
(and the physics helper package it shares with every other Rapier-based
game in this codebase) is built, not a targeted fix. Worth knowing this
ceiling exists; not worth pursuing for this specific spike.

## What I'd actually try, in order

1. **Measure the trimesh call itself first.** Wrap `addTrimeshCollider` in
   `performance.now()` and log it for a run's worth of chunk builds. This
   confirms or kills the hypothesis that it's the dominant cost before any
   of the below is worth the risk.
2. **Heightfield deck + box walls + a contact skin between them**, mirroring
   the existing `TRACK_CONTACT_SKIN` trick used at chunk boundaries. Most
   likely to actually move the number, and reuses a pattern the codebase has
   already validated once for exactly this class of seam problem.
3. **Compound boxes** only if the heightfield route turns out to need walls
   with a shape a heightfield truly can't approximate (a genuine overhang or
   tunnel, which the game doesn't have today but might one day).
4. **Worker-thread physics** is a full rewrite of how physics runs in this
   codebase, not a fix for this bug — only worth it if a future feature
   independently demands running physics off the main thread anyway.

None of this is implemented. It's a real, load-bearing change to how the
track's ground behaves under the ball, and it should go through its own
design pass — starting with the measurement in step 1 — rather than being
folded into a chunk-streaming fix that didn't need to touch the collider at
all.
