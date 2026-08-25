import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { DEFAULT_FOLLOW_CAMERA, type FollowCameraConfig } from '@webgamekit/threejs'
import {
  trackPose,
  isFollowCase,
  toCameraCase,
  stepCameraCase,
  applyCameraFrame
} from './cameraShowcase'
import { TRACK_RADIUS, TRACK_SECONDS, TARGET_HEIGHT, CAMERA_CASES, type CameraCase } from './config'

/** The cases the view places every frame, rather than once or not at all. */
const FOLLOW_CASES = CAMERA_CASES.filter(isFollowCase)

describe('trackPose', () => {
  it('starts the target at the front of the circle', () => {
    const { position } = trackPose(0)

    expect(position[0]).toBeCloseTo(TRACK_RADIUS)
    expect(position[2]).toBeCloseTo(0)
  })

  it('keeps the target on the track at every point in the lap', () => {
    // Arrange: eight samples across one lap.
    const samples = Array.from({ length: 8 }, (_, index) => (index * TRACK_SECONDS) / 8)

    const radii = samples.map((seconds) => {
      const { position } = trackPose(seconds)
      return Math.hypot(position[0], position[2])
    })

    radii.forEach((radius) => expect(radius).toBeCloseTo(TRACK_RADIUS))
  })

  it('returns to the start after a full lap', () => {
    const start = trackPose(0).position
    const lap = trackPose(TRACK_SECONDS).position

    expect(lap[0]).toBeCloseTo(start[0])
    expect(lap[2]).toBeCloseTo(start[2])
  })

  it('holds the target at a constant height', () => {
    const heights = [0, 3, 7.5, 19].map((seconds) => trackPose(seconds).position[1])

    heights.forEach((height) => expect(height).toBe(TARGET_HEIGHT))
  })

  it('points the heading along the direction of travel, not at the centre', () => {
    // A tangent is perpendicular to the radius; a heading pointing inward or outward would
    // make first-person look at the ground or the horizon instead of down the track.
    const { position, direction } = trackPose(3)
    const dot = position[0] * direction[0] + position[2] * direction[2]

    expect(dot).toBeCloseTo(0)
  })

  it('returns a unit heading, so follow offsets are not scaled by it', () => {
    const lengths = [0, 4, 11].map((seconds) => {
      const { direction } = trackPose(seconds)
      return Math.hypot(direction[0], direction[1], direction[2])
    })

    lengths.forEach((length) => expect(length).toBeCloseTo(1))
  })
})

describe('case classification', () => {
  it.each([
    { value: 'third', follow: true },
    { value: 'first', follow: true },
    { value: 'free', follow: true },
    { value: 'path', follow: false }
  ] as const)('reads $value as follow=$follow', ({ value, follow }) => {
    expect(isFollowCase(value)).toBe(follow)
  })

  it('classifies every declared case, so a new one cannot be silently ignored', () => {
    const unclassified = CAMERA_CASES.filter((value) => !isFollowCase(value) && value !== 'path')

    expect(unclassified).toEqual([])
  })
})

describe('toCameraCase', () => {
  it.each(CAMERA_CASES)('keeps the known case %s', (value) => {
    expect(toCameraCase(value)).toBe(value)
  })

  it.each([
    { scenario: 'a stale panel value', value: 'orbit-cam' },
    { scenario: 'undefined', value: undefined },
    { scenario: 'a number', value: 3 }
  ])('falls back to third person for $scenario', ({ value }) => {
    expect(toCameraCase(value)).toBe('third')
  })
})

describe('stepCameraCase', () => {
  it('moves forward one place', () => {
    expect(stepCameraCase('third', 1)).toBe('first')
  })

  it('moves back one place', () => {
    expect(stepCameraCase('first', -1)).toBe('third')
  })

  it('wraps past the end rather than falling off it', () => {
    const last = CAMERA_CASES[CAMERA_CASES.length - 1]

    expect(stepCameraCase(last, 1)).toBe(CAMERA_CASES[0])
  })

  it('wraps before the start', () => {
    expect(stepCameraCase(CAMERA_CASES[0], -1)).toBe(CAMERA_CASES[CAMERA_CASES.length - 1])
  })

  it('returns to where it started after a full cycle', () => {
    const cycled = CAMERA_CASES.reduce((value) => stepCameraCase(value, 1), CAMERA_CASES[0])

    expect(cycled).toBe(CAMERA_CASES[0])
  })
})

