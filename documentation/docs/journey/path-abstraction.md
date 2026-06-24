---
sidebar_position: 104
---

# Abstracting Path-Following into a Reusable Feature

## Starting point

The DrawPath experiment shipped a complete path-following implementation: users hold-draw a curve on the ground, a follower mesh travels along it with easing, and waypoint nodes can be dragged to reshape the path in real time. The logic was entirely self-contained inside `DrawPath.vue` and its adjacent helpers, which meant every future scene that wanted path-following would have to duplicate it.

## What needed to be separated

Three distinct concerns were tangled inside DrawPath:

1. **Visualisation** — building the tube mesh and waypoint sphere nodes in the Three.js scene
2. **Pointer/touch interaction** — converting raw browser events into waypoints via ground-plane raycasting, enforcing a minimum drag distance, and switching between draw mode and node-drag mode
3. **Follower physics** — the per-frame tick that advances the mesh along the path, handles easing, and branches on loop/ping-pong completion

Extracting each concern into its own module decoupled them from DrawPath's scene-specific state and made them consumable by any view.

## Extraction strategy

The visualisation helpers (`drawCreatePathVisualization`, `drawInterpolateWaypoints`, `drawCreateWaypointNode`, etc.) moved into `src/utils/pathVisualization.ts` with their DrawPath-specific config values (`PATH_LINE_COLOR`, `PATH_TUBE_RADIUS`) converted to optional parameters with sensible defaults. The original helper file now re-exports from the shared location so DrawPath's imports required no change.

The easing multiplier moved to `src/utils/pathEasing.ts` under the name `pathGetEasingMultiplier`. Again, the original `easing.ts` helper re-exports it.

The per-frame mesh advance tick became `pathAdvanceMesh` in `src/utils/pathMeshFollow.ts`. It takes a `THREE.Object3D` and a `PathFollowState` and returns a `PathFollowResult`, delegating the pure path arithmetic to the existing `logicAdvanceAlongPath` in `@webgamekit/logic`.

```mermaid
flowchart LR
    A[DrawPath.vue\nbefore] --> B[pathVisualization.ts]
    A --> C[pathEasing.ts]
    A --> D[pathMeshFollow.ts]
    A --> E[usePathInteraction.ts]
    B --> F[DrawPath.vue\nafter — thin consumer]
    C --> F
    D --> F
    E --> F
    B --> G[Any other scene]
    C --> G
    D --> G
    E --> G
```

## Pointer interaction as a composable

The ground-plane raycasting, hold-to-draw, node hit-testing, and drag logic were extracted into `src/composables/usePathInteraction.ts`. Rather than accepting specific scene state, it works entirely through callbacks: `onDrawStart`, `onAddWaypoint`, `onUpdateWaypoint`, and `onDrawEnd`. The caller decides what to do with each event; the composable only handles the browser layer.

The module-level helpers (`getNdcFromEvent`, `intersectGround`, `hitTestNodes`) perform pure geometric operations and are kept separate from the main function to satisfy the line-count constraint.

## Store integration

The `debugScene` store gained a `paths` collection mirroring the existing `instancedGroups` and `spawnGroups` patterns. Each `PathEntry` holds the serialisable data (waypoints, reactive config) and a `PathHandlers` object whose callbacks the scene provides when registering a path.

A `pathRegistrationContext` ref lets any view register an `onEnablePath(elementName)` callback that the Elements panel can invoke without holding Three.js scene references. The panel only knows about element names; the view decides how to wire the scene-side path logic in response.

## Elements panel surface

A path belongs to the mesh it is attached to, so its controls live _inside_ that mesh element's own expandable properties rather than as a separate top-level entry. `ElementItem.vue` gained an optional "Enable path" button (a `Route` icon) that appears on mesh elements when a `pathRegistrationContext` is registered. Clicking it calls `debugSceneStore.enablePathForElement(elementName)`.

