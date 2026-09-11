<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import { RIG_BODY_PART_GROUP_LABELS } from './bodyPartGroups'
import type { RigBodyPartGroup, RigGroupRootBoneNames } from './bodyPartGroups'
import type { CameraCalibrationStep } from './types'

type AssignableGroup = Exclude<RigBodyPartGroup, 'spineHead'>

const ASSIGNABLE_GROUPS: AssignableGroup[] = ['leftArm', 'rightArm', 'leftLeg', 'rightLeg']

defineProps<{
  step: CameraCalibrationStep
  armedGroup: AssignableGroup | null
  rootBoneNames: RigGroupRootBoneNames
  /** Whether a front T-pose has already been captured, so there is something to reset. */
  isCalibrated: boolean
}>()

const emit = defineEmits<{
  armGroup: [group: AssignableGroup]
  goToStep: [step: CameraCalibrationStep]
  cancel: []
  reset: []
}>()
</script>

<template>
  <div class="camera-calibration-panel" role="group" aria-label="Camera calibration">
    <template v-if="step === 'assignParts'">
      <p class="camera-calibration-panel__hint">
        {{
          armedGroup
            ? `Click the ${RIG_BODY_PART_GROUP_LABELS[armedGroup]} bone on the model.`
            : 'Optional: click a limb to assign its bone on this rig, or go on to use the default.'
        }}
      </p>
      <div class="camera-calibration-panel__groups">
        <Button
          v-for="group in ASSIGNABLE_GROUPS"
          :key="group"
          size="sm"
          :variant="armedGroup === group ? 'default' : 'secondary'"
          :aria-pressed="rootBoneNames[group] !== undefined"
          @click="emit('armGroup', group)"
        >
          {{ RIG_BODY_PART_GROUP_LABELS[group] }}
        </Button>
      </div>
    </template>
    <p v-else-if="step === 'front'" class="camera-calibration-panel__hint">
      Face the camera and hold a T-pose, arms level. The countdown starts once it matches.
    </p>
    <p v-else-if="step === 'side'" class="camera-calibration-panel__hint">
      Turn sideways, arms still out, and hold it for the countdown.
    </p>
    <div class="camera-calibration-panel__actions">
      <Button size="sm" variant="secondary" @click="emit('cancel')">Cancel</Button>
      <Button v-if="isCalibrated" size="sm" variant="secondary" @click="emit('reset')">
        Reset Calibration
      </Button>
      <Button v-if="step === 'assignParts'" size="sm" @click="emit('goToStep', 'front')">
        Next: T-Pose
      </Button>
    </div>
  </div>
</template>

<style scoped>
.camera-calibration-panel {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  padding: var(--spacing-3);
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  max-width: 16rem;
}

.camera-calibration-panel__hint {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-muted-foreground);
}

.camera-calibration-panel__groups {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-2);
}

.camera-calibration-panel__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-2);
}
</style>
