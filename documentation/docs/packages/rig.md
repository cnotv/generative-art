---
sidebar_position: 14
---

# Package: @webgamekit/rig

Utilities for capturing and interpolating skeletal poses into an `AnimationClip`, and for
generating a fallback humanoid skeleton on a mesh that was never rigged. Used by the
[Rig Animator tool](/docs/guides/rig-animator) to build animations from an uploaded model.

![Selecting and posing a bone on an uploaded model in the Rig Animator tool](/img/animation/rig-posing.webp)

## Installation

```bash
pnpm add @webgamekit/rig
```

## poseCapture / poseApply

Snapshot every bone's current rotation into a plain, serializable `Pose`, and apply one back.

```typescript
import { poseCapture, poseApply } from '@webgamekit/rig'

const restPose = poseCapture(skinnedMesh.skeleton.bones)
// ...pose the rig by hand...
poseApply(skinnedMesh.skeleton.bones, restPose) // back to rest
```

## poseBuildClip

Build a playable `AnimationClip` from an ordered set of pose keyframes. Three.js interpolates
between consecutive poses on its own; this only builds the tracks.

```typescript
import { poseBuildClip } from '@webgamekit/rig'

const clip = poseBuildClip(
  [
    { frame: 0, pose: restPose },
    { frame: 30, pose: raisedArmPose }
  ],
  skinnedMesh.skeleton.bones.map((bone) => bone.name),
  30 // fps
)

const mixer = new THREE.AnimationMixer(skinnedMesh)
mixer.clipAction(clip).play()
```

## rigFindSkinnedMesh / rigFindUnskinnedMeshes

Locate the skinned mesh a rig editor can pose, or the plain meshes that still need one.

```typescript
import { rigFindSkinnedMesh, rigFindUnskinnedMeshes } from '@webgamekit/rig'

const skinnedMesh = rigFindSkinnedMesh(model) // null if the model was never rigged
const unrigged = rigFindUnskinnedMeshes(model) // meshes with no skeleton at all
```

## rigGenerateHumanoidSkeleton / rigAutoSkinMesh

For a model with meshes but no skeleton: generate a canonical Mixamo-named humanoid
skeleton fit to the model's bounding box, then auto-skin each mesh to it by nearest-bone
proximity. A heuristic fallback, not a substitute for an authored rig: expect rough
deformation at joints on unusual proportions.

```typescript
import { rigGenerateHumanoidSkeleton, rigAutoSkinMesh } from '@webgamekit/rig'
import * as THREE from 'three'

const box = new THREE.Box3().setFromObject(model)
const { root, bones, skeleton } = rigGenerateHumanoidSkeleton(box)
model.add(root)

rigAutoSkinMesh(mesh.geometry, bones) // adds skinIndex/skinWeight attributes
const skinnedMesh = new THREE.SkinnedMesh(mesh.geometry, mesh.material)
skinnedMesh.bind(skeleton)
```

## Types

```typescript
interface QuaternionData {
  x: number
  y: number
  z: number
  w: number
}

type Pose = Record<string, QuaternionData> // keyed by bone name

interface PoseKeyframe {
  frame: number
  pose: Pose
}

interface HumanoidBoneDefinition {
  name: string
  parent: string | null
  heightFraction: number // fraction of bounding-box height, from the bottom
  side: 'left' | 'right' | 'center'
  spreadFraction: number // fraction of half the bounding-box width, toward its side
}

interface HumanoidSkeleton {
  root: THREE.Bone
  bones: THREE.Bone[]
  skeleton: THREE.Skeleton
}
```
