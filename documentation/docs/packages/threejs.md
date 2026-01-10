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

const { setup, animate, scene, camera, world } = await getTools({
  canvas: canvasRef.value!,
  stats,
  route
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

animate({
  beforeTimeline: () => {
    // Pre-update logic
  },
  timeline: [
    // Animation loops
  ],
  afterTimeline: () => {
    // Post-update logic
  }
});
```

## Core Functions

### getTools(config)

Initialize ThreeJS and Rapier environment.

**Parameters**:
```typescript
{
  canvas: HTMLCanvasElement,
  stats?: StatsInterface,
  route?: string
}
```

**Returns**:
```typescript
{
  setup: Function,
  animate: Function,
  clock: THREE.Clock,
  getDelta: () => number,
  getFrame: () => number,
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  orbit: OrbitControls | null,
  world: RAPIER.World
}
```

### setup(options)

Configure scene with camera, lights, ground, and sky.

**Parameters**:
```typescript
{
  config?: SetupConfig,
  defineSetup?: () => Promise<void> | void
}
```

**SetupConfig**:
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
  ground?: {
    size?: CoordinateTuple,
    color?: number,
    position?: CoordinateTuple,
    texture?: string
  },
  sky?: {
    color?: number,
    gradient?: [number, number]
  },
  orbit?: {
    target?: THREE.Vector3,
    disabled?: boolean
  },
  postprocessing?: PostProcessingConfig
}
```

### animate(options)

Start the animation loop with timeline support.

**Parameters**:
```typescript
{
  beforeTimeline?: () => void,
  afterTimeline?: () => void,
  timeline?: Timeline[],
  config?: {
    orbit?: { debug?: boolean }
  }
}
```

## Model Loading

### getCube(scene, world, options)

Create a cube with physics.

```typescript
import { getCube } from '@webgamekit/threejs';

const cube = getCube(scene, world, {
  size: [2, 2, 2],
  position: [0, 5, 0],
  color: 0xff0000,
  mass: 1,
  friction: 0.5
});
```

### getBall(scene, world, options)

Create a sphere with physics.

```typescript
const ball = getBall(scene, world, {
  size: 1,
  position: [0, 10, 0],
  color: 0x00ff00,
  mass: 2,
  restitution: 0.8 // Bounciness
});
```

### loadModel(path, scene, world, options)

Load GLTF models.

```typescript
const model = await loadModel('/models/character.glb', scene, world, {
  position: [0, 0, 0],
  scale: [1, 1, 1],
  castShadow: true,
  receiveShadow: true
});
```

## Camera Utilities

### updateCamera(camera, config)

Update camera properties.

```typescript
import { updateCamera } from '@webgamekit/threejs';

updateCamera(camera, {
  position: [0, 10, 20],
  lookAt: [0, 0, 0],
  fov: 60
});
```

### cameraFollowPlayer(camera, player, offset, orbit)

Make camera follow a player model.

```typescript
import { cameraFollowPlayer } from '@webgamekit/threejs';

// In animation loop
cameraFollowPlayer(camera, player, [0, 5, 10], orbit);
```

## Texture Utilities

### createZigzagTexture(options)

Create procedural zigzag pattern texture.

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

Configure visual effects in setup:

```typescript
await setup({
  config: {
    postprocessing: {
      bloom: {
        strength: 0.8,
        threshold: 0.2,
        radius: 1.0
      },
      vignette: {
        offset: 1.2,
        darkness: 1.3
      },
      pixelate: {
        size: 8
      }
    }
  }
});
```

**Available effects**:
- `bloom`: Glow effect
- `vignette`: Dark edges
- `pixelate`: Retro pixel look
- `fxaa`: Anti-aliasing
- `dotScreen`: Dot matrix effect
- `rgbShift`: Color separation
- `film`: Grain and scanlines
- `glitch`: Digital glitch
- `afterimage`: Motion trails
- `ssao`: Ambient occlusion
- `colorCorrection`: Contrast/saturation/brightness

## Physics

### Creating Physics Bodies

```typescript
const cube = getCube(scene, world, {
  position: [0, 5, 0],
  mass: 1,            // 0 for static objects
  friction: 0.5,
  restitution: 0.3,   // Bounciness
  damping: 0.1,       // Slow down over time
  hasGravity: true
});

// Access physics body
cube.userData.body.applyImpulse({ x: 0, y: 10, z: 0 }, true);
```

### Removing Objects

```typescript
import { removeElements } from '@webgamekit/threejs';

const cubes = [cube1, cube2, cube3];
removeElements(scene, world, cubes); // Cleans up Three.js and Rapier
```

## Timeline System

Create animation loops:

```typescript
animate({
  timeline: [
    {
      id: 'physics-update',
      every: 1, // Every frame
      do: () => {
        // Update physics
      }
    },
    {
      id: 'spawn-cubes',
      every: 60, // Every 60 frames
      do: () => {
        // Spawn new cube
      }
    }
  ]
});
```

## Best Practices

### Performance

- **Instancing**: Use `instanceMatrixMesh` for many similar objects
- **LOD**: Reduce detail for distant objects
- **Object pooling**: Reuse objects instead of creating/destroying
- **Limit physics**: Keep physics objects count reasonable

### Code Organization

```typescript
// config.ts - Separate configuration
export const setupConfig = {
  camera: { position: [0, 5, 20] },
  lights: { ambient: { intensity: 0.5 } }
};

export const playerConfig = {
  size: [1, 2, 1],
  speed: 5,
  jumpForce: 10
};

// scene.vue - Main component
import { setupConfig, playerConfig } from './config';
```

### Cleanup

```vue
<script setup lang="ts">
import { onUnmounted } from 'vue';

onUnmounted(() => {
  // Cancel animation frame
  cancelAnimationFrame(frame);
  
  // Dispose geometries and materials
  scene.traverse((object) => {
    if (object.geometry) object.geometry.dispose();
    if (object.material) object.material.dispose();
  });
});
</script>
```

## TypeScript Types

```typescript
import type {
  CoordinateTuple,
  ModelOptions,
  SetupConfig,
  ToolsConfig
} from '@webgamekit/threejs';

const position: CoordinateTuple = [0, 5, 0];

const modelOptions: ModelOptions = {
  position: [0, 0, 0],
  color: 0xff0000,
  mass: 1
};
```
