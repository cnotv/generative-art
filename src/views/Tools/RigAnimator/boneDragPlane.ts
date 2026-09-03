import * as THREE from 'three'

const raycaster = new THREE.Raycaster()
const pointerNdc = new THREE.Vector2()
const dragPlane = new THREE.Plane()
const planeNormal = new THREE.Vector3()
const intersection = new THREE.Vector3()

/**
 * Anchor a camera-facing plane at a bone's current world position, so the rest of the drag
 * reads the pointer against one fixed plane instead of a world-axis line: dragging always
 * moves the target with the cursor, whichever way the camera happens to be facing, rather than
 * jumping according to how foreshortened a particular axis looks from this angle.
 * @param camera The active camera, used only for its current facing direction
 * @param anchorWorldPosition Where the drag plane passes through, typically the bone's own
 *   world position at the moment the drag starts
 */
export const beginBoneDragPlane = (
  camera: THREE.Camera,
  anchorWorldPosition: THREE.Vector3
): void => {
  camera.getWorldDirection(planeNormal)
  dragPlane.setFromNormalAndCoplanarPoint(planeNormal, anchorWorldPosition)
}

/**
 * Resolve a pointer event to a world-space point on the drag plane set by `beginBoneDragPlane`.
 * @param event The pointer event to project
 * @param canvasElement The canvas the pointer coordinates are relative to
 * @param camera The active camera, used to build the picking ray
 * @returns The intersection point, or null on the rare ray that runs parallel to the plane
 */
export const boneDragTargetFromEvent = (
  event: PointerEvent,
  canvasElement: HTMLCanvasElement,
  camera: THREE.Camera
): THREE.Vector3 | null => {
  const rect = canvasElement.getBoundingClientRect()
  pointerNdc.set(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  )
  raycaster.setFromCamera(pointerNdc, camera)
  return raycaster.ray.intersectPlane(dragPlane, intersection) ? intersection : null
}