Once a path exists for an element, expanding that element in the Elements panel reveals an `ElementPathSection.vue` beneath its normal properties. It shows the waypoint list — a compact grid where the X/Y/Z labels sit once as a header row and each line uses the shared `Input` component — followed by `SchemaControls` for every path option: speed, push force, easing, easing intensity, playing, loop, ping pong, show path, show nodes, and reset. Add and remove waypoints sit as a plus and a bin icon in the section header. For a stepped path, each waypoint row is also labelled with the action it begins (walk, forward-jump or jump) with a tooltip explaining it. The panel maps each path to its element by name, so the section appears in the right place automatically.

## Scaling the visualisation to the scene

The path tube and waypoint nodes use small package defaults (tube radius 0.06, node 0.4) sized for the ~1-unit DrawPath reference scene. Dropped into a scene built on a much larger unit scale — for example the Timeline test scene with 30-unit grid cells viewed from a distant orthographic camera — those defaults are sub-pixel and effectively invisible. The consuming view passes scene-appropriate values (a tube radius and node size measured in the scene's own units) so the path reads clearly at whatever scale it is used.

## Following a path: snapped, walked, or stepped

The Timeline scene uses three kinds of follower, chosen by what the mesh is. A mesh with no animation clips — the moving cube — is _snapped_: each frame it is moved to the exact interpolated point on the smoothed curve, which is right for something with no locomotion of its own.

An animated model with a flat patrol is _walked_: it heads toward each node with its own controller, colliding with bricks (so a wall-banging goomba stops and turns) and playing its walk clip. Loop and ping-pong are honoured here, so the same follower can wrap around or bounce back along its nodes.

An animated model that climbs is _stepped_, and this is where the path stops being a rail and becomes a set of intentions. Each segment between two nodes is classified by geometry into one of three actions: a **walk** (a flat or descending step), a **forward jump** (a parabola up and over onto a higher ledge), or an in-place **jump** (a straight hop, used to bump the coin block from the stack top). The action is therefore something you author by where you place the next node — a duplicated node is an in-place jump, a higher node is a forward jump — rather than a separate toggle. A walk never drives its own height: it moves straight and leaves the vertical to the gravity code, so the goomba rests on whatever surface is under it and, crucially, a walk that would cross a brick is stopped by a forward ray — even after the path is dragged into a wall, the goomba bumps it instead of passing through. Only the climbing jumps set height explicitly, arcing clear of the wall.

```mermaid
flowchart LR
    A[Segment from node A to node B] --> B{Same X/Z spot?}
    B -- yes --> J[Jump in place]
    B -- no --> C{B higher than A?}
    C -- yes --> F[Forward jump: parabola onto the ledge]
    C -- no --> W[Walk: straight + gravity, blocked by walls]
```

The whole stepped path is driven by a single timeline action, and the per-cycle breakdown of its steps is attached to that action as `segments`, so the one `goomba-1: path` row shows the walk/jump pieces along its lane instead of spilling into many rows.

## Showing a path only for the selected element

With several elements each carrying a looping path, drawing every tube at once clutters the scene. A path's tube and nodes are therefore shown only while that path's element is the currently selected one in the Elements panel — selection is the single source of truth, read from the element-properties store. A watcher re-evaluates every path's visibility whenever the selection changes, and a shared `updateTickVisibility` helper combines three conditions: the element is selected, the path is not hidden, and its own show-path / show-nodes toggles are on. Movement is unaffected — paths keep advancing their followers whether or not their tube is drawn — so deselecting an element simply hides its line without stopping it. Enabling a path also selects its element, so a freshly drawn path is visible immediately.

## `playing` pauses only its own path

The `playing` config key pauses just that one path, independent of the global timeline. An earlier version coupled it to the Timeline panel's global pause, but that conflated stopping a single goomba with freezing the whole scene; now toggling a path's `playing` stops only that follower while everything else keeps running.

## DrawPath after the refactor

After extraction, `DrawPath.vue` became a thin consumer. The long pointer-handling block was replaced with a three-line `usePathInteraction` call. The `SceneState` type lost its `selectedNodeIndex` field (the composable tracks that internally). The easing call site became `pathGetEasingMultiplier` instead of the local `getEasingSpeedMultiplier`. The behaviour is identical; the duplication is gone.
