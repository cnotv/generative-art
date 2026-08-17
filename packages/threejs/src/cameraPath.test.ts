import { describe, it, expect, vi } from 'vitest'
import * as THREE from 'three'
import { cameraPathCreate, cameraPathIsActive } from './cameraPath'

const makeCamera = () => new THREE.PerspectiveCamera(75, 1, 0.1, 1000)

const straightLine = [
  { position: [0, 0, 0] as [number, number, number] },
  { position: [10, 0, 0] as [number, number, number] },
  { position: [20, 0, 0] as [number, number, number] }
]

describe('cameraPathCreate', () => {
  it('starts the camera at the first point', () => {
    const camera = makeCamera()
    camera.position.set(99, 99, 99)
    const path = cameraPathCreate(camera, { points: straightLine, seconds: 2 })

    path.update(0)

    expect(camera.position.x).toBeCloseTo(0)
    path.cancel()
  })

  it('ends the camera at the last point', () => {
    const camera = makeCamera()
    const path = cameraPathCreate(camera, { points: straightLine, seconds: 2 })

    path.update(2)

    expect(camera.position.x).toBeCloseTo(20)
  })

  it('moves the camera along the path over time', () => {
    const camera = makeCamera()
    const path = cameraPathCreate(camera, { points: straightLine, seconds: 2 })

    path.update(1)
    const halfway = camera.position.x
    path.update(0.5)

    expect(halfway).toBeGreaterThan(0)
    expect(halfway).toBeLessThan(20)
    expect(camera.position.x).toBeGreaterThan(halfway)
    path.cancel()
  })

  it('claims the camera up to and including the frame that finishes, and not after', () => {
    // The return value answers "did I move the camera this frame", which the frame that lands
    // on the final point did.
    const camera = makeCamera()
    const path = cameraPathCreate(camera, { points: straightLine, seconds: 2 })

    expect(path.update(1)).toBe(true)
    expect(path.update(1)).toBe(true)
    expect(path.update(1)).toBe(false)
  })

  it('calls onComplete once, not on every later frame', () => {
    const camera = makeCamera()
    const onComplete = vi.fn()
    const path = cameraPathCreate(camera, { points: straightLine, seconds: 1, onComplete })

    path.update(1)
    path.update(1)
    path.update(1)

    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('applies the easing function it is given', () => {
    const camera = makeCamera()
    const linear = cameraPathCreate(camera, { points: straightLine, seconds: 2 })
    linear.update(1)
    const linearHalfway = camera.position.x
    linear.cancel()

    const eased = cameraPathCreate(camera, {
      points: straightLine,
      seconds: 2,
      easing: (t) => t * t
    })
    eased.update(1)

    expect(eased !== linear).toBe(true)
    expect(camera.position.x).toBeLessThan(linearHalfway)
    eased.cancel()
  })

  it('holds a look-at target while moving', () => {
    const camera = makeCamera()
    const path = cameraPathCreate(camera, {
      points: [
        { position: [0, 0, 10], lookAt: [0, 0, 0] },
        { position: [10, 0, 10], lookAt: [0, 0, 0] }
      ],
      seconds: 1
    })

    path.update(0.5)
    const direction = new THREE.Vector3()
    camera.getWorldDirection(direction)

    // Looking back toward the origin from +x means the view points along -x.
    expect(direction.x).toBeLessThan(0)
    path.cancel()
  })

  it.each([
    { scenario: 'a single point', points: [{ position: [1, 2, 3] as [number, number, number] }] },
    { scenario: 'no points', points: [] }
  ])('refuses $scenario rather than dividing by an empty curve', ({ points }) => {
    const camera = makeCamera()

    expect(() => cameraPathCreate(camera, { points, seconds: 1 })).toThrow('two points')
  })

  it('refuses a duration of zero rather than producing NaN', () => {
    const camera = makeCamera()

    expect(() => cameraPathCreate(camera, { points: straightLine, seconds: 0 })).toThrow('seconds')
  })
})

describe('cameraPathIsActive', () => {
  it('is false when nothing is running', () => {
    expect(cameraPathIsActive()).toBe(false)
  })

  it('is true while a path is running, so a follow camera can stand down', () => {
    const camera = makeCamera()
    const path = cameraPathCreate(camera, { points: straightLine, seconds: 2 })

    path.update(0.5)

    expect(cameraPathIsActive()).toBe(true)
    path.cancel()
  })

  it('is false again once the path completes', () => {
    const camera = makeCamera()
    const path = cameraPathCreate(camera, { points: straightLine, seconds: 1 })

    path.update(1)

    expect(cameraPathIsActive()).toBe(false)
  })

  it('is false again once the path is cancelled mid-flight', () => {
    const camera = makeCamera()
    const path = cameraPathCreate(camera, { points: straightLine, seconds: 2 })
    path.update(0.5)

    path.cancel()

    expect(cameraPathIsActive()).toBe(false)
  })

  it('a cancelled path stops moving the camera', () => {
    const camera = makeCamera()
    const path = cameraPathCreate(camera, { points: straightLine, seconds: 2 })
    path.update(0.5)
    const stopped = camera.position.x

    path.cancel()
    path.update(1)

    expect(camera.position.x).toBeCloseTo(stopped)
  })
})
