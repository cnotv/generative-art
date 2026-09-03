import { computed, shallowRef, type Ref } from 'vue'
import * as THREE from 'three'
import { rigFindSkinnedMesh, rigFindUnskinnedMeshes } from '@webgamekit/rig'
import {
  computeRigDiagonal,
  createBoneMarkers,
  highlightBoneMarker,
  pickBoneMarker
} from './boneMarkers'
import {
  applyGizmoDragToChain,
  captureRestPoses,
  resetBoneChainToRest,
  type BoneRestPose
} from './boneDragTarget'
import { loadModelFile, disposeModel, generateAutoRig } from './rigModel'
import { DEFAULT_POSITION_RANGE, POSITION_RANGE_FRACTION } from './config'
import type { RigAnimatorConfig } from './types'

/** Owns the loaded model, its rig and its bone markers for the rig animator tool. */
export const useRigModel = (config: Ref<RigAnimatorConfig>) => {
  const scene = shallowRef<THREE.Scene | null>(null)
  const model = shallowRef<THREE.Object3D | null>(null)
  const skinnedMesh = shallowRef<THREE.SkinnedMesh | null>(null)
  const bones = shallowRef<THREE.Bone[]>([])
  const boneMarkers = shallowRef<THREE.Mesh[]>([])
  /** Every bone's transform as loaded, so a bad edit (a position drag gone too far) can be undone. */
  let restPoses: Map<string, BoneRestPose> = new Map()

  const boneNames = computed(() => bones.value.map((bone) => bone.name))
  const needsAutoRig = computed(
    () =>
      bones.value.length === 0 && !!model.value && rigFindUnskinnedMeshes(model.value).length > 0
  )
  /** +/- range the Bone Position panel field offers, scaled to this rig so it fits any model. */
  const positionRange = computed(() =>
    bones.value.length > 0
      ? computeRigDiagonal(bones.value) * POSITION_RANGE_FRACTION
      : DEFAULT_POSITION_RANGE
  )

  const setScene = (nextScene: THREE.Scene): void => {
    scene.value = nextScene
  }

  const attachRig = (nextSkinnedMesh: THREE.SkinnedMesh): void => {
    skinnedMesh.value = nextSkinnedMesh
    bones.value = nextSkinnedMesh.skeleton.bones
    // Marker sizing reads world positions, so the bones' matrices must be current before the
    // very first render gets a chance to update them.
    model.value?.updateMatrixWorld(true)
    boneMarkers.value = createBoneMarkers(bones.value)
    restPoses = captureRestPoses(bones.value)
  }

  /** Tear down the currently loaded model and every piece of rig state it owned. */
  const clearModel = (): void => {
    if (model.value && scene.value) {
      scene.value.remove(model.value)
      disposeModel(model.value)
    }
    model.value = null
    skinnedMesh.value = null
    bones.value = []
    boneMarkers.value = []
    restPoses = new Map()
    config.value.selectedBone = ''
  }

  /**
   * Load an uploaded model, replacing whatever was loaded before, and adopt its rig if it
   * already has one.
   * @param url The blob URL the file input produced
   */
  const loadModel = async (url: string): Promise<void> => {
    if (!scene.value || !url) return
    clearModel()

    const loaded = await loadModelFile(url)
    scene.value.add(loaded)
    model.value = loaded

    const foundSkinnedMesh = rigFindSkinnedMesh(loaded)
    if (foundSkinnedMesh) attachRig(foundSkinnedMesh)
  }

  /** Generate a humanoid skeleton for the loaded model and adopt it as the rig. */
  const runAutoRig = (): void => {
    if (!model.value) return
    const skinnedMeshes = generateAutoRig(model.value)
    if (skinnedMeshes) attachRig(skinnedMeshes[0])
  }

  /** Select a bone by name, highlighting its marker and loading its transform into the panel. */
  const selectBone = (name: string): void => {
    config.value.selectedBone = name
    highlightBoneMarker(boneMarkers.value, name)
    const bone = bones.value.find((candidate) => candidate.name === name)
    if (bone) {
      config.value.boneRotation = { x: bone.rotation.x, y: bone.rotation.y, z: bone.rotation.z }
      config.value.bonePosition = { x: bone.position.x, y: bone.position.y, z: bone.position.z }
    }
  }

  /** Resolve a canvas click to a bone marker and select it, if the ray hit one. */
  const pickBoneFromRay = (raycaster: THREE.Raycaster): void => {
    const name = pickBoneMarker(boneMarkers.value, raycaster)
    if (name) selectBone(name)
  }

  /** Apply a rotation from the panel to the currently selected bone. */
  const applyBoneRotation = (rotation: { x: number; y: number; z: number }): void => {
    const bone = bones.value.find((candidate) => candidate.name === config.value.selectedBone)
    if (bone) bone.rotation.set(rotation.x, rotation.y, rotation.z)
  }

  /** Apply a position typed into the panel to the currently selected bone. */
  const applyBonePosition = (position: { x: number; y: number; z: number }): void => {
    const bone = bones.value.find((candidate) => candidate.name === config.value.selectedBone)
    if (bone) bone.position.set(position.x, position.y, position.z)
  }

  /**
   * Handle a gizmo drag: an IK solve or a plain position edit, see `applyGizmoDragToChain`.
   * @param bone The bone the gizmo just moved, already carrying the drag's new local position
   */
  const applyBoneDragTarget = (bone: THREE.Bone): void => {
    applyGizmoDragToChain(bone, restPoses)
    config.value.bonePosition = { x: bone.position.x, y: bone.position.y, z: bone.position.z }
  }

  /** The currently selected bone, if any, for the view to attach a transform gizmo to. */
  const selectedBone = computed(() =>
    bones.value.find((candidate) => candidate.name === config.value.selectedBone)
  )

  /**
   * Undo any position or rotation edit on the selected bone (and its IK chain, if it has one)
   * back to how it was when the rig was loaded (or auto-rigged). This is the only way back
   * after a drag lands somewhere that visibly tears the mesh, since moving a bone does not
   * preserve the limb length the way rotating it does.
   */
  const resetSelectedBone = (): void => {
    const bone = selectedBone.value
    if (!bone || !restPoses.has(bone.name)) return
    resetBoneChainToRest(bone, restPoses)
    selectBone(bone.name)
  }

  return {
    model,
    skinnedMesh,
    bones,
    boneNames,
    needsAutoRig,
    positionRange,
    selectedBone,
    setScene,
    loadModel,
    runAutoRig,
    selectBone,
    pickBoneFromRay,
    applyBoneRotation,
    applyBonePosition,
    applyBoneDragTarget,
    resetSelectedBone
  }
}
