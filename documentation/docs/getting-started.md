---
sidebar_position: 1
---

# Getting Started

**WebGameKit** is a framework-agnostic toolkit for 3D games and environments, built on Three.js
and Rapier physics. It is a set of npm packages, not a framework you build inside: you bring the
page, it brings the scene, the physics and the loop.

Nothing on this page needs this repository. If you want to work on the toolkit itself rather than
build with it, see [contributing](./contributing.md).

## Install

```bash
pnpm add @webgamekit/threejs @webgamekit/animation @webgamekit/controls three @dimforge/rapier3d-compat
```

Three.js and Rapier are peer dependencies — the toolkit does not pin them for you, so a project
that already has a Three.js version keeps it.

## A running scene in one file

An empty page, a canvas, and a physics world with something falling in it.

```html
<!doctype html>
<html>
  <body style="margin: 0">
    <canvas id="scene"></canvas>
    <script type="module" src="/main.ts"></script>
  </body>
</html>
```

```typescript
import { getTools, getCube } from '@webgamekit/threejs'
import { createTimelineManager } from '@webgamekit/animation'

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!

const { setup, animate, scene, world } = await getTools({ canvas })

await setup({
  config: {
    camera: { position: [0, 8, 18], lookAt: [0, 0, 0] },
    lights: {
      ambient: { intensity: 0.6 },
      directional: { intensity: 1.4, position: [10, 20, 10], castShadow: true }
    },
    ground: { size: [40, 1, 40], color: 0x3f6d4e },
    sky: { color: 0x87ceeb }
  },
  defineSetup: () => {
    getCube(scene, world, {
      size: [2, 2, 2],
      position: [0, 12, 0],
      color: 0xef6461,
      type: 'dynamic',
      castShadow: true
    })
  }
})

animate({ timeline: createTimelineManager() })
```

That is the whole thing. `getTools` builds the renderer, the scene, the camera and the Rapier
world; `setup` fills them from plain configuration; `animate` runs the loop and steps the physics.
The cube falls, lands on the ground and casts a shadow.

## Rapier needs two lines of build config

Rapier ships as WebAssembly, and bundlers need telling. With Vite:

```typescript
import { defineConfig } from 'vite'
import wasm from 'vite-plugin-wasm'

export default defineConfig({
  plugins: [wasm()],
  optimizeDeps: { exclude: ['@dimforge/rapier3d-compat'] },
  build: { target: 'esnext' }
})
```

`optimizeDeps.exclude` matters: pre-bundling breaks the wasm instantiation. `esnext` is needed
because `getTools` is awaited at the top level.

## Adding input

```typescript
import { createControls } from '@webgamekit/controls'

const { currentActions } = createControls({
  mapping: {
    keyboard: { w: 'move-forward', s: 'move-back', a: 'move-left', d: 'move-right', ' ': 'jump' },
    gamepad: { 'axis0-up': 'move-forward', cross: 'jump' }
  }
})
```

`currentActions` is a live record of what is pressed, by action name rather than by key, so the
same game logic serves keyboard, gamepad and touch without knowing which one is in use.

## Per-frame work is a named action

Everything that happens each frame is an action on a timeline, not a branch inside one growing
callback:

```typescript
const timeline = createTimelineManager()

timeline.addAction({
  name: 'move the player',
  category: 'user-input',
  action: () => {
    /* read currentActions, move the body */
  }
})

timeline.addAction({
  name: 'spawn an obstacle',
  frequency: 45, // every 45th frame
  category: 'game-logic',
  action: () => {
    /* … */
  }
})

animate({ timeline })
```

Naming them is what later lets you pause a category, log one, remove one, or see them on a
timeline panel.

## Start from a template instead

Two starters in the repository are built to be copied rather than read:

| Template                                                                                            | Shows                                                            |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| [platformer-starter](https://github.com/cnotv/generative-art/tree/main/examples/platformer-starter) | third-person movement, jumping, fixed platforms, a follow camera |
| [runner-starter](https://github.com/cnotv/generative-art/tree/main/examples/runner-starter)         | lane switching, spawning and despawning, scoring, collision      |

Each is a standalone Vite app of roughly a hundred lines, with every constant in a `config.ts`
and the game itself as a handful of named timeline actions.

Both also play in the playground without being copied first: they are listed under Examples in its
navigation sidebar, and the app serves them from its own origin.

## Where to go next

- [@webgamekit/threejs](./packages/threejs.md) — scenes, physics, models, cameras, asset loading
- [@webgamekit/animation](./packages/animation.md) — the timeline, character movement, clips
- [@webgamekit/controls](./packages/controls.md) — keyboard, gamepad, touch and remapping
- [Guides](./guides/creating-a-3d-view.md) — longer walkthroughs
- [Journey](./journey/animation.md) — why things are the way they are
