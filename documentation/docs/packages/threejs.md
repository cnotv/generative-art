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
  scene?: {
    backgroundColor?: number,
    transparent?: boolean  // clears to nothing instead, so CSS behind the canvas shows through
  },
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
    texture?: string,
    relief?: {
      amplitude?: number,        // reach of the first noise layer; the finer ones add to it
      frequency?: number,        // bigger means smaller features
      octaves?: number,
      seed?: number,
      segments?: number,         // grid cells across the ground
      channel?: {                // a valley running along Z, for water to run in
        centerX: number,
        width: number,           // the floor, before the sides start climbing
        depth: number,
        banks: number            // how far the sides take to climb back
      }
    }
  },
  sky?: { color?: number },
  fog?: {
    color?: number,
    density?: number,             // exponential-squared fog; `near` and `far` are then ignored
    near?: number,
    far?: number
  },
  water?: {
    size?: [number, number],      // [width, length], lying flat on the XZ plane
    position?: CoordinateTuple,
    heading?: number,             // radians about Y, so a river can cut across at an angle
    color?: number,               // tint blended over the reflection; dark reads as depth
    resolution?: number,          // square reflection render target; halving it buys frame time
    rippleStrength?: number,      // 0 leaves a still mirror
    rippleScale?: number,
    rippleSpeed?: number
  },
  orbit?: { target?: THREE.Vector3, disabled?: boolean },
  postprocessing?: PostProcessingConfig
}
```

`fog`, `water` and `ground.relief` have no default section. A scene that declares none of them
stays clear, dry and flat, so nothing existing gains haze, a surface or a slope it did not ask
for.

### Ground relief

Without `relief` the ground is the flat slab it has always been. With it the top surface becomes
a grid displaced by layered noise, built as a plane rather than a box, since the underside and
sides of a slab that size are never seen and would cost as many triangles again.

The collider does not follow the surface: it stays the flat cuboid it was, so a body rests on
the mean level rather than on the hummock under it. Anything that has to sit on the surface
instead asks `getGroundHeight(x, z, relief)`, which is the same function the surface is built
from, with `x` and `z` measured from the ground's centre.

`channel` cuts a valley along Z through the relief. Water is a flat plane, and laid over relief
alone it pools in whatever the noise happened to leave low, which reads as a chain of puddles
rather than a river; the valley gives it somewhere to run.

```typescript
import { getGroundHeight } from '@webgamekit/threejs'

const relief = {
  amplitude: 2.2,
  frequency: 0.0035,
  channel: { centerX: 39, width: 78, depth: 5, banks: 34 }
}

walker.position.y = groundLevel + getGroundHeight(walker.position.x, walker.position.z, relief)
```

### simplexNoise2D(x, z, seed) and fractalNoise(x, z, config)

The noise `relief` is built from, exported for anything that wants its own terrain. `fractalNoise`
sums `octaves` layers, each `lacunarity` times finer and `persistence` times quieter than the one
before. Both are pure and seeded, so the same coordinates always give the same value.

### getFog(scene, config) and getWater(scene, config)

What `setup()` calls for those two sections, and what to call directly to add either to a scene
`setup()` did not build.

`getFog` replaces whatever fog the scene had and returns it. Passing `density` gives
`THREE.FogExp2`, which has no far plane and so keeps a horizon readable however large the
ground is; leaving it out gives linear `THREE.Fog` between `near` and `far`.

`getWater` returns `{ mesh, dispose }`. The surface is a `Reflector` named `water`, drawn with a
shader that adds two things to three's own: the scene's fog, without which a reflection stays
sharp at a distance where the geometry it mirrors has faded and the surface reads as a hole cut
through the haze; and a travelling sine ripple, so it moves without a normal map to ship.

The reflection is a second pass over the whole scene, so its cost scales with everything the
scene holds rather than with the size of the water. Its render target is reachable through
neither `disposeObject` nor `disposeScene` — a surface removed while the scene lives on has to
be freed through `dispose`, or it holds its target for as long as the renderer does.

```typescript
import { getFog, getWater } from '@webgamekit/threejs'

