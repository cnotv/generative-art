import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import * as THREE from 'three'
import { usePathInteraction } from './usePathInteraction'

const GROUND_Y = 0
const NODE_HEIGHT = 20

/** A canvas that reports a fixed box, so client coordinates map predictably to NDC. */
const makeCanvas = () => {
  const canvas = document.createElement('canvas')
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 }) as DOMRect
  return canvas
}

const makeNode = (position: [number, number, number]) => {
  const node = new THREE.Mesh(new THREE.SphereGeometry(1), new THREE.MeshBasicMaterial())
  node.position.set(...position)
  node.updateMatrixWorld(true)
  return node
}

const makeCamera = () => {
  const camera = new THREE.PerspectiveCamera(60, 800 / 600, 0.1, 1000)
  camera.position.set(0, 60, 60)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld(true)
  return camera
}

/** Client coordinates that point straight at a world position through the given camera. */
const screenPointOf = (camera: THREE.Camera, target: THREE.Vector3) => {
  const projected = target.clone().project(camera)
  return {
    clientX: ((projected.x + 1) / 2) * 800,
    clientY: ((1 - projected.y) / 2) * 600
  }
}

const dispatch = (canvas: HTMLCanvasElement, type: string, point: Record<string, number>) =>
  canvas.dispatchEvent(new MouseEvent(type, { ...point, bubbles: true }))

describe('usePathInteraction node dragging', () => {
  it('keeps a dragged node at its own height instead of dropping it to the ground', () => {
    // A camera sweep's waypoints sit at different heights. Dragging on one shared ground plane
    // flattens the whole route onto it the first time any node is moved.
    const canvas = makeCanvas()
    const camera = makeCamera()
    const node = makeNode([0, NODE_HEIGHT, 0])
    const onUpdateWaypoint = vi.fn()

    const interaction = usePathInteraction({
      canvas: ref(canvas),
      getCamera: () => camera,
      groundY: GROUND_Y,
      onAddWaypoint: () => {},
      onUpdateWaypoint,
      onDrawStart: () => {},
      onDrawEnd: () => {},
      getNodes: () => [node]
    })
    interaction.mount()

    dispatch(canvas, 'mousedown', screenPointOf(camera, node.position))
    dispatch(canvas, 'mousemove', screenPointOf(camera, new THREE.Vector3(6, NODE_HEIGHT, -4)))

    expect(onUpdateWaypoint).toHaveBeenCalled()
    const [index, position] = onUpdateWaypoint.mock.calls.at(-1)!
    expect(index).toBe(0)
    expect(position[1]).toBe(NODE_HEIGHT)
    expect(position[0]).not.toBeCloseTo(0)

    interaction.unmount()
  })

  it('reports the node under the pointer rather than the first in the list', () => {
    const canvas = makeCanvas()
    const camera = makeCamera()
    const nodes = [makeNode([-20, 5, 0]), makeNode([20, 5, 0])]
    const onUpdateWaypoint = vi.fn()

    const interaction = usePathInteraction({
      canvas: ref(canvas),
      getCamera: () => camera,
      onAddWaypoint: () => {},
      onUpdateWaypoint,
      onDrawStart: () => {},
      onDrawEnd: () => {},
      getNodes: () => nodes
    })
    interaction.mount()

    dispatch(canvas, 'mousedown', screenPointOf(camera, nodes[1].position))
    dispatch(canvas, 'mousemove', screenPointOf(camera, new THREE.Vector3(24, 5, 2)))

    expect(onUpdateWaypoint.mock.calls.at(-1)![0]).toBe(1)

    interaction.unmount()
  })
})
