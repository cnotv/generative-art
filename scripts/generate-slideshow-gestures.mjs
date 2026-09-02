/**
 * Authors the Mixamo gestures the picture-slideshow character plays, and writes each as
 * a bare `AnimationClip`.
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
 * Usage: node scripts/generate-slideshow-gestures.mjs
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
const ANIMATIONS_DIR = resolve(projectRoot, 'public/animations')

const SAMPLES_PER_SECOND = 15

const ARMS = [
  { side: 1, arm: 'mixamorigLeftArm', fore: 'mixamorigLeftForeArm', hand: 'mixamorigLeftHand' },
  { side: -1, arm: 'mixamorigRightArm', fore: 'mixamorigRightForeArm', hand: 'mixamorigRightHand' }
]

/** Every bone a clip writes a track for; the rest keep their rest pose. */
const TRACKED_BONES = [
  'mixamorigHips',
  'mixamorigSpine',
  'mixamorigLeftArm',
  'mixamorigLeftForeArm',
  'mixamorigLeftHand',
  'mixamorigRightArm',
  'mixamorigRightForeArm',
  'mixamorigRightHand'
]

/**
 * How a gripping hand sits rotated from its rest pose, curled as if closed around an edge.
 *
 * The two-bone solve only ever aims the forearm so the hand lands on a point — the hand's
 * own rotation is never touched, so left at rest it stays a flat open palm no matter where
 * the arm points. This is applied on top of the aimed pose, in the hand's own local space,
 * so it curls the same way whichever direction the arm is reaching.
 */
const GRIP_PITCH_RADIANS = 0.5

const clamp = (value, low, high) => Math.min(Math.max(value, low), high)
const ease = (progress) => progress * progress * (3 - 2 * progress)

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

/**
 * Poses the rig for one sample and reads back each tracked bone's quaternion.
 * @param yaw How far the hips turn for this sample, in radians
 * @param spineCounter How much the spine counter-rotates against the hips, as a fraction of yaw
 * @param handAt Given a hand's side, where it should be this sample, in the body's own frame
 * @returns One quaternion per tracked bone, in `TRACKED_BONES` order
 */
const poseSample = (yaw, spineCounter, handAt) => {
  TRACKED_BONES.forEach((name) => boneNamed(name).quaternion.copy(restPose.get(name)))

  const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
  boneNamed('mixamorigHips').quaternion.premultiply(turn)
  boneNamed('mixamorigSpine').quaternion.premultiply(
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -yaw * spineCounter)
  )
  rig.updateMatrixWorld(true)

  ARMS.forEach(({ side, arm, fore, hand }) => {
    const target = handAt(side).applyQuaternion(turn)
    const pole = new THREE.Vector3(side * 0.35, -1, -0.35).applyQuaternion(turn).normalize()
    const elbow = solveElbow(worldOf(arm), target, upperLength, foreLength, pole)
    aimBoneAt(boneNamed(arm), boneNamed(fore), elbow)
    aimBoneAt(boneNamed(fore), boneNamed(hand), target)
    // The aim above only ever places the hand, never turns it, so left alone it stays
    // an open flat palm at any pose. Curled here, in the hand's own local space, on
    // top of whatever the aim produced.
    const grip = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      side * GRIP_PITCH_RADIANS
    )
    boneNamed(hand).quaternion.multiply(grip)
  })

  return TRACKED_BONES.map((name) => boneNamed(name).quaternion.clone())
}

/**
 * Samples a pose function across a duration and writes the result as clip JSON.
 * @param name The clip's name and output filename, without extension
 * @param durationSeconds How long the clip runs
 * @param poseAt Given how far through the clip this sample is, from 0 to 1, the pose to hit
 * @returns Nothing; the clip lands at `public/animations/<name>.json`
 */
const writeClip = (name, durationSeconds, poseAt) => {
  const sampleCount = Math.round(durationSeconds * SAMPLES_PER_SECOND) + 1
  const times = Array.from({ length: sampleCount }, (_, index) => index / SAMPLES_PER_SECOND)
  const poses = times.map((time) => {
    const { yaw, spineCounter, handAt } = poseAt(time / durationSeconds)
    return poseSample(yaw, spineCounter, handAt)
  })
  const tracks = TRACKED_BONES.map(
    (boneName, boneIndex) =>
      new THREE.QuaternionKeyframeTrack(
        `${boneName}.quaternion`,
        times,
        poses.flatMap((pose) => pose[boneIndex].toArray())
      )
  )
  const clip = new THREE.AnimationClip(name, durationSeconds, tracks)
  const file = resolve(ANIMATIONS_DIR, `${name}.json`)
  writeFileSync(file, `${JSON.stringify(THREE.AnimationClip.toJSON(clip))}\n`)
  console.log(`Wrote ${file}: ${tracks.length} tracks, ${sampleCount} keys`)
}

/**
 * The idle sway while a picture sits in the hands, looping the whole time it is on display.
 *
 * Deliberately subtle: this runs continuously, uncoupled from how long a hold actually
 * lasts, so anything more than a breath of motion reads as the held picture drifting
 * rather than a character quietly standing.
 */
const HOLD_DURATION_SECONDS = 2.8
const HOLD_SWAY_RADIANS = 0.03
writeClip('hold', HOLD_DURATION_SECONDS, (phase) => {
  const reach = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2)
  return {
    yaw: HOLD_SWAY_RADIANS * Math.sin(phase * Math.PI * 2),
    spineCounter: 0.35,
    handAt: (side) => new THREE.Vector3(side * 39, 116 + 0.4 * reach, 21 + 2 * reach)
  }
})

/**
 * The one-shot shove that throws the held picture clear, one clip per throw direction.
 *
 * The rig that plays this scrubs it forward through release and backward through
 * arrive: its last frame is the moment of release, and its first frame sits at the
 * same neutral reach `hold` loops around, so there is nothing to mirror or splice at
 * either end, only a direction to pick.
 *
 * The two hands do different things rather than sliding sideways together, which read
 * as only one hand moving: the hand trailing the throw — on the side the picture is
 * being sent away from — reaches out and forward as if shoving it clear, while the
 * leading hand drops and pulls back, letting go first rather than following it out.
 */
const PUSH_DURATION_SECONDS = 1
const PUSH_YAW_RADIANS = 0.5
const PUSH_THROW_REACH_UNITS = 30
const PUSH_THROW_FORWARD_UNITS = 10
const PUSH_RELEASE_DROP_UNITS = 34
const PUSH_RELEASE_PULLBACK_UNITS = 18
;[1, -1].forEach((pushSign) => {
  writeClip(pushSign === 1 ? 'push-right' : 'push-left', PUSH_DURATION_SECONDS, (phase) => {
    const extend = ease(phase)
    return {
      yaw: PUSH_YAW_RADIANS * pushSign * extend,
      spineCounter: 0.35,
      handAt: (side) => {
        const isTrailingHand = side * pushSign < 0
        if (isTrailingHand) {
          return new THREE.Vector3(
            side * 39 + pushSign * PUSH_THROW_REACH_UNITS * extend,
            116,
            21 + PUSH_THROW_FORWARD_UNITS * extend
          )
        }
        return new THREE.Vector3(
          side * 39,
          116 - PUSH_RELEASE_DROP_UNITS * extend,
          21 - PUSH_RELEASE_PULLBACK_UNITS * extend
        )
      }
    }
  })
})
