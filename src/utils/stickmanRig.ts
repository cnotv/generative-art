import * as THREE from 'three'
import { remapUVsToWorldProjection } from '@webgamekit/threejs'
import type { UvProjectionLayout } from '@webgamekit/threejs'
import type {
  StickmanPartName,
  StickmanPartNode,
  StickmanPartOffset,
  StickmanPartRig
} from '@/types/stickmanRig'

/** Every limb the rig exposes a rest transform for, in panel order. */
export const STICKMAN_PART_NAMES: StickmanPartName[] = [
  'head',
  'torso',
  'armLeft',
  'armRight',
  'legs'
]

/**
 * How far each arm starts held away from the torso, in the rig's own local
 * units, pushing each arm node along its rest X position.
 *
 * The rig tucks them in at x: 0, which reads as cramped and leaves a texture
 * no room to tell the arm's silhouette apart from the torso's own. Kept
 * small — the torso's own rounded shoulder corner isn't part of the arm mesh
 * and doesn't stretch to follow it, so spreading too far reopens the gap
 * between the two instead of closing it.
 */
export const STICKMAN_ARM_SPREAD = 0.08

/** One part's nudge: an offset from its own rest position, plus a size multiplier. */
export const STICKMAN_PART_OFFSET_CONTROLS = {
  position: {
    label: 'Position',
    component: 'CoordinateInput' as const,
    min: -1,
    max: 1,
    step: 0.01
  },
  scale: { min: 0.2, max: 3, step: 0.05, label: 'Size' }
}

/** How far a quaternion's w may sit from 1 and still count as unrotated. */
const CAP_ROTATION_EPSILON = 0.001

const defaultPartOffset = (): StickmanPartOffset => ({
  position: { x: 0, y: 0, z: 0 },
  scale: 1
})

/**
 * The part nudges every stickman starts from.
 *
 * Rest is the rig's own unmodified pose, so the arm spread lives here as a
 * panel default applied like any other nudge rather than baked into the rig
 * ahead of it — what the panel shows for Arm Left/Right X is the actual
 * spread applied, not a hidden extra on top of it.
 * @returns A fresh set of per-limb offsets, safe to mutate
 */
export const createStickmanPartOffsets = (): Record<StickmanPartName, StickmanPartOffset> => ({
  head: defaultPartOffset(),
  torso: defaultPartOffset(),
  armLeft: { ...defaultPartOffset(), position: { x: -STICKMAN_ARM_SPREAD, y: 0, z: 0 } },
  armRight: { ...defaultPartOffset(), position: { x: STICKMAN_ARM_SPREAD, y: 0, z: 0 } },
  legs: defaultPartOffset()
})

/**
 * Matches each visual limb to its actual node(s) in the rig.
 *
 * The rig's own node names don't all match their visual role: the true
 * legs are named "leftLeg" and "rightLeg", but the head is the two meshes
 * hanging directly off the root with no named group of their own, matched
 * here by mesh name instead. Read once at spawn and never again, so a
 * panel nudge has a stable rest transform to offset from rather than
 * compounding onto whatever the previous frame already applied.
 * @param stickman - The loaded rig, already in its rest pose
 * @returns Each limb's nodes with their measured rest transforms
 */
export const buildStickmanPartRig = (stickman: THREE.Object3D): StickmanPartRig => {
  const nodesFor = (names: string[]): StickmanPartNode[] =>
    names
      .map((name) => stickman.getObjectByName(name))
      .filter((node): node is THREE.Object3D => !!node)
      .map((node) => ({
        node,
        restPosition: node.position.clone(),
        restScale: node.scale.clone()
      }))

  return {
    head: nodesFor(['mesh_3', 'mesh_3_1', 'mesh_3_2']),
    torso: nodesFor(['torso']),
    armLeft: nodesFor(['leftArm']),
    armRight: nodesFor(['rightArm']),
    legs: nodesFor(['leftLeg', 'rightLeg'])
  }
}

/**
 * Pushes a per-limb nudge onto each node, relative to its own measured rest transform.
 * @param rig - The measured part rig
 * @param parts - Current offsets, one per limb
 * @returns Nothing; the rig's nodes are mutated in place
 */
export const applyStickmanPartOffsets = (
  rig: StickmanPartRig,
  parts: Record<StickmanPartName, StickmanPartOffset>
): void => {
  STICKMAN_PART_NAMES.forEach((name) => {
    const offset = parts[name]
    rig[name].forEach(({ node, restPosition, restScale }) => {
      node.position.set(
        restPosition.x + offset.position.x,
        restPosition.y + offset.position.y,
        restPosition.z + offset.position.z
      )
      node.scale.set(
        restScale.x * offset.scale,
        restScale.y * offset.scale,
        restScale.z * offset.scale
      )
    })
  })
}

