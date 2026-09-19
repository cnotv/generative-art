import { ref, shallowRef, watch, type Ref } from 'vue'
import type * as THREE from 'three'
import { boneCrossingRestDistances, findBoneCrossings } from './boneCrossings'
import { BONE_CROSSING_REST_FRACTION } from './config'

/**
 * Watches the limbs for pairs that have closed on each other while something poses the rig, so a
 * reach that does not match the model shows while a capture is running rather than at the end of
 * a take.
 * @param bones The rig's current bones
 * @param isChecking Whether the check is switched on
 */
export const useRigLimbCheck = (bones: Ref<THREE.Bone[]>, isChecking: Ref<boolean>) => {
  const crossings = ref<string[]>([])
  const restDistances = shallowRef<Map<string, number>>(new Map())

  // Synchronous, and the moment the bones are adopted: a restored autosave poses the rig a tick
  // later, and rest distances measured off that pose would describe the pose, not the rig.
  watch(
    bones,
    (nextBones) => {
      restDistances.value = boneCrossingRestDistances(nextBones)
    },
    { immediate: true, flush: 'sync' }
  )

  /**
   * Re-read which limbs are crossing, from the render loop. Skipped entirely while the check is
   * off, and the list is only written when it actually changes: a reactive write on every frame
   * of a capture would re-render the overlay sixty times a second to say the same thing.
   * @returns Nothing; `crossings` is updated in place
   */
  const updateCrossings = (): void => {
    if (!isChecking.value) {
      if (crossings.value.length > 0) crossings.value = []
      return
    }
    const found = findBoneCrossings(bones.value, restDistances.value, BONE_CROSSING_REST_FRACTION)
    if (found.join('|') !== crossings.value.join('|')) crossings.value = found
  }

  return { crossings, updateCrossings }
}
