import * as THREE from 'three'
import type { SetupConfig } from '@webgamekit/threejs'
import type { CoordinateTuple } from '@webgamekit/animation'
import type { ModelEditorPart } from './types'

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
