import * as THREE from 'three'
import { TransformControls } from 'three/addons/controls/TransformControls.js'
import type { ConfigControlsSchema } from '@/stores/viewConfig'

/** The Elements panel row for each hand, read and written in the same rig units the
 *  generator script's `HOLD_HAND_*_UNITS` constants are in — copy straight across. */
export const RAGDOLL_SCHEMA: ConfigControlsSchema = {
  left: {
    component: 'CoordinateInput',
    label: 'Left hand',
    min: { x: -60, y: 40, z: -40 },
    max: { x: 60, y: 160, z: 60 },
    step: { x: 0.5, y: 0.5, z: 0.5 }
  },
  right: {
    component: 'CoordinateInput',
    label: 'Right hand',
    min: { x: -60, y: 40, z: -40 },
    max: { x: 60, y: 160, z: 60 },
    step: { x: 0.5, y: 0.5, z: 0.5 }
  }
}

/** Which hand a gizmo is posing. */
export type HandSide = 'left' | 'right'

/** A rig-unit position, in the model's own unscaled frame — what the generator
 *  script's `HOLD_HAND_*_UNITS` constants are written in. */
export interface RigPosition {
  x: number
  y: number
  z: number
}

const BONE_NAMES: Record<HandSide, { arm: string; fore: string; hand: string }> = {
  left: { arm: 'mixamorigLeftArm', fore: 'mixamorigLeftForeArm', hand: 'mixamorigLeftHand' },
  right: { arm: 'mixamorigRightArm', fore: 'mixamorigRightForeArm', hand: 'mixamorigRightHand' }
}

/** 1 for the left hand, -1 for the right — the same convention `handAt(side)` uses. */
const SIGN: Record<HandSide, 1 | -1> = { left: 1, right: -1 }

const clamp = (value: number, low: number, high: number): number =>
  Math.min(Math.max(value, low), high)

/**
 * Where the elbow has to sit for a two-bone chain to reach a target.
 *
 * The same geometry `generate-slideshow-gestures.mjs` solves once at build time, ported
 * to run every drag frame here instead — a live version of the same authoring technique.
 * @param shoulder Start of the chain, in world space
 * @param target Where the hand should land, in world space
 * @param upper Length of the upper bone
 * @param fore Length of the lower bone
 * @param pole Direction the joint should fold towards
 * @returns The elbow position, in world space
 */
const solveElbow = (
  shoulder: THREE.Vector3,
  target: THREE.Vector3,
  upper: number,
  fore: number,
  pole: THREE.Vector3
): THREE.Vector3 => {
  const toTarget = target.clone().sub(shoulder)
  const distance = clamp(toTarget.length(), Math.abs(upper - fore) + 0.01, upper + fore - 0.01)
  const along = toTarget.clone().normalize()
  const across = pole.clone().sub(along.clone().multiplyScalar(pole.dot(along)))
  if (across.lengthSq() < 1e-6) across.set(0, -1, 0)
  across.normalize()
  const cosine = clamp(
    (upper * upper + distance * distance - fore * fore) / (2 * upper * distance),
    -1,
    1
  )
  const angle = Math.acos(cosine)
  return shoulder
    .clone()
    .add(along.multiplyScalar(upper * Math.cos(angle)))
    .add(across.multiplyScalar(upper * Math.sin(angle)))
}

/**
 * Turns a bone so its child lands on a point, whatever the bone's own axes are.
 * @param bone The bone to turn
 * @param child The bone whose position is being aimed
 * @param target Where the child should end up, in world space
 * @returns Nothing; the bone's local rotation is written
 */
const aimBoneAt = (bone: THREE.Object3D, child: THREE.Object3D, target: THREE.Vector3): void => {
  bone.updateMatrixWorld(true)
  const origin = bone.getWorldPosition(new THREE.Vector3())
  const current = child.getWorldPosition(new THREE.Vector3()).sub(origin).normalize()
  const wanted = target.clone().sub(origin).normalize()
  const delta = new THREE.Quaternion().setFromUnitVectors(current, wanted)
  const world = delta.multiply(bone.getWorldQuaternion(new THREE.Quaternion()))
  const parent = bone.parent?.getWorldQuaternion(new THREE.Quaternion()).invert()
  bone.quaternion.copy(parent ? parent.multiply(world) : world)
  bone.updateMatrixWorld(true)
}