/**
 * Reparents a shoulder cap onto the arm it belongs to and seats it in the
 * socket, so the two travel together from here on.
 *
 * The rig authors the caps as torso children at z 0 while both arm sockets sit
 * 0.02 forward, so a reparent that preserves world transform faithfully
 * preserves that gap — the cap reads as floating just behind its arm from any
 * angle but dead ahead. Zeroing its offset lands it on the arm's own origin,
 * which is the socket, and also means later rotation of the arm turns the cap
 * about its own centre rather than swinging it around a lever arm.
 *
 * Shape and orientation are both taken from the cap already closing the far end
 * of the same arm. The rig authors the two ends as different meshes — the
 * shoulder is its own piece, sized for where it used to sit against the torso —
 * which is why the limb read as a rounded hand at one end and a mismatched lump
 * at the other. Reusing the far cap's geometry makes an arm one shape with two
 * identical ends, and reading it off the rig rather than writing measurements
 * down keeps it right if the model is ever re-exported.
 * @param arm - The arm node to seat onto, when the rig has one
 * @param shoulder - The cap to reseat, when the rig has one
 * @returns Nothing; the shoulder is reparented, reshaped and moved in place
 */
const seatShoulderOnArm = (
  arm: THREE.Object3D | undefined,
  shoulder: THREE.Object3D | undefined
): void => {
  if (!arm || !shoulder) return
  // Read before the attach, or the shoulder itself is among the candidates.
  const endCap = arm.children.find(
    (child) => Math.abs(child.quaternion.w - 1) > CAP_ROTATION_EPSILON
  ) as THREE.Mesh | undefined
  arm.attach(shoulder)
  shoulder.position.set(0, 0, 0)
  if (!endCap) return
  shoulder.quaternion.copy(endCap.quaternion)
  const shoulderMesh = shoulder as THREE.Mesh
  if (shoulderMesh.isMesh && endCap.isMesh) shoulderMesh.geometry = endCap.geometry
}

/**
 * Straightens the rig's rest pose, reparents its shoulders and remaps its
 * UVs, then measures the part rig — everything that has to happen once
 * before a limb nudge or a painted texture reads correctly.
 *
 * The rig's own limbs are simple rigid meshes parented to named nodes, not
 * skin-bound, so nudging a node's rest position moves it rigidly and sticks
 * through any walk cycle animating rotation on top of it.
 * @param stickman - A freshly loaded rig, mutated in place
 * @param parts - Offsets to seed the rig with
 * @param layout - Whether the rig's two faces share one texture or take half each
 * @returns The measured part rig, for later nudges
 */
export const prepareStickmanRig = (
  stickman: THREE.Object3D,
  parts: Record<StickmanPartName, StickmanPartOffset>,
  layout: UvProjectionLayout = 'wrapped'
): StickmanPartRig => {
  const leftArmNode = stickman.getObjectByName('leftArm')
  const rightArmNode = stickman.getObjectByName('rightArm')
  // The round shoulder caps (mesh_1, mesh_2) are parented to the torso, not
  // the arm they sit against — so spreading the arm away from the torso left
  // its shoulder behind, opening a gap between the two.
  const leftShoulder = stickman.getObjectByName('mesh_1')
  const rightShoulder = stickman.getObjectByName('mesh_2')
  seatShoulderOnArm(leftArmNode, leftShoulder)
  seatShoulderOnArm(rightArmNode, rightShoulder)
  // The rig's own rest pose holds each arm at an 11.25 degree outward lean on
  // its local Z (a relaxed stance, not a bug in the model) — straightened
  // here, before the texture projection below reads these positions, so a
  // flat texture's straight-up-and-down arm regions actually line up with it.
  if (leftArmNode) leftArmNode.rotation.z = 0
  if (rightArmNode) rightArmNode.rotation.z = 0

  const partRig = buildStickmanPartRig(stickman)
  applyStickmanPartOffsets(partRig, parts)
  // The rig is a dozen separate mesh parts, each with its own UVs already
  // spanning the full [0,0]-[1,1] — a texture applied straight onto that
  // squeezes the whole image onto every part independently, which is what
  // turns a simple line drawing into a near-solid blob. Remapped once here
  // to one shared world-space projection instead, so a texture reads as one
  // picture wrapped around the rig.
  remapUVsToWorldProjection(stickman, layout)
  return partRig
}
