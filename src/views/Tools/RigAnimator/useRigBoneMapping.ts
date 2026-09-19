import { computed, shallowRef, watch, type Ref } from 'vue'
import type * as THREE from 'three'
import { computeRigDiagonal } from './boneMarkers'
import { guessBoneMapping } from './boneMapping'
import { BONE_CROSSING_DISTANCE_FRACTION } from './config'
import type { RigBoneMapping } from './types'

/**
 * Owns which bone of the loaded rig plays each canonical humanoid role. A rig is guessed from its
 * own bone names the moment it is adopted, and the Bone Mapping panel corrects whatever the guess
 * got wrong, so a rig that names nothing the way Mixamo does can still be captured onto.
 * @param bones The rig's current bones
 */
export const useRigBoneMapping = (bones: Ref<THREE.Bone[]>) => {
  const boneMapping = shallowRef<RigBoneMapping>({})

  /** How close two watched bones come before the crossing check reports them, scaled to this rig. */
  const boneCrossingDistance = computed(() =>
    bones.value.length > 0 ? computeRigDiagonal(bones.value) * BONE_CROSSING_DISTANCE_FRACTION : 0
  )

  /** Guess which bone plays each canonical role from the rig's own names, see `guessBoneMapping`. */
  const autoMapBones = (): void => {
    boneMapping.value = guessBoneMapping(bones.value.map((bone) => bone.name))
  }

  /** Point one canonical role at a bone of this rig, leaving every other role as it was. */
  const setBoneMapping = (canonical: string, boneName: string): void => {
    if (!canonical || !boneName) return
    boneMapping.value = { ...boneMapping.value, [canonical]: boneName }
  }

  // Every way a rig arrives lands here: an uploaded model, an auto-rigged one, and the unload that
  // empties the list and with it the mapping. Synchronous, so a capture cannot read the mapping
  // belonging to the rig before it.
  watch(bones, autoMapBones, { immediate: true, flush: 'sync' })

  return { boneMapping, boneCrossingDistance, autoMapBones, setBoneMapping }
}
