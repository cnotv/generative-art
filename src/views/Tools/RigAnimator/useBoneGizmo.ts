import * as THREE from 'three'
import { TransformControls } from 'three/addons/controls/TransformControls.js'

/**
 * Wraps Three.js's own TransformControls in translate mode, so a selected bone can be dragged
 * in the 3D view rather than only nudged through the panel's position fields. Both stay in
 * sync: the caller feeds the dragged position back into the same reactive field the panel
 * writes to.
 * @param camera The active camera the gizmo raycasts against
 * @param domElement The canvas the gizmo listens on
 * @param onDraggingChanged Called whenever a drag starts or ends, to suspend orbit controls
 * @param onObjectChange Called with the attached bone whenever the gizmo moves it
 * @returns The gizmo's scene helper plus attach/detach/dispose
 */
export const useBoneGizmo = (
  camera: THREE.Camera,
  domElement: HTMLElement,
  onDraggingChanged: (dragging: boolean) => void,
  onObjectChange: (bone: THREE.Bone) => void
) => {
  const controls = new TransformControls(camera, domElement)
  controls.setMode('translate')

  controls.addEventListener('dragging-changed', (event) => {
    onDraggingChanged(Boolean(event.value))
  })
  controls.addEventListener('objectChange', () => {
    if (controls.object instanceof THREE.Bone) onObjectChange(controls.object)
  })

  const attach = (bone: THREE.Bone): void => {
    controls.attach(bone)
  }

  const detach = (): void => {
    controls.detach()
  }

  const dispose = (): void => {
    controls.dispose()
  }

  return { helper: controls.getHelper(), attach, detach, dispose }
}
