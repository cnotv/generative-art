---
sidebar_position: 16
---

# Creating a 3D view

:::note Source files
This guide tracks `src/config/router.ts`, `src/config/viewsMeta.json`,
`src/composables/useViewConfig.ts`, `packages/threejs/src/types.ts` and `vite.config.ts`. If
you change any of them, update this guide in the same change.
:::

![A finished 3D view: the scene rendering beside the elements panel that lists its camera, lights and meshes](/img/timeline/elements-panel.webp)

## How a scene runs

1. The view imports from `@webgamekit/*`, which Vite aliases to package source for HMR
2. `getTools()` initialises the renderer, scene, camera and Rapier world
3. `setup()` configures lights, ground, sky and camera, and defines the scene objects
4. `animate()` runs timeline-based update loops for physics, animation and controls

Each view is a self-contained scene.

## File layout and routing

```
src/views/{Group}/{SceneName}/
  {SceneName}.vue     # the scene component
  config.ts           # every constant, separate from the logic
  helpers/            # scene-specific utilities
```

The router discovers anything matching `{Dir}/{Name}/{Name}.vue`, and `{Name}/index.vue`
also works. Group directories are `Games/`, `Experiments/`, `Generative/`, `Tools/` and
`Stages/`. The component name becomes the route and the title is derived by splitting it at
word, acronym and digit boundaries: `GoombaRunner/GoombaRunner.vue` serves
`/games/GoombaRunner` and is titled "Goomba Runner", `CubeMatrix2` is titled "Cube Matrix 2",
and `LobbyUIShowcase` is titled "Lobby UI Showcase". The same derivation lives in
`deriveRouteName` in `src/config/router.ts` and `toRouteName` in `scripts/routes.mjs`; a test
in `src/tests/routeNames.test.ts` checks the two stay identical and that every generated
route name has a matching `viewsMeta.json` entry.

### The meta entry is mandatory

Add every new view to `src/config/viewsMeta.json`, keyed by that generated route name:

```json
{
  "Goomba Runner": {
    "description": "One sentence describing what the view does or shows."
  }
}
```

This populates `og:title`, `og:description` and the `twitter:*` tags at build time through
`scripts/generate-route-html.mjs`. Without it the view gets the generic site-level
description whenever someone shares it.

## Declare the scene before writing Three.js

Audit what `SetupConfig` already covers in `packages/threejs/src/types.ts` — `scene.backgroundColor`,
`lights.ambient` / `directional` / `hemisphere` / `point` / `spot` / `rectArea` /
`environment`, `ground.color` / `size` / `texture`,
`sky.color` / `texture` / `size`, `camera.position` / `fov` / `near` / `far`, `orbit`,
`postprocessing` — then declare the layout in `config.ts` rather than inlining numbers in
the component:

```typescript
import type { SetupConfig } from '@webgamekit/threejs'

export const sceneSetupConfig: SetupConfig = {
  scene: { backgroundColor: 0x1a1a2e },
  lights: {
    ambient: { color: 0xffffff, intensity: 1.5 },
    directional: { color: 0xffffff, intensity: 2, position: [20, 30, 20], castShadow: true }
  },
  ground: { color: 0x2c3e50, size: 200 },
  sky: false,
  orbit: false
}
```

Then hand it to `setup()`, loading models inside `defineSetup`:

```typescript
const { setup, renderer, scene, world, getDelta } = await getTools({ canvas: canvas.value })

await setup({
  config: sceneSetupConfig,
  defineSetup: async () => {
    character = await getModel(scene, world, 'player.glb', playerSettings.model)
  }
})
```

Raw Three.js is for what `SetupConfig` genuinely does not cover — an `OrthographicCamera`,
or geometry that maps to no `getCube` / `getModel` primitive. Ask before writing it, because
the right answer is often to extend the package. What not to do:

```typescript
// Wrong — this is what SetupConfig is for
const ambientLight = new THREE.AmbientLight(0xffffff, 1.5)
scene.add(ambientLight)
scene.add(new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshLambertMaterial()))
```

## Wiring the panels

All user-facing controls live in the panels. Register two configurations: **Config** for
runtime game settings, **Scene** for everything `SetupConfig` covers.

```typescript
import { registerViewConfig, createReactiveConfig } from '@/composables/useViewConfig'

const reactiveConfig = createReactiveConfig({
  player: { speed: { movement: 2, turning: 4, jump: 4 }, maxJump: 4 }
})

const sceneConfig = createReactiveConfig({
  camera: { preset: 'perspective', fov: 80, position: { x: 0, y: 7, z: 35 } },
  ground: { color: 0x98887d },
  sky: { color: 0x00aaff }
})

const configControls = {
  player: {
    speed: {
      movement: { min: 0.5, max: 5, step: 0.5 },
      turning: { min: 1, max: 10 },
      jump: { min: 1, max: 10 }
    },
    maxJump: { min: 1, max: 20 }
  }
}

const sceneControls = {
  camera: {
    preset: {
      label: 'Camera Preset',
      options: ['perspective', 'orthographic', 'fisheye', 'cinematic', 'orbit']
    },
    fov: { min: 30, max: 120 },
    position: { x: { min: -50, max: 50 }, y: { min: 0, max: 50 }, z: { min: 10, max: 100 } }
  },
  ground: { color: { color: true } },
  sky: { color: { color: true } }
}

onMounted(() => {
  registerViewConfig(
    route.name as string,
    reactiveConfig,
    configControls,
    sceneConfig,
    sceneControls
  )
  setViewPanels({ showConfig: true, showScene: true })
})

onUnmounted(() => unregisterViewConfig(route.name as string))
```

`config.ts` exports `configControls` and `sceneControls` separately.

## Registering a new package

A new `@webgamekit/*` package must be added to the `packages` array in `vite.config.ts`:

```ts
const packages = [
  'animation',
  'threejs',
  'audio',
  'game',
  'controls',
  'recording',
  'logic',
  'multiplayer-p2p',
  'dictionary',
  'chat',
  'canvas-editor',
  'your-new-package' // add here
]
```

Omit it and Vite resolves the import through `node_modules` to the built `dist`. If that
build is stale or missing a new export, the app throws a runtime `SyntaxError` — in dev and
in Docker alike. This is the single most common cause of a package appearing to be broken
when the source is fine.

## What belongs in config.ts

Model configurations, the setup config, control bindings, game settings such as speeds and
distances, and asset paths. Example: [GoombaRunner/config.ts](https://github.com/cnotv/generative-art/blob/main/src/views/Games/GoombaRunner/config.ts).

## Commands

| Command                 | Does                                |
| ----------------------- | ----------------------------------- |
| `pnpm dev`              | dev server                          |
| `pnpm host --port 3000` | network-accessible dev server       |
| `pnpm build`            | production build, type-checks first |
| `pnpm test:unit`        | Vitest                              |
| `pnpm lint`             | ESLint with `--fix`                 |

Edit `packages/*/src/**` directly — Vite resolves the aliases, so changes hot-reload without
a rebuild. `docker-compose up` runs the containerised equivalent via `pnpm host`.
