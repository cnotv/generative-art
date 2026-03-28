---
sidebar_position: 1
---

# Package: @webgamekit/threejs

Core 3D engine with Three.js and Rapier physics integration.

## Installation

```bash
pnpm add @webgamekit/threejs three @dimforge/rapier3d-compat
```

## Quick Start

```typescript
import { getTools } from '@webgamekit/threejs';
import { createTimelineManager } from '@webgamekit/animation';

const { setup, animate, scene, camera, world } = await getTools({
  canvas: canvasRef.value!,
});

await setup({
  config: {
    camera: {
      position: [0, 5, 20],
      fov: 75
    },
    lights: {
      ambient: { intensity: 0.5 },
      directional: { position: [10, 20, 10] }
    },
    ground: {
      size: [100, 1, 100],
      color: 0x68b469
    }
  },
  defineSetup: async () => {
    // Your scene setup code
  }
});

const timeline = createTimelineManager();
timeline.addAction({ id: 'update', action: () => { /* per-frame logic */ } });

animate({ timeline });
```

## Core Functions

### getTools(config)

Initialize a Three.js + Rapier environment.

**Parameters:**

```typescript
{
  canvas: HTMLCanvasElement,
  stats?: StatsInterface,
  route?: string,
  resize?: boolean  // default: true
}
```

**Returns:**

```typescript
{
  setup: Function,
  animate: Function,
  clock: THREE.Clock,
  getDelta: () => number,
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  orbit: OrbitControls | null,
  world: RAPIER.World
}
```

### setup(options)

Configure scene with camera, lights, ground, and sky.

**Parameters:**

```typescript
{
  config?: SetupConfig,
  defineSetup?: () => Promise<void> | void
}
```

**SetupConfig:**

```typescript
{
  camera?: {
    position?: CoordinateTuple | THREE.Vector3,
    fov?: number,
    near?: number,
    far?: number,
    rotation?: CoordinateTuple | THREE.Vector3,
    lookAt?: CoordinateTuple | THREE.Vector3
  },
  lights?: {
    ambient?: { color?: number, intensity?: number },
    directional?: {
      color?: number,
      intensity?: number,
      position?: CoordinateTuple,
      castShadow?: boolean
    }
  },
  ground?: false | {
    size?: CoordinateTuple,
    color?: number,
    position?: CoordinateTuple,
    texture?: string
  },
  sky?: { color?: number },
  orbit?: { target?: THREE.Vector3, disabled?: boolean },
  postprocessing?: PostProcessingConfig
}
```

### animate(options)

Start the animation loop.

**Parameters:**

```typescript
{
  timeline: TimelineManager,  // from createTimelineManager()
  beforeTimeline?: () => void,
  afterTimeline?: () => void,
}
```

**Example:**

```typescript
import { createTimelineManager } from '@webgamekit/animation';

const timeline = createTimelineManager();
timeline.addAction({
  id: 'game-tick',
  action: () => { /* update logic */ }
});

animate({ timeline });
```

## Model Loading

### getModel(scene, world, filename, options)

Load a GLTF/FBX model with optional physics body.

```typescript
import { getModel } from '@webgamekit/threejs';

const player = await getModel(scene, world, 'character.glb', {
  position: [0, 0, 0],
  scale: [1, 1, 1],
  type: 'kinematicPositionBased',
  hasGravity: false,
  castShadow: true,
  boundary: 0.5,
  showHelper: true,
  helperColor: 0x00ff88,
});
```

**ModelOptions:**

```typescript
{
  position?: CoordinateTuple,
  rotation?: CoordinateTuple,
  scale?: CoordinateTuple | number,
  size?: CoordinateTuple,        // Physics collider size
  boundary?: number,             // Collider boundary margin
  type?: 'fixed' | 'dynamic' | 'kinematicPositionBased',
  hasGravity?: boolean,
  castShadow?: boolean,
  receiveShadow?: boolean,
  showHelper?: boolean,
  helperColor?: number,
  name?: string,
}
```

