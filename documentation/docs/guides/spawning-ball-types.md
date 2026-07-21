---
sidebar_position: 12
---

# Spawning Multiple Balls and Adding Ball Types

The Marble Editor race can drop uncontrolled test balls onto the start to observe
a track's physics without steering. Each ball is either the default **marble**
(with tunable physics) or one of the **physic presets** borrowed from the Physic
Examples experiment — Rubber, Balloon, Bowling, Paper, Tennis and Ping Pong —
each with its own weight, restitution, friction and damping.

The ball definitions live in a single shared catalog so the Physic Examples
playground and the Marble Editor spawner stay in sync.

## Source files

- `src/utils/physicBalls.ts` — the `PHYSIC_BALLS` catalog, spawning and selection helpers
- `src/types/physicBalls.ts` — the `PhysicBallPreset` type
- `src/views/Games/MarbleEditor/game/useMarbleRace.ts` — the editor spawner (`spawnTestBalls`)
- `src/views/Games/MarbleEditor/MarbleEditor.vue` — the Config panel controls
- `src/views/Experiments/PhysicExamples.vue` — the experiment that shares the catalog

## Spawning multiple balls in the editor

Start a race in the Marble Editor and open the app **Config** panel (top-right).
The **Test balls** section drives the spawner:

| Control             | Effect                                                              |
| ------------------- | ------------------------------------------------------------------- |
| **Count**           | How many balls to drop (1–50).                                      |
| **Ball type**       | Which type to spawn: **Marble** plus the six physic presets.        |
| **Random type**     | When on, every ball gets a random type instead of the selected one. |
| **Random textures** | Randomises the marble skin (only affects the **Marble** type).      |
| **Add balls**       | Drops that many balls onto the start.                               |

Balls spawn as a tight 2×2 footprint centred on the start lane and stack upward
in layers, so they rain straight down onto the start instead of spreading wide
and falling off the sides. They roll under gravity only and are torn down with
the scene.

## Adding a new ball type

Append a `PhysicBallPreset` to `PHYSIC_BALLS` in `src/utils/physicBalls.ts`. It
appears automatically in the Config panel dropdown and in the random-type pool —
no other wiring is needed.

```ts
{
  id: 'beach-ball',
  label: 'Beach Ball',
  kind: 'ball', // 'ball' → getBall (primitive sphere); 'model' → getModel (GLB)
  options: {
    size: 6,
    weight: 8,
    restitution: 0.6,
    friction: 1,
    color: 0x33aaff
  },
  editor: { size: 0.8 } // marble-scale override, editor only
}
```

Key fields:

- **`id` / `label`** — `id` is stable internal identity; `label` is what the
  dropdown shows and what selection is keyed on (labels must be unique).
- **`kind`** — `'ball'` spawns a primitive sphere via `getBall`; `'model'` loads
  a GLB via `getModel` and requires a `model` filename.
- **`options`** — the render and physics settings (`weight`, `restitution`,
  `friction`, `damping`, `angular`, colour, material, …), authored at the large
  Physic Examples arena scale.
- **`editor`** — optional marble-scale `size` (and `scale` for GLB models) applied
  **only** inside the Marble Editor; see below.
- **`randomColor` / `randomRotation`** — set either flag to vary the colour or
  rotation per spawn (e.g. balloons get a random colour, crumpled paper a random
  rotation).

A GLB-model preset looks like this:

```ts
{
  id: 'balloon',
  label: 'Balloon',
  kind: 'model',
  model: 'balloon.glb',
  randomColor: true,
  options: {
    scale: [70, 70, 70],
    size: 10,
    weight: 5,
    restitution: -0.5,
    material: 'MeshPhysicalMaterial',
    transparent: true,
    opacity: 0.55,
    roughness: 0.05,
    clearcoat: 1,
    transmission: 0.35
  },
  editor: { size: 1.3, scale: [9, 9, 9] }
}
```

## Editor-scale overrides

Physic presets are authored for the large Physic Examples arena (a bowling ball
has a radius of 15), so dropping them verbatim onto a marble track would dwarf
it. The `editor` block shrinks the **visual and collider size** to marble scale
while leaving the physics character — weight, restitution, friction, damping —
untouched, so a bowling ball still feels heavy and a ping-pong ball light.

The merge is handled by `mergeBallOptions(preset, position, useEditorScale)`:

- The Marble Editor spawns with `useEditorScale = true` (applies the overrides).
- The Physic Examples experiment spawns with `useEditorScale = false` (keeps the
  original arena sizes).

For a GLB model, override **both** `size` (the collider radius) and `scale` (the
visual mesh) together so the physics body and the rendered model stay matched.

Very small, bouncy balls (ping-pong, paper) enable continuous collision
detection when spawned in the editor so they do not tunnel through the thin track
colliders between physics steps.

## Tunable default marble physics

The Config panel's **Marble physics** section exposes sliders for the default
marble — weight, restitution, friction, linear/angular damping and size. These
values are shared by:

- the **player marble** (applied on the next race), and
- spawned **Marble**-type test balls (applied immediately).

The physic presets keep their own baked physics; the sliders only affect the
default marble.