/**
 * A live version of the pose the gesture-generating script solves offline, for dragging a
 * hand target in the running scene instead of guessing rig units and regenerating clips.
 *
 * Only meaningful while the timeline is paused: it writes bone rotations directly every
 * time a gizmo moves, and nothing else is driving those bones while paused to fight it.
 * @param model - The spawned Mixamo rig
 * @param camera - The scene's camera, for the gizmos to project against
 * @param domElement - The canvas gizmo drags read pointer events from
 * @param scene - Where the gizmos themselves are added
 * @returns Handles to enable/disable the editor and read or set each hand's target
 */
export const createRagdollEditor = (
  model: THREE.Object3D,
  camera: THREE.Camera,
  domElement: HTMLElement,
  scene: THREE.Scene,
  /** Called after every pose change, including drags — nothing here is itself reactive,
   *  so this is what lets a Vue-side panel know the displayed numbers are stale. */
  onChange: () => void
) => {
  const sides: HandSide[] = ['left', 'right']
  const bones = Object.fromEntries(
    sides.map((side) => {
      const names = BONE_NAMES[side]
      return [
        side,
        {
          arm: model.getObjectByName(names.arm) as THREE.Object3D,
          fore: model.getObjectByName(names.fore) as THREE.Object3D,
          hand: model.getObjectByName(names.hand) as THREE.Object3D
        }
      ]
    })
  ) as Record<HandSide, { arm: THREE.Object3D; fore: THREE.Object3D; hand: THREE.Object3D }>

  const worldOf = (node: THREE.Object3D): THREE.Vector3 =>
    node.getWorldPosition(new THREE.Vector3())
  const upperLength = worldOf(bones.left.arm).distanceTo(worldOf(bones.left.fore))
  const foreLength = worldOf(bones.left.fore).distanceTo(worldOf(bones.left.hand))

  // One named group holds every gizmo part, so the Elements panel — which lists scene
  // children directly — sees one entry for the editor rather than one per handle and helper.
  const gizmoGroup = new THREE.Group()
  gizmoGroup.name = 'ragdoll-editor'
  scene.add(gizmoGroup)

  const handles: Record<HandSide, THREE.Object3D> = {
    left: new THREE.Object3D(),
    right: new THREE.Object3D()
  }
  sides.forEach((side) => {
    handles[side].position.copy(worldOf(bones[side].hand))
    gizmoGroup.add(handles[side])
  })

  const applyPose = (side: HandSide): void => {
    const sign = SIGN[side]
    const rig = bones[side]
    const target = handles[side].position
    const shoulder = worldOf(rig.arm)
    const pole = new THREE.Vector3(sign * 0.6, -0.8, -0.1).normalize()
    const elbow = solveElbow(shoulder, target, upperLength, foreLength, pole)
    aimBoneAt(rig.arm, rig.fore, elbow)
    aimBoneAt(rig.fore, rig.hand, target)
  }

  const controls = sides.map((side) => {
    const control = new TransformControls(camera, domElement)
    control.attach(handles[side])
    control.setSize(0.6)
    control.addEventListener('objectChange', () => {
      applyPose(side)
      onChange()
    })
    // `getHelper()` — not the control itself — is the Object3D that actually renders;
    // its own `.visible` is what has to be toggled to show or hide the gizmo.
    const helper = control.getHelper()
    gizmoGroup.add(helper)
    return { control, helper }
  })

  /**
   * Turns the gizmos on or off. Enabling re-reads each hand's current bone position first,
   * so editing always starts from the pose the timeline was actually paused on rather than
   * wherever the gizmo was left after the last edit.
   */
  const setEnabled = (enabled: boolean): void => {
    if (enabled) {
      sides.forEach((side) => handles[side].position.copy(worldOf(bones[side].hand)))
      onChange()
    }
    controls.forEach(({ control, helper }) => {
      control.enabled = enabled
      helper.visible = enabled
    })
  }
  setEnabled(false)

  const getRigPosition = (side: HandSide): RigPosition => {
    const local = model.worldToLocal(handles[side].position.clone())
    return { x: local.x, y: local.y, z: local.z }
  }

  const setRigPosition = (side: HandSide, position: RigPosition): void => {
    const world = model.localToWorld(new THREE.Vector3(position.x, position.y, position.z))
    handles[side].position.copy(world)
    applyPose(side)
  }

  const dispose = (): void => {
    controls.forEach(({ control }) => control.dispose())
    scene.remove(gizmoGroup)
  }

  return { setEnabled, getRigPosition, setRigPosition, dispose }
}

export type RagdollEditor = ReturnType<typeof createRagdollEditor>
