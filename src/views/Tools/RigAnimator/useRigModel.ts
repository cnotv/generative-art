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
  resetAllBonesToRest as resetAllBoneTransformsToRest,
  type BoneRestPose
} from './boneDragTarget'
import { loadModelFile, disposeModel, generateAutoRig, sortBoneNamesForDisplay } from './rigModel'
import { DEFAULT_POSITION_RANGE, POSITION_RANGE_FRACTION } from './config'
import { useRigBoneMarkerVisibility } from './useRigBoneMarkerVisibility'
import type { RigAnimatorConfig } from './types'

/** Owns the loaded model, its rig and its bone markers for the rig animator tool. */
export const useRigModel = (config: Ref<RigAnimatorConfig>) => {
  const scene = shallowRef<THREE.Scene | null>(null)
  const model = shallowRef<THREE.Object3D | null>(null)
  const skinnedMesh = shallowRef<THREE.SkinnedMesh | null>(null)
  const bones = shallowRef<THREE.Bone[]>([])
  const boneMarkers = shallowRef<THREE.Mesh[]>([])
  const markerVisibility = useRigBoneMarkerVisibility(boneMarkers)
  /** Every bone's transform as loaded, so a bad edit (a position drag gone too far) can be undone. */
  let restPoses: Map<string, BoneRestPose> = new Map()

  const boneNames = computed(() => sortBoneNamesForDisplay(bones.value.map((bone) => bone.name)))
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
    markerVisibility.applyCurrentVisibility()
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

  /** Load an uploaded model, replacing whatever was loaded before, and adopt its rig if it has one. */
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

  /** Resolve a pointer event to a bone marker, without selecting it: the caller decides whether
   * this is a normal drag (selects the bone) or a pole-hint drag on the current selection's mid
   * joint (must not change the selection). */
  const identifyBoneFromRay = (raycaster: THREE.Raycaster): THREE.Bone | null => {
    if (!markerVisibility.areMarkersVisible.value) return null
    const name = pickBoneMarker(boneMarkers.value, raycaster)
    return name ? (bones.value.find((candidate) => candidate.name === name) ?? null) : null
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

  /** Handle a drag toward a world target: an IK solve or a plain translate, see `applyGizmoDragToChain`. */
  const applyBoneDragTarget = (bone: THREE.Bone, targetWorldPosition: THREE.Vector3): void => {
    applyGizmoDragToChain(bone, targetWorldPosition, restPoses)
    config.value.bonePosition = { x: bone.position.x, y: bone.position.y, z: bone.position.z }
  }

  /** The currently selected bone, if any, for the view to attach a transform gizmo to. */
  const selectedBone = computed(() =>
    bones.value.find((candidate) => candidate.name === config.value.selectedBone)
  )

  /** Undo a position/rotation edit on the selected bone, and its IK chain if it has one, back to rest. */
  const resetSelectedBone = (): void => {
    const bone = selectedBone.value
    if (!bone || !restPoses.has(bone.name)) return
    resetBoneChainToRest(bone, restPoses)
    selectBone(bone.name)
  }

  /** Snap every bone back to its loaded rest transform, see `resetAllBonesToRest`'s own doc. */
  const resetAllBonesToRest = (): void => resetAllBoneTransformsToRest(bones.value, restPoses)

  return {
    model,
    skinnedMesh,
    bones,
    boneNames,
    needsAutoRig,
    positionRange,
    selectedBone,
    areMarkersVisible: markerVisibility.areMarkersVisible,
    setMarkersVisible: markerVisibility.setMarkersVisible,
    setScene,
    loadModel,
    runAutoRig,
    selectBone,
    identifyBoneFromRay,
    applyBoneRotation,
    applyBonePosition,
    applyBoneDragTarget,
    resetSelectedBone,
    resetAllBonesToRest
  }
}
