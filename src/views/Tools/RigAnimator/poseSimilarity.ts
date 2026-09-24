import * as THREE from 'three'
import type { SkeletonTorsoJoints } from './types'

const WORLD_UP = new THREE.Vector3(0, 1, 0)
const MIDWAY = 0.5

const midpoint = (a: THREE.Vector3, b: THREE.Vector3): THREE.Vector3 => a.clone().lerp(b, MIDWAY)

/**
 * Move a skeleton onto its own hip centre and scale it to a torso one unit long, from the hip
 * centre to the shoulder centre. Two bodies of different size, standing in different places, then
 * compare by pose alone: the standard root-relative normalisation of pose estimation benchmarks.
 * @param joints One frame's joint positions, in scene axes
 * @param torso Which of those joints are the shoulders and hips
 * @returns The joints, centred and scaled
 */
export const normalizeSkeleton = (
  joints: THREE.Vector3[],
  torso: SkeletonTorsoJoints
): THREE.Vector3[] => {
  const hipCentre = midpoint(joints[torso.leftHip], joints[torso.rightHip])
  const shoulderCentre = midpoint(joints[torso.leftShoulder], joints[torso.rightShoulder])
  const torsoLength = hipCentre.distanceTo(shoulderCentre) || 1
  return joints.map((joint) => joint.clone().sub(hipCentre).divideScalar(torsoLength))
}

/**
 * The single turn about the vertical that best lines a candidate sequence up with a reference,
 * in the least squares sense. A fixed camera films the whole take from one side, so one turn
 * covers every frame; a full Procrustes rotation per frame would also forgive a body leaning the
 * wrong way. Closed form: the turn maximising the summed dot products of matching joints.
 * @param reference Normalised frames to line up with
 * @param candidate Normalised frames to turn, the same joints in the same order
 * @returns The turn, in radians, to apply to the candidate with `turnAboutVertical`
 */
export const bestVerticalTurn = (
  reference: THREE.Vector3[][],
  candidate: THREE.Vector3[][]
): number => {
  const pairs = reference.flatMap((frame, frameIndex) =>
    frame.map((joint, jointIndex) => [joint, candidate[frameIndex][jointIndex]] as const)
  )
  const sine = pairs.reduce((sum, [r, c]) => sum + r.x * c.z - r.z * c.x, 0)
  const cosine = pairs.reduce((sum, [r, c]) => sum + r.x * c.x + r.z * c.z, 0)
  return Math.atan2(sine, cosine)
}

/**
 * Turn every joint of every frame about the vertical axis through the origin.
 * @param frames Normalised frames
 * @param radians The turn, from `bestVerticalTurn`
 * @returns The turned frames
 */
export const turnAboutVertical = (frames: THREE.Vector3[][], radians: number): THREE.Vector3[][] =>
  frames.map((joints) => joints.map((joint) => joint.clone().applyAxisAngle(WORLD_UP, radians)))

const jointDistances = (reference: THREE.Vector3[][], candidate: THREE.Vector3[][]): number[] =>
  reference.flatMap((frame, frameIndex) =>
    frame.map((joint, jointIndex) => joint.distanceTo(candidate[frameIndex][jointIndex]))
  )

const mean = (values: number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length

/**
 * Mean per joint position error (MPJPE), in whatever unit the frames are in: torso lengths for
 * normalised frames.
 * @param reference Frames to measure against
 * @param candidate Frames to measure, the same joints in the same order
 * @returns The mean distance between matching joints
 */
export const meanJointError = (
  reference: THREE.Vector3[][],
  candidate: THREE.Vector3[][]
): number => mean(jointDistances(reference, candidate))

/**
 * Percentage of correct keypoints (PCK): the share of joints that land within `threshold` of
 * where the reference has them. Normalised by the torso, PCK at 0.2 is the usual benchmark bar.
 * @param reference Frames to measure against
 * @param candidate Frames to measure, the same joints in the same order
 * @param threshold The furthest a joint may be and still count, in torso lengths
 * @returns The share, from 0 to 1
 */
export const percentCorrectKeypoints = (
  reference: THREE.Vector3[][],
  candidate: THREE.Vector3[][],
  threshold: number
): number => {
  const distances = jointDistances(reference, candidate)
  return distances.filter((distance) => distance <= threshold).length / distances.length
}

/**
 * The mean angle between matching limb segments, in degrees. Unlike a position error it does not
 * grow with limb length, so it reads a rig with longer shins than the performer as just as right.
 * @param reference Frames to measure against
 * @param candidate Frames to measure, the same joints in the same order
 * @param segments Each segment as the index of the joint it starts at and the one it ends at
 * @returns The mean angle
 */
export const meanSegmentAngleDegrees = (
  reference: THREE.Vector3[][],
  candidate: THREE.Vector3[][],
  segments: [number, number][]
): number =>
  mean(
    reference.flatMap((frame, frameIndex) =>
      segments.map(([from, to]) => {
        const expected = frame[to].clone().sub(frame[from])
        const actual = candidate[frameIndex][to].clone().sub(candidate[frameIndex][from])
        return THREE.MathUtils.radToDeg(expected.angleTo(actual))
      })
    )
  )

/**
 * How far a joint is bent, in degrees: 0 for a straight elbow or knee.
 * @param joints One frame's joint positions
 * @param chain The joint above, the bending joint and the joint below
 * @returns The bend
 */
export const jointBendDegrees = (
  joints: THREE.Vector3[],
  [above, joint, below]: [number, number, number]
): number => {
  const upper = joints[joint].clone().sub(joints[above])
  const lower = joints[below].clone().sub(joints[joint])
  return THREE.MathUtils.radToDeg(upper.angleTo(lower))
}

/**
 * Pearson correlation of two equally long series: 1 when one rises and falls in step with the
 * other, whatever their offset or scale. On a joint's bend over time it shows whether a stride was
 * reproduced as a stride, independently of how deep each bend goes.
 * @param a One series
 * @param b The other, the same length
 * @returns The correlation, from -1 to 1, or 0 for a series that never changes
 */
export const pearsonCorrelation = (a: number[], b: number[]): number => {
  const meanA = mean(a)
  const meanB = mean(b)
  const covariance = a.reduce((sum, value, index) => sum + (value - meanA) * (b[index] - meanB), 0)
  const spreadA = Math.sqrt(a.reduce((sum, value) => sum + (value - meanA) ** 2, 0))
  const spreadB = Math.sqrt(b.reduce((sum, value) => sum + (value - meanB) ** 2, 0))
  return spreadA === 0 || spreadB === 0 ? 0 : covariance / (spreadA * spreadB)
}
