---
paths:
  - 'src/views/**'
  - 'packages/threejs/**'
  - 'packages/animation/**'
---

# 3D views and scenes

## Creating a view

Views live at `src/views/{Group}/{SceneName}/{SceneName}.vue` and the router discovers them
automatically. Four registrations are easy to forget and invisible when missing:

- An entry in `src/config/viewsMeta.json`, keyed by the route name the router generates
  (capital letters become spaced words: `GoombaRunner` becomes `"Goomba Runner"`). Without
  it the view falls back to the generic site description when shared.
- `registerViewConfig` for both tabs — Config for runtime game settings, Scene for
  `SetupConfig`-related settings (camera, environment, lighting, post-processing) — and
  `unregisterViewConfig` on unmount.
- `setViewPanels({ showConfig: true, showScene: true })` in `onMounted`, omitting a panel
  only when it has no content.
- A new `@webgamekit/*` package added to the `packages` array in `vite.config.ts`. Omitting
  it makes Vite resolve through `node_modules` to a possibly stale `dist`, and the app throws
  a runtime `SyntaxError` in both dev and Docker.

Walkthrough: `documentation/docs/guides/creating-a-3d-view.md`.

## Scene setup

Declare the scene in `config.ts` via `SetupConfig` before writing any Three.js. Audit the
available options in `packages/threejs/src/types.ts` first — `scene.backgroundColor`,
`lights.*`, `ground.*`, `sky.*`, `camera.*`, `orbit`, `postprocessing` — then pass the config
to `setup()`, using `defineSetup` for model loading.

Never hand-build lights, ground or sky inline in `init()`. If something genuinely is not
covered — an orthographic camera, geometry that maps to no `getCube`/`getModel` primitive —
ask before writing manual Three.js, since the answer may be to extend the package instead.

Keep every constant in a co-located `config.ts`: model configs, setup config, control
bindings, game settings, asset paths. Never inline magic numbers in the component.

## Panels are the UI

All user-facing controls live in the existing panels, not as overlays on the canvas. The
exception is content that is part of the game itself, such as a score HUD.

- Expose runtime settings through `registerViewConfig`, not `<Teleport>` into panel slots.
- Use `ButtonSelector` for multi-option button groups. If a needed input type is not covered
  by the existing components (`Slider`, `Switch`, `Select`, `ColorPicker`, `CoordinateInput`,
  `ButtonSelector`), request a new one and describe its requirements — never build an ad-hoc
  widget in a view template.
- At most one level of Accordion; sub-groups inside `AccordionContent` are plain labelled
  sections. No wrapper `div`s between `GenericPanel` and the controls.

Every element registered through `addSceneElement` or `registerElementProperties` needs a
descriptive `name` and `title` describing its role — `"ground"`, `"player-ball"`,
`"coin-block"` — never a Three.js type like `"Mesh"` or `"Group"`. Every element in the panel
must have a non-empty property schema; elements with nothing configurable do not belong there.

## Walls and tiled geometry

**A wall must meet its neighbours exactly — no gap, no protrusion.** Geometry laid out on a
grid is the usual source of both. A wall built exactly one cell long stops on the corner line
rather than crossing it, so the corner square is covered only on the sides its two walls happen
to reach and a quadrant is left open. That reads as a notch from above, and the ball catches on
the step or squeezes through it.

The rule that fixes it is one sentence: **every run of wall ends flush with the outer face of
the wall it meets** — half a thickness past the joint line, no more and no less. Perpendicular
walls then overlap inside the corner, which is invisible, because two solid boxes of the same
material sharing a volume have no seam and nothing coplanar is drawn twice.

Half a thickness, not a whole one. Overshooting is not harmless: a run that extends a full
thickness past the joint pokes out beyond the face it should have stopped at, and the two walls
of a corner each leave a step sticking out past the other. That is the same defect as the gap,
mirrored, and it is what a board's outer ring gets wrong most often — a perimeter is one
thickness longer than the board it encloses, never two.

| Run                           | Length                |
| ----------------------------- | --------------------- |
| A wall spanning one cell      | cell + one thickness  |
| A perimeter enclosing a board | board + one thickness |

Two more traps follow from the same place. A maze or room generator usually emits its own outer
boundary, so adding a separate perimeter on top puts two identical walls in one plane —
coincident faces that z-fight and a doubled edge that reads as misalignment; drop one of them.
And the same sizing governs anything tiled — floor slabs, fences, track pieces, room modules.

Check a corner at high zoom rather than trusting the arithmetic. A half-thickness step is
invisible at the zoom a whole board is framed at, and obvious the moment someone looks closely.

## Performance

The animation loop is the hot path:

- **Never `new` anything inside a timeline action or `requestAnimationFrame` callback.** No
  `new Vector3()`, `new Matrix4()`, `new Quaternion()`. Allocate once outside and mutate with
  `.set()`, `.copy()` or `.multiplyScalars()`.
- **Never `.clone()` in the loop** — `.copy()` onto a pre-allocated instance instead.
- Dispose geometries, materials, textures and render targets when removing objects, or they
  leak VRAM. `disposeObject` and `disposeScene` skip whatever the asset cache owns, so a
  loaded model's geometry survives the view that used it — freeing that is `assetsRelease(url)`
  in the same `onUnmounted`, and only the last holder's call actually frees it.
- Pool short-lived objects such as projectiles and particles rather than creating and
  collecting them each frame.

`no-mesh-in-loop`, `no-alloc-in-animation-loop` and `no-redundant-threejs-loader` enforce
parts of this; `pnpm lint` is not optional here.

Reuse the timeline action factories in `src/utils/gameTimelineActions.ts` —
`createPhysicsSyncAction`, `createDirectionalLightFollowAction`, `createCameraFollowAction`,
`createTimerAction`, `createFallCheckAction` — rather than re-implementing them.

Before shipping a scene or asset change, run the performance gate (the `perf-check` procedure).

## Input

All keyboard, gamepad, mouse and touch input goes through `createControls` from
`@webgamekit/controls`. Never add raw `window.addEventListener('keydown', …)`. Define a
`KEYBOARD_MAPPING` in the co-located `config.ts`, call `createControls({ mapping })` in
`init()`, read `controls.currentActions` in the loop, and call `controls.destroyControls()`
in `destroy()`. If a feature is missing, extend the package.

## Reuse before writing

Check `src/utils/` and `src/stores/` before implementing a Three.js pattern:
`src/utils/cameraProperties.ts` (camera and orbit), `src/utils/threeObjectUpdaters.ts`
(lint-safe mutations), `src/stores/sceneView.ts` (scene lifecycle).

## Gotchas

- Rapier needs `vite-plugin-wasm` and `optimizeDeps.exclude: ['@dimforge/rapier3d-compat']`.
- **A scene with lights does not keep the lights it declared.** `store.init` starts the day
  cycle, which overwrites every light and the scene background a frame later, so a
  `SetupConfig` palette silently becomes dawn, then night. That is the intended default. A
  view whose subject has to stay readable opts out with
  `store.setLightTransitionEnabled(false)` straight after `init`, which lands before the
  cycle's first frame and leaves the declared rig in place.
- Always call `destroyControls()` and the cleanup functions in `onUnmounted`.
- Use `shallowRef` for game state to avoid deep reactivity overhead.
- Check the canvas ref is not null before calling `getTools()`.
- Type every position, rotation and scale array as `CoordinateTuple`.
- When debugging movement, collision or animation, reach for `AxesHelper`, `ArrowHelper`,
  `BoxHelper` or the Rapier debug renderer, and ask for concrete numbers — positions,
  distances, angles — rather than guessing.
