import { ref, type ShallowRef } from 'vue'
import type * as THREE from 'three'

/**
 * Owns whether the rig's bone markers render, split out of `useRigModel` to stay under its
 * function-length lint cap. Markers are recreated on every model load and auto-rig, so
 * `applyCurrentVisibility` re-syncs a freshly created set to whatever was last chosen.
 * @param boneMarkers The rig's current bone markers
 */
export const useRigBoneMarkerVisibility = (boneMarkers: ShallowRef<THREE.Mesh[]>) => {
  const areMarkersVisible = ref(true)

  /** Re-applies the current visibility choice, for a freshly created set of markers. */
  const applyCurrentVisibility = (): void => {
    boneMarkers.value.forEach((marker) => {
      marker.visible = areMarkersVisible.value
    })
  }

  const setMarkersVisible = (visible: boolean): void => {
    areMarkersVisible.value = visible
    applyCurrentVisibility()
  }

  return { areMarkersVisible, setMarkersVisible, applyCurrentVisibility }
}
