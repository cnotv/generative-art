# Generative Art - WebGameKit Project

This is a Vue 3 + TypeScript monorepo for creating 3D games and interactive generative art using Three.js, Rapier physics, and custom game development packages.

## Architecture Overview

The project is organized as a **pnpm workspace monorepo**:
- **Main app** (`src/`): Vue 3 SPA with route-based scene organization
- **Packages** (`packages/@webgamekit/*`): Reusable game development libraries
  - `threejs`: Three.js + Rapier physics integration, scene setup, model loading
  - `animation`: Character animation, physics-based movement, timeline system
  - `controls`: Multi-input controller (keyboard, gamepad, touch, mouse)
  - `game`: Reactive game state management
  - `audio`: Audio playback utilities

### Data Flow Pattern
1. Views import from `@webgamekit/*` packages (aliased in vite.config.ts)
2. Each view is a self-contained scene using `<script setup>` composition
3. `getTools()` initializes Three.js renderer, scene, camera, Rapier world
4. `setup()` configures lights, ground, sky, camera, and defines scene objects
5. `animate()` runs timeline-based update loops (physics, animations, controls)

## Code Style & Best Practices

### Functional Programming
- **Prefer pure functions**: Avoid side effects, return new values instead of mutating
- **Function composition**: Chain small, reusable functions rather than large imperative blocks
- **Immutability**: Use `const`, spread operators, and avoid direct mutations
- **Array methods**: Prefer `map`, `filter`, `reduce` over `for` loops

### TypeScript
- **Always use TypeScript**: All new code must be TypeScript (`.ts`, `.vue` with `<script setup lang="ts">`)
- **Explicit types**: Define types/interfaces for configs, function parameters, and return values
- **Type safety**: Use `CoordinateTuple` for position/rotation/scale arrays, avoid `any`
- **Export types**: Re-export types from package `index.ts` for public APIs

### Modular Architecture
- **Barrel exports**: Use `index.ts` files to export public APIs (see `packages/*/src/index.ts`)
- **Abstract functions**: Extract reusable logic into separate functions/modules
- **Single responsibility**: Keep functions focused on one task
- **Framework-agnostic packages**: `@webgamekit/*` packages must not depend on Vue/React

### Testing
- **Always add unit tests**: Create `.test.ts` files alongside implementation files
- **Test framework**: Use Vitest (`pnpm test:unit`)
- **Test coverage**: Test core logic, edge cases, and public APIs
- **Example pattern**: See `packages/controls/src/core.test.ts`

### CSS Conventions
- **BEM methodology**: Use Block__Element--Modifier naming for all CSS classes
- **Scoped styles**: Use `<style scoped>` in Vue components
- **Example**: `.player-controls__button--active`, `.game-ui__score-display`

### Linting
- **Run lint before commit**: Husky + lint-staged enforces this automatically
- **ESLint config**: Follow project's ESLint rules (Vue + TypeScript + Prettier)
- **Fix on save**: Run `pnpm lint` to auto-fix issues
- **No warnings**: Address all lint warnings, don't suppress without reason

## Key Development Patterns

### Creating a New 3D Scene/Game View

1. **File structure**: Create `src/views/{Group}/{SceneName}/{SceneName}.vue` (or `index.vue`)
   - Router auto-discovers views matching pattern `{Dir}/{Name}/{Name}.vue`
   - Example: `src/views/Games/ForestGame/ForestGame.vue`

2. **Basic scene template**:
```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { getTools, getModel } from '@webgamekit/threejs';

const canvas = ref<HTMLCanvasElement | null>(null);

const init = async () => {
  if (!canvas.value) return;
  
  const { setup, animate, scene, world, camera, getDelta } = await getTools({
    canvas: canvas.value
  });
  
  await setup({
    config: {
      camera: { position: [0, 10, 20] },
      orbit: false, // disable OrbitControls for games
    },
    defineSetup: async () => {
      // Load models, create objects
      const player = await getModel(scene, world, "model.glb", {
        position: [0, 0, 0],
        castShadow: true,
      });
      
      animate({
        timeline: [
          {
            frequency: 1, // run every frame
            action: () => {
              // Update logic
            }
          }
        ]
      });
    }
  });
};

onMounted(init);
</script>

<template>
  <canvas ref="canvas"></canvas>
</template>
```

### Working with @webgamekit Packages

**Import from source during development** (not build artifacts):
- Vite aliases resolve to `packages/{pkg}/src/index.ts` for HMR
- Changes to packages hot-reload without rebuilding

**Common imports**:
```typescript
import { getTools, getModel, getCube, instanceMatrixMesh } from '@webgamekit/threejs';
import { controllerForward, controllerTurn, updateAnimation, type ComplexModel } from '@webgamekit/animation';
import { createControls } from '@webgamekit/controls';
import { createGame, type GameState } from '@webgamekit/game';
import { initializeAudio, playAudioFile } from '@webgamekit/audio';
```

