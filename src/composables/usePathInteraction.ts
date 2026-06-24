import * as THREE from 'three'
import type { Ref } from 'vue'
import type { Waypoint } from '@webgamekit/logic'
import type { CoordinateTuple } from '@webgamekit/threejs'

export interface PathInteractionOptions {
  /** Canvas element for pointer events. */
  canvas: Ref<HTMLCanvasElement | null>
  /** Active camera used for raycasting. */
  getCamera: () => THREE.Camera | null
  /** Y level of the ground plane used for intersection. */
  groundY?: number
  /** Minimum world-unit distance between successive drag waypoints. */
  minWaypointDistance?: number
  /** Called when a new waypoint is placed (during draw or on node drag-end). */
  onAddWaypoint: (position: CoordinateTuple) => void
  /** Called when a waypoint node is moved (drag update). */
  onUpdateWaypoint: (index: number, position: CoordinateTuple) => void
  /** Called when drawing starts (before first waypoint) — useful for clearing old path. */
  onDrawStart: () => void
  /** Called on pointer-up after drawing finishes or a node drag ends. */
  onDrawEnd: () => void
  /** Returns the array of node meshes to hit-test for drag. May return [] to skip. */
  getNodes: () => THREE.Mesh[]
}

const DEFAULT_GROUND_Y = 0
const DEFAULT_MIN_WAYPOINT_DISTANCE = 1.5

const getNdcFromEvent = (
  event: MouseEvent | TouchEvent,
  canvasElement: HTMLCanvasElement
): THREE.Vector2 => {
  const rect = canvasElement.getBoundingClientRect()
  const clientX = event instanceof MouseEvent ? event.clientX : event.touches[0].clientX
  const clientY = event instanceof MouseEvent ? event.clientY : event.touches[0].clientY
  return new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1
  )
}

const intersectGround = (
  ndc: THREE.Vector2,
  camera: THREE.Camera,
  plane: THREE.Plane
): THREE.Vector3 | null => {
  const raycaster = new THREE.Raycaster()
  raycaster.setFromCamera(ndc, camera)
  const target = new THREE.Vector3()
  return raycaster.ray.intersectPlane(plane, target) ? target : null
}

const hitTestNodes = (ndc: THREE.Vector2, camera: THREE.Camera, nodes: THREE.Mesh[]): number => {
  if (nodes.length === 0) return -1
  const raycaster = new THREE.Raycaster()
  raycaster.setFromCamera(ndc, camera)
  const intersects = raycaster.intersectObjects(nodes)
  if (intersects.length === 0) return -1
  return nodes.indexOf(intersects[0].object as THREE.Mesh)
}

/**
 * Encapsulates the pointer/touch interaction for path drawing and node dragging.
 * Returns mount/unmount helpers that attach and detach event listeners.
 * All path state mutation is delegated to the provided callbacks.
 * @param options - Configuration including canvas ref, camera getter, and event callbacks
 * @returns Object with mount and unmount functions to manage event listener lifecycle
 */
export const usePathInteraction = ({
  canvas,
  getCamera,
  groundY = DEFAULT_GROUND_Y,
  minWaypointDistance = DEFAULT_MIN_WAYPOINT_DISTANCE,
  onAddWaypoint,
  onUpdateWaypoint,
  onDrawStart,
  onDrawEnd,
  getNodes
}: PathInteractionOptions) => {
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -groundY)
  let isPointerDown = false
  let selectedNodeIndex: number | null = null
  let lastWaypoint: Waypoint | null = null

  const tryAddWaypoint = (event: MouseEvent | TouchEvent): void => {
    const canvasElement = canvas.value
    const camera = getCamera()
    if (!canvasElement || !camera) return
    const ndc = getNdcFromEvent(event, canvasElement)
    const worldPos = intersectGround(ndc, camera, groundPlane)
    if (!worldPos) return
    if (lastWaypoint) {
      const dx = worldPos.x - lastWaypoint.x
      const dz = worldPos.z - lastWaypoint.z
      if (Math.hypot(dx, dz) < minWaypointDistance) return
    }
    lastWaypoint = { x: worldPos.x, y: groundY, z: worldPos.z }
    onAddWaypoint([worldPos.x, groundY, worldPos.z])
  }

  const onPointerDown = (event: MouseEvent | TouchEvent): void => {
    if (event instanceof TouchEvent) event.preventDefault()
    const canvasElement = canvas.value
    const camera = getCamera()
    if (!canvasElement || !camera) return
    const ndc = getNdcFromEvent(event, canvasElement)
    const hitIndex = hitTestNodes(ndc, camera, getNodes())
    if (hitIndex !== -1) {
      selectedNodeIndex = hitIndex
      return
    }
    isPointerDown = true
    lastWaypoint = null
    onDrawStart()
    tryAddWaypoint(event)
  }

  const onPointerMove = (event: MouseEvent | TouchEvent): void => {
    if (event instanceof TouchEvent) event.preventDefault()
    const canvasElement = canvas.value
    const camera = getCamera()
    if (selectedNodeIndex !== null && canvasElement && camera) {
      const ndc = getNdcFromEvent(event, canvasElement)
      const worldPos = intersectGround(ndc, camera, groundPlane)
      if (worldPos) onUpdateWaypoint(selectedNodeIndex, [worldPos.x, groundY, worldPos.z])
      return
    }
    if (isPointerDown) tryAddWaypoint(event)
  }

  const onPointerUp = (): void => {
    if (selectedNodeIndex !== null) {
      selectedNodeIndex = null
      onDrawEnd()
      return
    }
    isPointerDown = false
    lastWaypoint = null
    onDrawEnd()
  }

  const mount = (): void => {
    const canvasElement = canvas.value
    if (!canvasElement) return
    canvasElement.addEventListener('mousedown', onPointerDown)
    canvasElement.addEventListener('mousemove', onPointerMove)
    canvasElement.addEventListener('mouseup', onPointerUp)
    canvasElement.addEventListener('touchstart', onPointerDown, { passive: false })
    canvasElement.addEventListener('touchmove', onPointerMove, { passive: false })
    canvasElement.addEventListener('touchend', onPointerUp)
  }

  const unmount = (): void => {
    const canvasElement = canvas.value
    if (!canvasElement) return
    canvasElement.removeEventListener('mousedown', onPointerDown)
    canvasElement.removeEventListener('mousemove', onPointerMove)
    canvasElement.removeEventListener('mouseup', onPointerUp)
    canvasElement.removeEventListener('touchstart', onPointerDown)
    canvasElement.removeEventListener('touchmove', onPointerMove)
    canvasElement.removeEventListener('touchend', onPointerUp)
  }

  return { mount, unmount }
}
