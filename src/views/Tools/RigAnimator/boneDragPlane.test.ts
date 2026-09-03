import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { beginBoneDragPlane, boneDragTargetFromEvent } from './boneDragPlane'

const buildCanvas = (): HTMLCanvasElement => {
  const canvas = document.createElement('canvas')
  canvas.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: 100,
      bottom: 100,
      width: 100,
      height: 100,
      x: 0,
      y: 0,
      toJSON: () => undefined
    }) as DOMRect
  return canvas
}

const buildPointerEvent = (clientX: number, clientY: number): PointerEvent =>
  ({ clientX, clientY }) as PointerEvent

/** A camera at (0, 0, 5) looking straight at the origin, up = +Y. */
const buildFacingCamera = (): THREE.PerspectiveCamera => {
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100)
  camera.position.set(0, 0, 5)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld(true)
  return camera
}

describe('beginBoneDragPlane / boneDragTargetFromEvent', () => {
  it('resolves the canvas centre to the anchor point the camera looks straight at', () => {
    const camera = buildFacingCamera()
    const anchor = new THREE.Vector3(0, 0, 0)
    const canvas = buildCanvas()

    beginBoneDragPlane(camera, anchor)
    const target = boneDragTargetFromEvent(buildPointerEvent(50, 50), canvas, camera)

    expect(target).not.toBeNull()
    expect(target!.distanceTo(anchor)).toBeLessThan(1e-4)
  })

  it('moves the target sideways in world space when the pointer moves sideways on screen', () => {
    const camera = buildFacingCamera()
    const anchor = new THREE.Vector3(0, 0, 0)
    const canvas = buildCanvas()

    beginBoneDragPlane(camera, anchor)
    // The function reuses one Vector3 across calls (it runs every pointermove), so the first
    // result must be cloned before the second call overwrites it.
    const center = boneDragTargetFromEvent(buildPointerEvent(50, 50), canvas, camera)!.clone()
    const right = boneDragTargetFromEvent(buildPointerEvent(90, 50), canvas, camera)!

    expect(right.x).toBeGreaterThan(center.x)
    expect(Math.abs(right.y - center.y)).toBeLessThan(1e-6)
  })

  it('keeps every resolved point at the anchor’s own depth along the camera’s view direction', () => {
    const camera = buildFacingCamera()
    const anchor = new THREE.Vector3(1, 2, 0)
    const canvas = buildCanvas()

    beginBoneDragPlane(camera, anchor)
    const target = boneDragTargetFromEvent(buildPointerEvent(70, 30), canvas, camera)!

    const viewDirection = new THREE.Vector3()
    camera.getWorldDirection(viewDirection)
    const anchorDepth = anchor.clone().sub(camera.position).dot(viewDirection)
    const targetDepth = target.clone().sub(camera.position).dot(viewDirection)
    expect(targetDepth).toBeCloseTo(anchorDepth, 4)
  })
})
