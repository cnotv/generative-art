---
sidebar_position: 8
---

# Defining a Timeline and Element Paths

This guide shows how to drive a scene with a **timeline** (a set of named,
frame-based actions the Timeline panel can show, pause, and scrub) and how to
attach **paths** to meshes so they follow waypoints — walking, jumping, or
gliding along a curve.

The running example is the test scene at `/tests/Timeline`, where a coin spins,
balls spawn, a cube bobs, and goombas patrol — one of them climbing a brick
column, bumping a coin block, and walking back down.

:::note Source files
This tutorial tracks these files — if you change any of them, update this guide
in the same change (see the "Keep tutorials in sync" rule in
`.github/rules/code-style.md`):

- `packages/animation/src/TimelineManager.ts` — `createTimelineManager`
- `packages/animation/src/types.ts` — the `Timeline` action shape (incl. `segments`)
- `src/stores/debugScene.ts` — `PathConfig`, `PathEntry`, `addPath`, `addPathWaypoint`
- `src/utils/pathVisualization.ts` — path tube + node rendering
- `src/views/Tests/Timeline/Timeline.vue` — the worked example

Re-read this guide after editing any of the above and fix anything that drifted.
:::

## 1. Create a timeline

A timeline is created once per scene with `createTimelineManager` from
`@webgamekit/animation`. Each **action** is an object with a `name`, an optional
`category`, and an `action` callback run every frame while the action is active.

```ts
import { createTimelineManager } from '@webgamekit/animation'

const timelineManager = createTimelineManager()

timelineManager.addAction({
  name: 'coin: flip',
  category: 'visual-effects',
  action: () => (coin.rotation.z += 0.05)
})
```

`addAction` returns a string id you keep if you later need
`updateAction(id, { enabled })` or `removeAction(id)`.

### Run it in the render loop

`getTools()` (see the [Three.js getTools guide]) returns an `animate` helper.
Pass the manager as `timeline`; `beforeTimeline` runs first each frame (physics
binding here), and `isPaused` lets the Timeline panel stop everything.

```ts
animate({
  beforeTimeline: () => bindAnimatedElements(elements, world, getDelta()),
  timeline: timelineManager,
  isPaused: () => timelinePanelStore.isPaused
})
```

### Show it in the Timeline panel

Register the manager with the Timeline panel store so each action gets a row,
a play/pause toggle, and a scrubbable bar:

```ts
timelinePanelStore.register({
  getTimeline: () => timelineManager.getTimeline(),
  getCurrentFrame: getSimulationFrame,
  getFrameRate, // seconds per frame
  setActionEnabled: (id, enabled) => timelineManager.updateAction(id, { enabled })
})
```

### Breaking one row into labelled steps

An action can carry a `segments` array (`{ name, frames }[]`). The panel renders
each segment as a labelled, coloured piece **within that single row**, looping
every `sum(frames)` frames. Use this when one action cycles through phases and
you want the breakdown visible without creating extra rows:

```ts
timelineManager.addAction({
  name: 'goomba-1: path',
  category: 'movement',
  segments: [
    { name: 'forward-jump', frames: 42 },
    { name: 'walk', frames: 90 },
    { name: 'jump', frames: 60 }
    // ...
  ],
  action: () => advanceSteppedFollower(tick, getDelta)
})
```

A segment's duration in frames is `seconds / rate`, where
`seconds = length / speed` and `rate = getFrameRate()`. Keep the frame counts in
step with the real motion so the bars line up with playback.

## 2. Attach a path to an element

Paths live in the `debugScene` store next to the scene elements. A `PathEntry`
holds the serialisable data (waypoints + reactive `config`) plus a `handlers`
object the scene supplies to react to edits:

```ts
export interface PathConfig {
  speed: number
  obstacleImpulse: number
  easing: string
  easingIntensity: number
  playing: boolean // pauses only this path, not the whole timeline
  loop: boolean
  pingPong: boolean
  showPath: boolean
  showNodes: boolean // on by default
}
```

There are three kinds of follower, chosen by what the mesh is:

| Follower    | Used for                      | Motion                                                             |
| ----------- | ----------------------------- | ------------------------------------------------------------------ |
| **Lerp**    | inert meshes (e.g. a cube)    | snapped onto a smoothed Catmull-Rom curve; honours `easing`        |
| **Walking** | animated models with no steps | walks toward each node, ray-collides with obstacles, can wall-bang |
| **Stepped** | an animated model that climbs | one labelled step per segment: walk / forward-jump / in-place jump |