### Timeline Animation System

The `animate()` function uses a **timeline-based loop** instead of raw requestAnimationFrame:
```typescript
animate({
  beforeTimeline: () => { /* runs once per frame before timeline */ },
  timeline: [
    {
      name: "Movement",
      frequency: 2, // run every 2 frames
      action: () => { /* game logic */ }
    },
    {
      interval: [100, 50], // active for 100 frames, pause for 50
      delay: 10, // start after 10 frames
      action: () => { /* timed behavior */ }
    }
  ],
  afterTimeline: () => { /* runs once per frame after timeline */ }
});
```

### Controls System

**Multi-input unified API** (keyboard, gamepad, touch, mouse):
```typescript
const { destroyControls, currentActions, remapControlsOptions } = createControls({
  mapping: {
    keyboard: { ArrowUp: 'forward', ' ': 'jump' },
    gamepad: { left: 'turn-left', a: 'jump' },
    touch: { swipeUp: 'jump' }
  },
  onAction: (action, trigger, device) => {
    // action triggered (e.g., 'jump')
  },
  onRelease: (action) => {
    // action released
  }
});

// Check state in timeline
if (currentActions['forward']) {
  controllerForward(player, obstacles, distance, getDelta());
}
```

### Physics & Models

**ComplexModel type**: Three.js mesh with `userData.body` (Rapier RigidBody) and `userData.mixer` (AnimationMixer)

**Model configuration pattern**:
```typescript
const playerConfig = {
  position: [0, 2, 0] as CoordinateTuple,
  scale: [1, 1, 1] as CoordinateTuple,
  rotation: [0, 0, 0] as CoordinateTuple,
  castShadow: true,
  material: "MeshLambertMaterial",
  color: 0xffffff,
  hasGravity: true,
  type: "dynamic", // or "fixed", "kinematicPositionBased"
  mass: 1,
  friction: 0.5,
  restitution: 0.3,
};
```

### Configuration Separation

Keep scene configs in separate `config.ts` files:
- Model configurations (player, obstacles, illustrations)
- Setup config (camera, lights, ground, postprocessing)
- Control bindings
- Game settings (speeds, distances)
- Asset paths

Example: [ForestGame/config.ts](src/views/Games/ForestGame/config.ts)

## Build & Development

**Commands**:
- `pnpm dev` - Start dev server
- `pnpm host --port 3000` - Network-accessible dev server
- `pnpm build` - Production build (type-checks first)
- `pnpm test:unit` - Run Vitest tests
- `pnpm lint` - ESLint fix

**Package development**: Edit `packages/*/src/**` files directly. Vite resolves aliases for HMR.

**Docker**: Use `docker-compose up` for containerized development (runs `pnpm host`)

## Router Conventions

- Routes auto-generate from `src/views/{Group}/{Name}/{Name}.vue` structure
- Group directories: `Games/`, `Experiments/`, `Generative/`, `Tools/`, `Stages/`
- Component name becomes route: `GoombaRunner/GoombaRunner.vue` → `/games/GoombaRunner`
- Index files: `SceneName/index.vue` also supported
- Route titles auto-format: `CubeMatrix` → "Cube Matrix"

## Orbit Controls

OrbitControls are **enabled by default** in `getTools()`:
```typescript
const { orbit } = await getTools({ canvas: canvas.value });

// Configure in setup
await setup({
  config: {
    orbit: { 
      target: new THREE.Vector3(0, 0, 0),
      disabled: false 
    }
  }
});

// Disable for games (to avoid camera conflicts)
config: { orbit: false }
```

## Common Gotchas

- **WASM loading**: Rapier physics requires `vite-plugin-wasm` and `optimizeDeps.exclude: ['@dimforge/rapier3d-compat']`
- **Cleanup**: Always call `destroyControls()` and cleanup functions in `onUnmounted`
- **Reactive state**: Use `shallowRef` for game state to avoid deep reactivity overhead
- **Canvas ref**: Ensure canvas ref is not null before calling `getTools()`
- **CoordinateTuple**: Always type position/rotation/scale arrays as `CoordinateTuple` for type safety

## File Organization

```
src/
  views/{Group}/{SceneName}/
    {SceneName}.vue     # Main scene component
    config.ts           # Configuration separate from logic
    helpers/            # Scene-specific utilities
  config/
    router.ts           # Auto-route generation
    scenes.ts           # Shared scene configs
  utils/                # Global utilities

packages/@webgamekit/
  {pkg}/src/
    index.ts            # Public API exports
    types.ts            # Type definitions
    core.ts             # Main implementation
```
