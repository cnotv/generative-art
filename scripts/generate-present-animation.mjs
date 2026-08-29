/**
 * Authors the picture-holding gesture for the Mixamo skeleton and writes it as a bare
 * `AnimationClip`.
 *
 * The other clips in `public/animations` came from a motion library as FBX. Three.js can
 * read that format but cannot write it, so an authored clip is emitted as clip JSON
 * instead — the one animation format it can both write and read. Both bind by track name,
 * so the rig does not care which of the two a clip arrived in.
 *
 * The pose is solved rather than typed. Hand positions are given in the body's own frame
 * and a two-bone solve works out the rotations that put the hands there, reading the arm's
 * real rest pose to do it. Guessing quaternions against a skeleton whose bone axes are
 * unknown produces a pretzel; aiming a bone at a point does not care what its axes are.
 *
 * Usage: node scripts/generate-present-animation.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'

// The rig carries embedded textures, and unpacking one wants a browser: the loader
// wraps each image in a Blob URL and hands it to an ImageLoader. Only the skeleton is
// read here, so both steps are answered with a stub rather than a DOM being faked
// around them.
globalThis.window = { URL: { createObjectURL: () => '' } }
THREE.ImageLoader.prototype.load = function loadNothing(url, onLoad) {
  const image = {}
  if (onLoad) onLoad(image)
  return image
}

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const RIG_FILE = resolve(projectRoot, 'public/character2.fbx')
const CLIP_FILE = resolve(projectRoot, 'public/animations/present.json')

const CLIP_NAME = 'present'
const DURATION_SECONDS = 2.8
const SAMPLES_PER_SECOND = 15
/**
 * How far the body turns each way, well down from the reference's full turn.
 *
 * The picture hangs off the hands, so every degree the body moves is a degree the
 * picture moves with it — and a slideshow's picture is meant to be read. Enough to
 * keep the character alive, not enough to make its subject drift.
 */
const SWAY_RADIANS = 0.11

const ARMS = [
  { side: 1, arm: 'mixamorigLeftArm', fore: 'mixamorigLeftForeArm', hand: 'mixamorigLeftHand' },
  { side: -1, arm: 'mixamorigRightArm', fore: 'mixamorigRightForeArm', hand: 'mixamorigRightHand' }
]

/** Every bone the clip writes a track for; the rest keep their rest pose. */
const TRACKED_BONES = [
  'mixamorigHips',
  'mixamorigSpine',
  'mixamorigLeftArm',
  'mixamorigLeftForeArm',
  'mixamorigRightArm',
  'mixamorigRightForeArm'
]

const clamp = (value, low, high) => Math.min(Math.max(value, low), high)

/**
 * Where one hand should be, in the body's own frame.
 *
 * The reference draws both hands together into the chest, which cannot be used as-is: hands
 * that close inwards end up inside the picture they are meant to be holding by its edges.
 * The span is fixed instead, and only a little of the reference's push-and-draw survives, in
 * depth and height — the two directions a held picture tolerates moving in.
 *
 * These are this skeleton's own units. Rotations retarget between Mixamo rigs but reach does
 * not: the same angles on a shorter-armed rig hold the hands closer together, which is why
 * the clip is authored against the rig that actually plays it.
 * @param side 1 for the left hand, -1 for the right
 * @param phase How far through the loop, from 0 to 1
 * @returns The hand's target position, in the rig's own units
 */
const handTarget = (side, phase) => {
  const reach = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2)
  return new THREE.Vector3(side * 39, 116 + 1.5 * reach, 21 + 7 * reach)
}

/**
 * Where the elbow has to sit for a two-bone chain to reach a target.
 *
 * The pole decides which way the joint folds — without one the elbow is free to rotate
 * anywhere around the shoulder-to-hand line, and picks a different spot each frame.
 * @param shoulder Start of the chain, in world space
 * @param target Where the hand should land
 * @param upper Length of the upper bone
 * @param fore Length of the lower bone
 * @param pole Direction the joint should fold towards
 * @returns The elbow position
 */
const solveElbow = (shoulder, target, upper, fore, pole) => {
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
const aimBoneAt = (bone, child, target) => {
  bone.updateMatrixWorld(true)
  const origin = bone.getWorldPosition(new THREE.Vector3())
  const current = child.getWorldPosition(new THREE.Vector3()).sub(origin).normalize()
  const wanted = target.clone().sub(origin).normalize()
  const delta = new THREE.Quaternion().setFromUnitVectors(current, wanted)
  const world = delta.multiply(bone.getWorldQuaternion(new THREE.Quaternion()))
  const parent = bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert()
  bone.quaternion.copy(parent.multiply(world))
  bone.updateMatrixWorld(true)
}

const fileBuffer = readFileSync(RIG_FILE)
const rig = new FBXLoader().parse(
  fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength),
  ''
)
rig.updateMatrixWorld(true)

const boneNamed = (name) => rig.getObjectByName(name)
const worldOf = (name) => boneNamed(name).getWorldPosition(new THREE.Vector3())
const restPose = new Map(TRACKED_BONES.map((name) => [name, boneNamed(name).quaternion.clone()]))
const upperLength = worldOf('mixamorigLeftArm').distanceTo(worldOf('mixamorigLeftForeArm'))
const foreLength = worldOf('mixamorigLeftForeArm').distanceTo(worldOf('mixamorigLeftHand'))

const sampleCount = Math.round(DURATION_SECONDS * SAMPLES_PER_SECOND) + 1
const times = Array.from({ length: sampleCount }, (_, index) => index / SAMPLES_PER_SECOND)

const poses = times.map((time) => {
  const phase = time / DURATION_SECONDS
  TRACKED_BONES.forEach((name) => boneNamed(name).quaternion.copy(restPose.get(name)))

  const yaw = SWAY_RADIANS * Math.sin(phase * Math.PI * 2)
  const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
  boneNamed('mixamorigHips').quaternion.premultiply(turn)
  boneNamed('mixamorigSpine').quaternion.premultiply(
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -yaw * 0.35)
  )
  rig.updateMatrixWorld(true)

  ARMS.forEach(({ side, arm, fore, hand }) => {
    const target = handTarget(side, phase).applyQuaternion(turn)
    const pole = new THREE.Vector3(side * 0.35, -1, -0.35).applyQuaternion(turn).normalize()
    const elbow = solveElbow(worldOf(arm), target, upperLength, foreLength, pole)
    aimBoneAt(boneNamed(arm), boneNamed(fore), elbow)
    aimBoneAt(boneNamed(fore), boneNamed(hand), target)
  })

  return TRACKED_BONES.map((name) => boneNamed(name).quaternion.clone())
})

const tracks = TRACKED_BONES.map(
  (name, boneIndex) =>
    new THREE.QuaternionKeyframeTrack(
      `${name}.quaternion`,
      times,
      poses.flatMap((pose) => pose[boneIndex].toArray())
    )
)

const clip = new THREE.AnimationClip(CLIP_NAME, DURATION_SECONDS, tracks)
writeFileSync(CLIP_FILE, `${JSON.stringify(THREE.AnimationClip.toJSON(clip))}\n`)
console.log(`Wrote ${CLIP_FILE}: ${tracks.length} tracks, ${sampleCount} keys`)
