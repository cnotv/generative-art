import * as THREE from 'three'
import type { Ref } from 'vue'

interface SceneElementPickerOptions {
  /** Canvas element that receives pointer events. */
  canvas: Ref<HTMLCanvasElement | null>
  /** Active render camera used for raycasting. */
  getCamera: () => THREE.Camera | null
  /** Objects to hit-test (typically the scene's children). */
  getObjects: () => THREE.Object3D[]
  /**
   * Maps a single hit object to a selectable id, or null if it is not selectable.
   * The picker walks up the hit's ancestors calling this until it returns a value,
   * so a deep child mesh can resolve to its named group (e.g. a brick → "bricks").
   */
  matchObject: (object: THREE.Object3D) => string | null
  /** Only pick while this returns true (e.g. the Elements panel being open). */
  isEnabled: () => boolean
  /** Called with the resolved element/group id on a successful pick. */
  onPick: (name: string) => void
}

/** Movement (px) above which a press is treated as a drag, not a click. */
const CLICK_DRAG_THRESHOLD = 4

const getNdc = (event: MouseEvent, canvasElement: HTMLCanvasElement): THREE.Vector2 => {
  const rect = canvasElement.getBoundingClientRect()
  return new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  )
}

const resolveFromAncestors = (
  object: THREE.Object3D | null,
  match: (object: THREE.Object3D) => string | null
): string | null => {
  if (!object) return null
  return match(object) ?? resolveFromAncestors(object.parent, match)
}

/**
 * Lets the user select a scene element by clicking it in the 3D viewport.
 * A press that moves beyond a small threshold is treated as a drag (e.g. orbit
 * or path drawing) and ignored, so only deliberate clicks select.
 * @param options - Canvas ref, camera/object accessors, enable guard, and pick callback
 * @returns mount and unmount helpers for the pointer listeners
 */
export const useSceneElementPicker = ({
  canvas,
  getCamera,
  getObjects,
  matchObject,
  isEnabled,
  onPick
}: SceneElementPickerOptions) => {
  let downX = 0
  let downY = 0

  const onPointerDown = (event: MouseEvent): void => {
    downX = event.clientX
    downY = event.clientY
  }

  const onPointerUp = (event: MouseEvent): void => {
    if (!isEnabled()) return
    if (Math.hypot(event.clientX - downX, event.clientY - downY) > CLICK_DRAG_THRESHOLD) return
    const canvasElement = canvas.value
    const camera = getCamera()
    if (!canvasElement || !camera) return
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(getNdc(event, canvasElement), camera)
    const hits = raycaster.intersectObjects(getObjects(), true)
    const name = hits
      .map((hit) => resolveFromAncestors(hit.object, matchObject))
      .find((n) => n !== null)
    if (name) onPick(name)
  }

  const mount = (): void => {
    const canvasElement = canvas.value
    if (!canvasElement) return
    canvasElement.addEventListener('mousedown', onPointerDown)
    canvasElement.addEventListener('mouseup', onPointerUp)
  }

  const unmount = (): void => {
    const canvasElement = canvas.value
    if (!canvasElement) return
    canvasElement.removeEventListener('mousedown', onPointerDown)
    canvasElement.removeEventListener('mouseup', onPointerUp)
  }

  return { mount, unmount }
}