### getCube(scene, world, options)

Create a cube with physics.

```typescript
import { getCube } from '@webgamekit/threejs';

const cube = getCube(scene, world, {
  size: [2, 2, 2],
  position: [0, 5, 0],
  color: 0xff0000,
  type: 'dynamic',
});
```

### getBall(scene, world, options)

Create a sphere with physics.

```typescript
const ball = getBall(scene, world, {
  size: 1,
  position: [0, 10, 0],
  color: 0x00ff00,
  type: 'dynamic',
});
```

### getWalls(scene, world, positions, options)

Create multiple wall segments from an array of positions.

```typescript
import { getWalls } from '@webgamekit/threejs';

const walls = getWalls(scene, world, wallPositions, {
  size: [4, 3, 0.25],
  color: 0xffffff,
  type: 'fixed',
});
```

## Physics Controller

### moveController(model, direction, filterPredicate?)

Move a kinematic character controller with collision sliding. Uses Rapier's character controller to compute collider movement and syncs the mesh position.

```typescript
import { moveController } from '@webgamekit/threejs';

// In animation loop
moveController(playerModel, {
  x: velocityX,
  y: 0,
  z: velocityZ,
});

// With collision filter (exclude specific colliders)
moveController(playerModel, direction, (collider) => {
  return collider !== elevatorCollider;
});
```

## Camera Utilities

### cameraFollowPlayer(camera, player, offset, orbit?)

Make camera follow a player model.

```typescript
import { cameraFollowPlayer } from '@webgamekit/threejs';

// In animation loop
cameraFollowPlayer(camera, playerModel, [0, 5, 10], orbit);
```

### setCameraPreset(camera, preset)

Apply a camera preset configuration.

```typescript
import { setCameraPreset, CameraPreset } from '@webgamekit/threejs';

setCameraPreset(camera, CameraPreset.TopDown);
```

### updateCamera(camera, config)

Update camera properties at runtime.

```typescript
import { updateCamera } from '@webgamekit/threejs';

updateCamera(camera, {
  position: [0, 10, 20],
  lookAt: [0, 0, 0],
  fov: 60
});
```

## Scene Management

### removeElements(world, meshes)

Remove objects from the scene and their Rapier physics bodies.

```typescript
import { removeElements } from '@webgamekit/threejs';

// Cleans up Three.js objects and Rapier bodies
removeElements(world, [coin1, coin2, coin3]);
```

### instanceMatrixMesh(scene, geometry, material, options)

Create an instanced mesh for rendering many identical objects efficiently.

```typescript
import { instanceMatrixMesh } from '@webgamekit/threejs';

const trees = instanceMatrixMesh(scene, geometry, material, treePositions);
```

## Texture Utilities

### createZigzagTexture(options)

Create a procedural zigzag pattern texture.

```typescript
import { createZigzagTexture } from '@webgamekit/threejs';

const texture = createZigzagTexture({
  size: 64,
  backgroundColor: '#68b469',
  zigzagColor: '#4a7c59',
  repeatX: 50,
  repeatY: 50
});

material.map = texture;
```

## Post-Processing Effects

Configure visual effects in `setup`:

```typescript
await setup({
  config: {
    postprocessing: {
      bloom: { strength: 0.8, threshold: 0.2, radius: 1.0 },
      vignette: { offset: 1.2, darkness: 1.3 },
      pixelate: { size: 8 }
    }
  }
});
```

**Available effects:** `bloom`, `vignette`, `pixelate`, `fxaa`, `dotScreen`, `rgbShift`, `film`, `glitch`, `afterimage`, `ssao`, `colorCorrection`.

## TypeScript Types

```typescript
import type {
  CoordinateTuple,
  ModelOptions,
  SetupConfig,
  ToolsConfig,
  ComplexModel,
  Model,
} from '@webgamekit/threejs';
```