getFog(scene, { color: 0xb7bda8, density: 0.0042 })
const river = getWater(scene, { size: [90, 1400], position: [39, -0.8, 0], color: 0x6f7a63 })
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

### getAnimations(mixer, filenames, onProgress?)

Loads animation clips onto a mixer and returns one action per clip, keyed by filename.

```typescript
import { getAnimations } from '@webgamekit/threejs'

const mixer = new THREE.AnimationMixer(character)
const actions = await getAnimations(mixer, ['animations/running.fbx', 'animations/hold.json'])
actions.running.play()
```

**Two formats, one binding.** A `.fbx` file is read as a motion-library clip; a `.json` file
is a bare `AnimationClip`, as written by `AnimationClip.toJSON()`. Both bind to a rig by
track name, so a skeleton does not care which one a clip arrived in, and the two can be
mixed in a single call.

The distinction matters when authoring rather than downloading. Three.js reads FBX but
cannot write it, so a clip generated by a script has to be emitted as clip JSON — see
`scripts/generate-slideshow-gestures.mjs`, which solves a set of gestures against the Mixamo
skeleton and writes them next to the FBX clips.

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

### getPhysic(world, options)

Create a rigid body and its collider without a mesh, for anything that collides but is not drawn
— the bones of a posed rig, a trigger volume, a hand-authored blocker.

```typescript
import { getPhysic } from '@webgamekit/threejs'

const { rigidBody, collider } = getPhysic(world, {
  type: 'kinematicPositionBased',
  shape: 'capsule',
  boundary: 1,
  size: [0.12, 0.4, 0.12], // [diameter, height, diameter], as getCylinder reads it
  position: [0, 1.2, 0]
})
```

`shape` is `'cuboid'`, `'ball'`, `'cylinder'` or `'capsule'`. A capsule reads its size the way a
cylinder does, with the height being the straight section and the two hemispherical caps sitting
on top of it, so a capsule can be swapped in for a cylinder to round off the ends of a limb or a
column. `boundary` scales the collider against the mesh it stands in for; at `1` it is exactly
the size given, which is what a body with no mesh of its own wants.

`ccd` (continuous collision detection), off by default and available on every model helper too,
sweeps the body's whole path each step rather than testing only where it lands. A body that
crosses more ground in one step than the wall it should hit is thick passes straight through it,
which is what a small fast object in a large-scale scene does otherwise. Background:
[scale, gravity and tunnelling](/docs/journey/scale-gravity-and-tunnelling).

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

### instanceMatrixMesh(mesh, scene, options)

Draw one mesh many times in a single draw call. One entry per copy, carrying its `position`,
`rotation` and `scale`.

```typescript
import { instanceMatrixMesh } from '@webgamekit/threejs'

instanceMatrixMesh(grassBlade, scene, bladePlacements)
```

### instanceMatrixModel(model, parent, options)

The same for a model made of several meshes: one draw call per mesh in the model, whatever the
number of copies. Returns those instanced meshes.

Each mesh is instanced on its own transform relative to the model's root, so the copies keep
the shape the model was authored with; instancing every mesh on the copy's transform alone
stacks a trunk, its branches and its canopy on one spot. Shadow flags come from the model root,
which both `getModel` and `loadGLTF` set from their options, since an `InstancedMesh` carries
one flag for all its copies.

`parent` is anything that takes children, so a set can go into a group and appear as one row in
the playground's Elements panel rather than one row per mesh.

```typescript
import { colorModel, instanceMatrixModel, loadGLTF } from '@webgamekit/threejs'

const { model } = await loadGLTF('tree.glb', { castShadow: true, receiveShadow: true })
colorModel(model, [0x574b3e, 0x574b3e, 0x6b7a55, 0x7d8a62, 0x5e6d4b, 0x88936d])

const forest = new THREE.Group()
forest.name = 'forest'
instanceMatrixModel(model, forest, treePlacements)
scene.add(forest)
```

The model itself is a template and is never added to `parent`. Dropping meshes from it before
instancing gives a second, cheaper set from the same asset: a tree without its trunk meshes is
a bush, and on the tree used above that is 94 triangles a copy instead of 5370.

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