A mesh counts as "animated" (walking or stepped) when its `userData.actions`
holds at least one animation clip — a plain cube has an empty `actions`, so it
stays a lerp follower.

### A preset path (no drawing)

Register the path, its driving timeline action, and feed it waypoints:

```ts
const store = useDebugSceneStore()
const pathId = 'path-moving-cube'

store.addPath({
  id: pathId,
  elementName: 'moving-cube',
  label: 'moving-cube path',
  waypoints: [],
  config: makeDefaultPathConfig({ pingPong: true, loop: false }),
  handlers: makePathHandlers(scene, tick, pathId, () => {})
})
// the cube bobs between two nodes
;[
  [x, y, z],
  [x, y + GRID_UNIT * 2, z]
].forEach((wp) => store.addPathWaypoint(pathId, wp))
```

`addPathWaypoint` drives the `onAddWaypoint` handler, which (re)builds the tube
and node markers via `pathCreateVisualization` /
`pathCreateSteppedVisualization` from `src/utils/pathVisualization.ts`.

### Let users draw a path

For user-drawn paths, register an `onEnablePath(elementName)` callback through
`store.registerPathContext`. The Elements panel shows an "Enable path" button on
any mesh; clicking it calls `store.enablePathForElement(name)`, which runs your
callback to wire `usePathInteraction` (ground-plane raycasting) to
`store.addPathWaypoint`.

## 3. Worked example: goomba-1's stepped climb

goomba-1 is a **stepped** follower. Its waypoints encode a loop that climbs the
central column, bumps the coin block, and walks back down. Each pair of nodes is
classified by geometry into a step type:

```ts
type SegmentType = 'walk' | 'forward-jump' | 'jump'

const segmentType = (a, b) => {
  const horizontal = Math.hypot(b[0] - a[0], b[2] - a[2])
  if (horizontal < PATH_ARRIVE_Y) return 'jump' // same spot → hop in place
  return b[1] - a[1] > PATH_JUMP_MIN_RISE ? 'forward-jump' : 'walk'
}
```

- **walk** — straight horizontal move. On a descent the follower keeps its
  height and lets the **gravity code** (`bindAnimatedElements`) drop it off the
  ledge, so it strides off the edge rather than ramping down a diagonal.
- **forward-jump** — a parabola that rises over the wall and lands on the ledge,
  with most of the forward travel near the top of the arc.
- **jump** — an in-place hop at one node (a duplicated waypoint), used to bump
  the coin block from the stack top.

The path is a list of nodes; a duplicated node marks the in-place jump:

```ts
const GOOMBA_1_CLIMB_PATH: CoordinateTuple[] = [
  [0, GOOMBA_GROUND_Y, GRID_UNIT], // ground
  [0, GOOMBA_BRICK_TOP_Y, 0], // forward-jump onto the first brick
  [0, GOOMBA_BRICK_TOP_Y, -GRID_UNIT], // walk across
  [0, GOOMBA_STACK_TOP_Y, -GRID_UNIT * 2], // forward-jump onto the stack
  [0, GOOMBA_STACK_TOP_Y, -GRID_UNIT * 2], // duplicate → in-place jump (coin)
  [-GRID_UNIT, GOOMBA_BRICK_TOP_Y, -GRID_UNIT * 2], // walk down (gravity)
  [-GRID_UNIT * 2, GOOMBA_BRICK_TOP_Y, -GRID_UNIT * 2],
  [-GRID_UNIT * 2, GOOMBA_BRICK_TOP_Y, 0],
  [-GRID_UNIT * 2, GOOMBA_GROUND_Y, GRID_UNIT] // walk down to the ground, then loop
]
```

The single timeline action advances whichever step is current and hands off on
completion, while its `segments` give the panel the walk/jump breakdown for that
one `goomba-1: path` row.

:::tip Collider sizing
A path-driven model is usually `kinematicPositionBased`, moved each frame with
`setNextKinematicTranslation`. Kinematic bodies push dynamic ones (balls), but
only where their **collider** is — size the collider to the visible model
(`size` × `boundary`), or fast or small objects will appear to pass through it.
:::

## Checklist for a new timeline + path

1. `const manager = createTimelineManager()` and `addAction` for each behaviour.
2. `animate({ beforeTimeline, timeline: manager, isPaused })`.
3. `timelinePanelStore.register({ ... })` so the panel can drive it.
4. For motion, `store.addPath({ ... })`, register a driving action, then
   `addPathWaypoint` for each node.
5. Pick the follower kind by the mesh (animated vs inert) and, for climbers, give
   the action `segments` so the steps show on one row.

[Three.js getTools guide]: ../packages/threejs.md
