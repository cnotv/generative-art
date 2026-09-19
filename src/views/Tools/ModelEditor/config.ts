import * as THREE from 'three'
import type { SetupConfig } from '@webgamekit/threejs'
import type { CoordinateTuple } from '@webgamekit/animation'
import type { FaceFeature, ModelEditorPart } from './types'

export const MODEL_EDITOR_SETUP_CONFIG: SetupConfig = {
  scene: { backgroundColor: 0xf5f0e8 },
  camera: { position: [0, 1.6, 4] as CoordinateTuple, fov: 50 },
  ground: false,
  sky: false,
  lights: {
    ambient: { color: 0xffffff, intensity: 2.2 },
    directional: {
      color: 0xfff2e0,
      intensity: 1.4,
      position: [4, 6, 4] as CoordinateTuple,
      castShadow: true
    }
  },
  orbit: { target: new THREE.Vector3(0, 1, 0) }
}

export const MODEL_FILE_ACCEPT = '.fbx,.glb,.gltf'
export const DEFAULT_MODEL_PATH = '/character2.fbx'

/** Appended to the loaded model's own name for the file Download Model saves. */
export const EXPORT_FILENAME_SUFFIX = '-edited.glb'

/**
 * The range every length and size slider offers, as a multiple of the rig's own proportions.
 * The floor stays clear of zero: a region scaled to nothing collapses the mesh around it into
 * a crease that no further slider movement can recover, since the geometry has no width left
 * to grow back from.
 */
export const PART_SCALE_CONTROL = { min: 0.25, max: 3, step: 0.05 }

/**
 * The humanoid regions the editor resizes, in the order the panel lists them, named after
 * Mixamo's convention like the rest of the rig tooling here.
 *
 * Each region is one or more `bone` / `tip` pairs: the bone that carries the region, and the
 * bone below it whose own offset says which way the region runs. The tip is named rather than
 * guessed because several of these bones carry more than one chain — a hand starts five
 * fingers, and the top of the spine starts the neck and both shoulders — and only one of them
 * is the direction the region's own length is measured along.
 *
 * The hips are deliberately absent: they are the root every other region hangs off, so
 * resizing them resizes the whole figure rather than a part of it.
 */
export const MODEL_EDITOR_PARTS: ModelEditorPart[] = [
  {
    name: 'head',
    segments: [{ bone: 'mixamorigHead', tip: 'mixamorigHeadTop_End' }]
  },
  {
    name: 'neck',
    segments: [{ bone: 'mixamorigNeck', tip: 'mixamorigHead' }]
  },
  {
    name: 'torso',
    segments: [
      { bone: 'mixamorigSpine', tip: 'mixamorigSpine1' },
      { bone: 'mixamorigSpine1', tip: 'mixamorigSpine2' },
      { bone: 'mixamorigSpine2', tip: 'mixamorigNeck' }
    ]
  },
  {
    name: 'shoulders',
    segments: [
      { bone: 'mixamorigLeftShoulder', tip: 'mixamorigLeftArm' },
      { bone: 'mixamorigRightShoulder', tip: 'mixamorigRightArm' }
    ]
  },
  {
    name: 'upperArms',
    segments: [
      { bone: 'mixamorigLeftArm', tip: 'mixamorigLeftForeArm' },
      { bone: 'mixamorigRightArm', tip: 'mixamorigRightForeArm' }
    ]
  },
  {
    name: 'forearms',
    segments: [
      { bone: 'mixamorigLeftForeArm', tip: 'mixamorigLeftHand' },
      { bone: 'mixamorigRightForeArm', tip: 'mixamorigRightHand' }
    ]
  },
  {
    name: 'hands',
    segments: [
      { bone: 'mixamorigLeftHand', tip: 'mixamorigLeftHandMiddle1' },
      { bone: 'mixamorigRightHand', tip: 'mixamorigRightHandMiddle1' }
    ]
  },
  {
    name: 'thighs',
    segments: [
      { bone: 'mixamorigLeftUpLeg', tip: 'mixamorigLeftLeg' },
      { bone: 'mixamorigRightUpLeg', tip: 'mixamorigRightLeg' }
    ]
  },
  {
    name: 'shins',
    segments: [
      { bone: 'mixamorigLeftLeg', tip: 'mixamorigLeftFoot' },
      { bone: 'mixamorigRightLeg', tip: 'mixamorigRightFoot' }
    ]
  },
  {
    name: 'feet',
    segments: [
      { bone: 'mixamorigLeftFoot', tip: 'mixamorigLeftToeBase' },
      { bone: 'mixamorigRightFoot', tip: 'mixamorigRightToeBase' }
    ]
  }
]

/** Stays clear of zero for the same reason the body sliders do: a feature pinched to a point has nothing left to grow back from. */
export const FACE_SIZE_CONTROL = { min: 0.5, max: 2, step: 0.05 }

/** A tenth of the face's height either way, enough to move a feature to its neighbour's place. */
export const FACE_OFFSET_CONTROL = { min: -0.1, max: 0.1, step: 0.005 }

/**
 * Where each feature sits on the face, as fractions of its height from chin to crown, placed
 * from the bundled Mixamo characters: their eye line sits halfway up, the nose tip a little over
 * a third, the mouth about a fifth. A head that departs far from that (a long snout, eyes on
 * stalks) will see a feature land off its mark, since nothing here recognises a face.
 *
 * Front-facing points are snapped forward onto the surface, so a flat face and a deep one both
 * get their feature on the skin rather than inside the skull. The ears snap outwards instead.
 */
export const FACE_FEATURES: FaceFeature[] = [
  { name: 'eyes', across: 0.15, up: 0.5, radius: 0.13, facing: 'front' },
  { name: 'nose', across: 0, up: 0.36, radius: 0.11, facing: 'front' },
  { name: 'mouth', across: 0, up: 0.21, radius: 0.12, facing: 'front' },
  { name: 'jaw', across: 0, up: 0.09, radius: 0.24, facing: 'front' },
  { name: 'ears', across: 0, up: 0.45, radius: 0.14, facing: 'side' },
  { name: 'cheeks', across: 0.2, up: 0.32, radius: 0.13, facing: 'front' }
]

/** The mixamorig bone a face is measured from, and the one marking the top of the skull above it. */
export const FACE_HEAD_BONE = 'mixamorigHead'
export const FACE_CROWN_BONE = 'mixamorigHeadTop_End'

/**
 * How close to a feature's line a vertex must lie to count when snapping the feature onto the
 * surface, as a fraction of the face's height. Narrow enough that the nose snaps to the nose tip
 * rather than a cheekbone beside it.
 */
export const FACE_SNAP_WINDOW = 0.04

/**
 * The share of a feature's radius held at full strength before the pull starts easing off. A
 * falloff that fades from the very centre leaves the feature itself barely changed, since the
 * vertices nearest its point have almost no distance from it to scale; a solid core moves the
 * whole feature and spends only the outer ring blending it into the face around it.
 */
export const FACE_FALLOFF_CORE = 0.45
