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
import { getTools } from '@webgamekit/threejs'
import { createTimelineManager } from '@webgamekit/animation'

const { setup, animate, scene, camera, world } = await getTools({
  canvas: canvasRef.value!
})

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
})

const timeline = createTimelineManager()
timeline.addAction({
  id: 'update',
  action: () => {
    /* per-frame logic */
  }
})

animate({ timeline })
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
    environment?: false | { texture?: string, intensity?: number },
    ambient?: false | { color?: number, intensity?: number },
    directional?: false | {
      color?: number,
      intensity?: number,
      position?: CoordinateTuple,
      castShadow?: boolean,
      helper?: boolean
    },
    hemisphere?: { colors?: [number, number], intensity?: number, helper?: boolean },
    point?: { color?: number, intensity?: number, position?: CoordinateTuple, helper?: boolean },
    spot?: { color?: number, intensity?: number, angle?: number, penumbra?: number, helper?: boolean },
    rectArea?: { color?: number, intensity?: number, width?: number, height?: number, helper?: boolean }
  },
  ground?: false | {
    size?: CoordinateTuple,
    color?: number,
    position?: CoordinateTuple,  // the TOP SURFACE, not the centre; defaults to [1, -1, 1]
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
import { createTimelineManager } from '@webgamekit/animation'

const timeline = createTimelineManager()
timeline.addAction({
  id: 'game-tick',
  action: () => {
    /* update logic */
  }
})

animate({ timeline })
```

## Asset Pipeline

Every loader shares one `THREE.LoadingManager` and one URL-keyed cache. A url is fetched and
parsed once however many times it is requested, and requests that overlap in flight share a
single download rather than racing into several.

`getModel`, `loadGLTF` and `loadFBX` already go through this — there is nothing to opt into.
The functions below are for controlling it directly.

### assetsPreload(paths, parse?)

Have everything a scene needs ready before it starts, so loads do not resolve mid-frame.
Assets already in the cache are not read again.

```typescript
import { assetsPreload } from '@webgamekit/threejs'

await assetsPreload(['models/player.glb', 'models/tree.glb', 'textures/ground.png'])
```

The loader is chosen from the file extension: `.glb` and `.gltf`, `.fbx`, and the image
formats `.png`, `.jpg`, `.jpeg`, `.webp`, `.avif`, `.ktx2`. Pass `parse` for an asset whose
url does not end in one of those.

### assetsOnProgress(listener)

Bind a loading screen to the queue. The listener is called as each item completes and returns
a function that unsubscribes.

```typescript
import { assetsOnProgress } from '@webgamekit/threejs'

const stop = assetsOnProgress(({ url, loaded, total, fraction }) => {
  progressBar.style.width = `${fraction * 100}%`
})
```

`fraction` is `1` for an empty queue rather than `NaN`.

### assetsRelease(url) and assetsIsCached(url)

`assetsRelease` drops one consumer's claim. The last release disposes the source's geometries,
materials and textures; loading the same url afterwards reads it again.

```typescript
import { assetsRelease } from '@webgamekit/threejs'

onUnmounted(() => assetsRelease('models/player.glb'))
```

**Freeing a cached model is `assetsRelease`, not `disposeObject`.** `loadGLTF` and `loadFBX`
return a copy that shares geometry and textures with the cached source. `disposeObject` and
`disposeScene` know this and skip anything the cache owns, so a view tearing itself down on
unmount is safe and stays safe — but it also means those calls do not free a cached model.
Only the last `assetsRelease` for a url does. Materials are copied per instance, so restyling
one model never changes another.

`assetsReleaseAll()` drops everything regardless of who holds it, for tearing down a whole
scene.

### assetsLoad(url, parse)

The primitive underneath all of the above, for a source the built-in loaders do not cover.
`parse` runs only on the first request for a url.

```typescript
import { assetsLoad } from '@webgamekit/threejs'

const level = await assetsLoad('levels/forest.bin', async (url) => decodeLevel(await fetch(url)))
```

A failed load rejects with the failing url in the message and is **not** cached, so one bad
response does not become permanent for the session.

## Model Loading

### getModel(scene, world, filename, options)

Load a GLTF/FBX model with optional physics body.

```typescript
import { getModel } from '@webgamekit/threejs'

const player = await getModel(scene, world, 'character.glb', {
  position: [0, 0, 0],
  scale: [1, 1, 1],
  type: 'kinematicPositionBased',
  hasGravity: false,
  castShadow: true,
  boundary: 0.5,
  showHelper: true,
  helperColor: 0x00ff88
})
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

**`position` is the bottom of the box, not its centre** — it defaults to `origin: { y: 0 }`, so
`position: [0, 0, 0]` rests the cube on `y = 0`. Pair that with a ground whose `position` puts its
top surface at the same height, or objects hang in the air.

```typescript
import { getCube } from '@webgamekit/threejs'

const cube = getCube(scene, world, {
  size: [2, 2, 2],
  position: [0, 5, 0],
  color: 0xff0000,
  type: 'dynamic'
})
```

### getBall(scene, world, options)

Create a sphere with physics.

```typescript
const ball = getBall(scene, world, {
  size: 1,
  position: [0, 10, 0],
  color: 0x00ff00,
  type: 'dynamic'
})
```

### getWalls(scene, world, positions, options)

Create multiple wall segments from an array of positions.

```typescript
import { getWalls } from '@webgamekit/threejs'

const walls = getWalls(scene, world, wallPositions, {
  size: [4, 3, 0.25],
  color: 0xffffff,
  type: 'fixed'
})
```

## Physics Sync

Rapier and Three.js keep separate transforms. `animate` steps the world, which moves the
**bodies** — nothing moves the meshes until you copy the transform across. Skip this and every
dynamic object simulates correctly and renders frozen, which looks like broken input.

### syncMeshWithBody(mesh, verticalOffset?)

```typescript
import { syncMeshWithBody } from '@webgamekit/threejs'

timeline.addAction({
  name: 'draw the player where physics put it',
  category: 'physics',
  action: () => syncMeshWithBody(player)
})
```

`verticalOffset` shifts the drawn position, for meshes whose origin is not their centre. A mesh
with no rigid body is left alone rather than throwing, so a mixed list is safe.

### syncMeshesWithBodies(meshes, verticalOffset?)

The same for a list — call once per frame for everything dynamic in the scene.

```typescript
import { syncMeshesWithBodies } from '@webgamekit/threejs'

timeline.addAction({
  name: 'sync physics',
  category: 'physics',
  action: () => syncMeshesWithBodies([player, ...crates])
})
```

`hasPhysicsBody(mesh)` reports whether a mesh has a body to sync from.

Kinematic character controllers do not need this: `moveController` already writes the mesh
position as it resolves the move.

## Physics Controller

### moveController(model, direction, filterPredicate?)

Move a kinematic character controller with collision sliding. Uses Rapier's character controller to compute collider movement and syncs the mesh position.

```typescript
import { moveController } from '@webgamekit/threejs'

// In animation loop
moveController(playerModel, {
  x: velocityX,
  y: 0,
  z: velocityZ
})

// With collision filter (exclude specific colliders)
moveController(playerModel, direction, (collider) => {
  return collider !== elevatorCollider
})
```

## Prefabs

A prefab is a game object declared once as data and spawned as often as you like. It is a
plain object, not a builder — there is nothing to construct and nothing to register.

```typescript
import type { Prefab } from '@webgamekit/threejs'

export const crate: Prefab = {
  name: 'crate',
  model: 'models/crate.glb',
  options: { scale: [2, 2, 2], type: 'dynamic', castShadow: true, boundary: 0.5 },
  parameters: { health: 40, breakable: true }
}
```

### prefabSpawn(scene, world, prefab, overrides?)

Brings the mesh, the collider and the parameters into the scene together. What comes back is
the same `ComplexModel` `getModel` returns, so the animation loop needs no changes.

```typescript
import { prefabSpawn } from '@webgamekit/threejs'

const box = await prefabSpawn(scene, world, crate, { position: [10, 0, 4] })

box.userData.parameters.health // 40
box.userData.prefab // 'crate'
```

Overrides are merged over the declared options and the prefab itself is never mutated, so the
next spawn starts from the same declaration. Repeated spawns share one download and one parse
through the asset cache.

### prefabDespawn(scene, world, instance)

Removes the mesh, the rigid body and the debug helper — the third being the one hand-written
teardown usually forgets. Geometry and textures are deliberately left alone, because the asset
cache still owns them.

```typescript
import { prefabDespawn } from '@webgamekit/threejs'

prefabDespawn(scene, world, box)
```

Safe on an instance with no physics body, and safe to call twice.

### prefabPreload(prefabs, preload)

Load every model a set of prefabs needs before the scene starts, deduplicated by path.

```typescript
import { prefabPreload, assetsPreload } from '@webgamekit/threejs'

await prefabPreload([crate, barrel, enemy], assetsPreload)
```

## Camera Paths

For intros, replays and cutscenes: the camera travels a declared route over a fixed duration.
Sampling is arc-length parameterised, so it holds a steady speed rather than accelerating
through tightly spaced points.

Every behaviour below can be compared side by side in the `/tests/CameraShowcase` view, which
is also where to see what each one looks like.

### cameraPathCreate(camera, options)

```typescript
import { cameraPathCreate } from '@webgamekit/threejs'
import { easing } from '@webgamekit/animation'

const intro = cameraPathCreate(camera, {
  points: [
    { position: [0, 5, 20], lookAt: [0, 0, 0] },
    { position: [20, 8, 0], lookAt: [0, 0, 0] },
    { position: [0, 5, -20], lookAt: [0, 0, 0] }
  ],
  seconds: 6,
  easing: easing.easeOutQuad,
  onComplete: () => startGame()
})
```

Give every point a `lookAt` to hold focus on something while the camera moves around it; omit
it on all of them to leave orientation alone. `onComplete` fires once, not on every frame after
the end.

Drive it from the animation loop and stop when it hands the camera back:

```typescript
animate({
  timeline,
  beforeTimeline: () => intro.update(getDelta())
})
```

`update` returns `true` for the frames it owned the camera, including the one that lands on the
final point, and `false` from then on. `intro.cancel()` gives the camera back early.

### cameraPathIsActive()

A path owns the camera while it runs. A follow camera should stand down for those frames rather
than fight it for the same transform:

```typescript
import { cameraPathIsActive, followCameraPlacement } from '@webgamekit/threejs'

if (!cameraPathIsActive()) {
  const placement = followCameraPlacement(player, followConfig)
  camera.position.copy(placement.position)
  camera.lookAt(placement.lookAt)
}
```

The follow camera resumes by itself once the path completes or is cancelled — there is nothing
to restore.

## Camera Utilities

### cameraFollowPlayer(camera, player, offset, orbit?)

Make camera follow a player model.

```typescript
import { cameraFollowPlayer } from '@webgamekit/threejs'

// In animation loop
cameraFollowPlayer(camera, playerModel, [0, 5, 10], orbit)
```

### setCameraPreset(camera, preset)

Apply a camera preset configuration.

```typescript
import { setCameraPreset, CameraPreset } from '@webgamekit/threejs'

setCameraPreset(camera, CameraPreset.TopDown)
```

### getCylinder(scene, world, options)

Create a cylinder with physics, for anything round that the cuboid and ball primitives cannot be
— a column, a pillar, a barrel.

```typescript
import { getCylinder } from '@webgamekit/threejs'

getCylinder(scene, world, {
  name: 'column',
  size: [2.2, 16, 2.2], // [diameter, height, diameter], read the same way a cube reads its size
  position: [0, 3, -9], // the underside, as getCube positions from
  segments: 24,
  type: 'fixed',
  texture: marbleTexture,
  textureRepeat: [1, 3]
})
```

`size` and `position` follow `getCube` exactly, so one can be swapped for the other without
rethinking a layout. The collider is a Rapier cylinder rather than a box, so a ball rolling
against it behaves as the shape looks.

### textureRepeat on a model

Without it a texture is stretched once across whatever it is put on, so the same stone reads at
a different grain on a wide step than on a narrow column. `textureRepeat: [horizontal, vertical]`
tiles it instead, and the wrapping needed for that is set for you.

```typescript
const tile = 6
const repeat = (width: number, height: number): [number, number] => [
  Math.max(1, Math.round(width / tile)),
  Math.max(1, Math.round(height / tile))
]

getCube(scene, world, { size: [44, 1, 30], texture, textureRepeat: repeat(44, 30) })
```

### updateCamera(camera, config)

Update camera properties at runtime.

```typescript
import { updateCamera } from '@webgamekit/threejs'

updateCamera(camera, {
  position: [0, 10, 20],
  lookAt: [0, 0, 0],
  fov: 60
})
```

## Scene Management

### removeElements(world, meshes)

Remove objects from the scene and their Rapier physics bodies.

```typescript
import { removeElements } from '@webgamekit/threejs'

// Cleans up Three.js objects and Rapier bodies
removeElements(world, [coin1, coin2, coin3])
```

### instanceMatrixMesh(scene, geometry, material, options)

Create an instanced mesh for rendering many identical objects efficiently.

```typescript
import { instanceMatrixMesh } from '@webgamekit/threejs'

const trees = instanceMatrixMesh(scene, geometry, material, treePositions)
```

## Lights

All light logic lives in the `lights` module. Two terms are distinct here:

- **Direct lights**: the ambient, directional and hemisphere lights `getLights` creates from
  `SetupConfig.lights`.
- **Environment light**: indirect, image-based illumination applied through
  `scene.environment`, lighting every PBR material from all directions. Not to be confused
  with `getScene`, the renderer and physics bootstrap.

### getLights(scene, config?)

Create the lights a scene declares, and return every one of them:
`{ ambientLight, directionalLight, hemisphereLight, pointLight, spotLight, rectAreaLight }`.

Ambient and directional are made unless the config sets them to `false`; hemisphere, point,
spot and rect area are made only when the config names them. Each takes a `helper: true` to
add its matching Three.js helper, so a scene never hand-builds one. The directional light
always receives a large shadow frustum, even when the `shadow` key is omitted, and the point
and spot lights get a local one sized for their shorter reach.

```typescript
getLights(scene, {
  ambient: { intensity: 0.2 },
  directional: { intensity: 10, position: [5, 10, 5], helper: true },
  point: { intensity: 1, position: [5, 5, 5] },
  spot: { intensity: 1, position: [5, 5, 5], angle: Math.PI / 6 },
  rectArea: { intensity: 1, width: 10, height: 10, position: [5, 5, 5], lookAt: [0, 0, 0] }
})
```

### getEnvironmentLight(renderer, scene, config?)

Apply an environment light and return its texture, reusable as a material `envMap`. With no
config it bakes the neutral `RoomEnvironment`; `texture` loads an equirectangular image
instead, and `intensity` maps to `scene.environmentIntensity`.

```typescript
import { getEnvironmentLight } from '@webgamekit/threejs'

getEnvironmentLight(renderer, scene, { intensity: 0.35 })
```

Through `setup()`, the same config sits under `lights.environment` and is opt in: scenes
without the key render exactly as before.

### updateLights(scene, config) and lightPresets

`updateLights` applies a whole light rig onto the scene: every group the config names
(`ambient`, `directional`, `hemisphere`) is updated in place, or created with the standard
names when the scene lacks it. `point`, `spot` and `rectArea` are updated when the scene
already has them and never created, since a scene without a spotlight did not ask for one. An `environment` entry scales `scene.environmentIntensity`,
and a `sky` entry recolours the `sky` mesh and the scene background. `lightPresets` holds
one such rig per time of day, keyed by `LightPreset` (`dawn`, `noon`, `dusk`, `night`):
a hemisphere carrying sky and ground bounce, a sun or moon at that hour's elevation and
colour temperature, a low flat ambient, the environment intensity and the sky colour.

```typescript
import { updateLights, lightPresets } from '@webgamekit/threejs'

updateLights(scene, lightPresets.dusk)
```

![The same scene under each of the four day time presets](/img/lights/day-presets.webp)

In the playground these presets are the Presets section of the Lights element in the
Elements panel, which holds the whole rig: the four lights and the sky.

![The Lights element, with the preset grid, the transition player and a collapsed section per light](/img/lights/lights-panel.webp)

### blendLightPresets(from, to, alpha)

Interpolate between two rigs, colours through `THREE.Color` and intensities and the sun
position linearly. Feed the result to `updateLights` each frame to animate a day cycle;
the playground's transition player does exactly that.

```typescript
import { blendLightPresets, lightPresets, updateLights } from '@webgamekit/threejs'

updateLights(scene, blendLightPresets(lightPresets.dusk, lightPresets.night, 0.5))
```

## Texture Utilities

### createZigzagTexture(options)

Create a procedural zigzag pattern texture.

```typescript
import { createZigzagTexture } from '@webgamekit/threejs'

const texture = createZigzagTexture({
  size: 64,
  backgroundColor: '#68b469',
  zigzagColor: '#4a7c59',
  repeatX: 50,
  repeatY: 50
})

material.map = texture
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
})
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
  Model
} from '@webgamekit/threejs'
```