describe('rotating through every case', () => {
  const ROTATIONS = 2
  const FRAMES_PER_CASE = 3

  const makeFollowConfig = (): FollowCameraConfig => ({ ...DEFAULT_FOLLOW_CAMERA })

  /**
   * Drive one case for a few frames of the target's lap, exactly as the timeline does.
   * @param camera The camera the view would be steering this frame
   * @param selected The case in effect
   * @param startSeconds Where in the lap to begin, so consecutive cases see the target move
   * @returns The camera positions written, one per frame
   */
  const runCase = (
    getCamera: () => THREE.Camera | null,
    selected: CameraCase,
    startSeconds: number,
    followEnabled = true
  ): THREE.Vector3[] => {
    const lookTarget = new THREE.Vector3()
    const orbit = { target: new THREE.Vector3() }

    return Array.from({ length: FRAMES_PER_CASE }, (_unused, frame) => {
      const pose = trackPose(startSeconds + frame)
      applyCameraFrame({
        getCamera,
        orbit,
        selected,
        targetPosition: new THREE.Vector3(...pose.position),
        targetDirection: new THREE.Vector3(...pose.direction),
        follow: makeFollowConfig(),
        lookTarget,
        pathOwnsCamera: selected === 'path',
        followEnabled
      })
      return getCamera()?.position.clone() ?? new THREE.Vector3()
    })
  }

  /** Every case in order, twice over, which is what cycling with Q or E produces. */
  const twoRotations = (): CameraCase[] =>
    Array.from({ length: CAMERA_CASES.length * ROTATIONS }, (_unused, step) =>
      step === 0 ? CAMERA_CASES[0] : stepCameraCase(CAMERA_CASES[step % CAMERA_CASES.length], 0)
    )

  it('visits every case exactly twice', () => {
    const visited = twoRotations()
    expect(visited).toHaveLength(CAMERA_CASES.length * ROTATIONS)
    CAMERA_CASES.forEach((value) =>
      expect(visited.filter((seen) => seen === value)).toHaveLength(ROTATIONS)
    )
  })

  it.each([...CAMERA_CASES])(
    'keeps %s behaving the same on the second rotation as the first',
    (selected) => {
      const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
      const first = runCase(() => camera, selected, 0)
      const second = runCase(() => camera, selected, 0)
      expect(second.map((position) => position.toArray())).toEqual(
        first.map((position) => position.toArray())
      )
    }
  )

  it('keeps the follow cases tracking the target after the camera is swapped', () => {
    // The elements panel replaces the camera object when the projection changes. A view that
    // captured the original goes on steering a camera nobody is rendering, and first and third
    // person stop holding the player.
    const perspective = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
    const orthographic = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 1000)

    FOLLOW_CASES.forEach((selected) => {
      const before = runCase(() => perspective, selected, 0)
      const frozen = perspective.position.clone()

      const after = runCase(() => orthographic, selected, 0)

      expect(after.map((position) => position.toArray())).toEqual(
        before.map((position) => position.toArray())
      )
      expect(perspective.position.toArray()).toEqual(frozen.toArray())
    })
  })

  it('moves the follow cameras as the target travels, on either camera', () => {
    const cameras = [
      new THREE.PerspectiveCamera(75, 1, 0.1, 1000),
      new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 1000)
    ]

    cameras.forEach((camera) =>
      FOLLOW_CASES.forEach((selected) => {
        const positions = runCase(() => camera, selected, 0)
        expect(positions[0].toArray()).not.toEqual(positions[FRAMES_PER_CASE - 1].toArray())
      })
    )
  })

  it('picks up a camera swapped in mid-rotation, without touching the one replaced', () => {
    // The failure this guards: the view resolves its camera once and keeps steering it after the
    // panel has swapped the projection, so first and third person stop holding the player.
    const perspective = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
    const orthographic = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 1000)
    const active = { camera: perspective as THREE.Camera }

    FOLLOW_CASES.forEach((selected) => {
      active.camera = perspective
      runCase(() => active.camera, selected, 0)
      const abandoned = perspective.position.clone()

      active.camera = orthographic
      const afterSwap = runCase(() => active.camera, selected, TRACK_SECONDS / 4)

      expect(orthographic.position.toArray()).toEqual(afterSwap.at(-1)?.toArray())
      expect(perspective.position.toArray()).toEqual(abandoned.toArray())
      expect(orthographic.position.toArray()).not.toEqual(abandoned.toArray())
    })
  })

  it('leaves the camera alone when the rig is switched off, whichever camera is active', () => {
    // What a preset, a 45 degree rotation or a dragged coordinate needs to survive: with the rig
    // writing every frame, the panel's own controls are overwritten before they are seen.
    const cameras = [
      new THREE.PerspectiveCamera(75, 1, 0.1, 1000),
      new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 1000)
    ]

    cameras.forEach((camera) =>
      FOLLOW_CASES.forEach((selected) => {
        camera.position.set(3, 4, 5)
        runCase(() => camera, selected, 0, false)
        expect(camera.position.toArray()).toEqual([3, 4, 5])
      })
    )
  })

  it('still runs a cinematic path while the rig is switched off', () => {
    // The switch turns the follow rig off, not the view: a path is its own case and owns the
    // camera outright for as long as it runs.
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
    const lookTarget = new THREE.Vector3(1, 2, 3)
    const orbit = { target: new THREE.Vector3() }

    const written = applyCameraFrame({
      getCamera: () => camera,
      orbit,
      selected: 'path',
      targetPosition: new THREE.Vector3(),
      targetDirection: new THREE.Vector3(0, 0, 1),
      follow: makeFollowConfig(),
      lookTarget,
      pathOwnsCamera: true,
      followEnabled: false
    })

    expect(written).toBe(camera)
    expect(orbit.target.toArray()).toEqual([1, 2, 3])
  })
})
