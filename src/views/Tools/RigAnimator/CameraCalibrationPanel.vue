<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import { RIG_BODY_PART_GROUP_LABELS } from './bodyPartGroups'
import type { RigBodyPartGroup } from './bodyPartGroups'
import type { CameraCalibrationStep } from './cameraCalibration'

const ASSIGNABLE_GROUPS: Exclude<RigBodyPartGroup, 'spineHead'>[] = [
  'leftArm',
  'rightArm',
  'leftLeg',
  'rightLeg'
]

defineProps<{
  step: CameraCalibrationStep
  armedGroup: Exclude<RigBodyPartGroup, 'spineHead'> | null
  rootBoneNames: Partial<Record<Exclude<RigBodyPartGroup, 'spineHead'>, string>>
  /** Whether a settled frame is available for the current step's Capture button to read;
   * disabled otherwise rather than capturing an empty baseline. */
  canCapture: boolean
}>()

const emit = defineEmits<{
  armGroup: [group: Exclude<RigBodyPartGroup, 'spineHead'>]
  captureFront: []
  captureSide: []
  goToStep: [step: CameraCalibrationStep]
  finish: []
  cancel: []
}>()
</script>

<template>
  <div class="camera-calibration-panel" role="group" aria-label="Camera calibration">
    <template v-if="step === 'assignParts'">
      <p class="camera-calibration-panel__hint">
        {{
          armedGroup
            ? `Click the ${RIG_BODY_PART_GROUP_LABELS[armedGroup]} bone on the model.`
            : 'Optional: click a limb to assign its bone on this rig, or skip to use the default.'
        }}
      </p>
      <div class="camera-calibration-panel__groups">
        <Button
          v-for="group in ASSIGNABLE_GROUPS"
          :key="group"
          size="sm"
          :variant="armedGroup === group ? 'default' : 'secondary'"
          @click="emit('armGroup', group)"
        >
          {{ RIG_BODY_PART_GROUP_LABELS[group] }}
          <template v-if="rootBoneNames[group]"> ✓</template>
        </Button>
      </div>
      <div class="camera-calibration-panel__actions">
        <Button size="sm" variant="secondary" @click="emit('cancel')">Cancel</Button>
        <Button size="sm" @click="emit('goToStep', 'front')">Next: Face Camera</Button>
      </div>
    </template>
    <template v-else-if="step === 'front'">
      <div class="camera-calibration-panel__actions">
        <Button size="sm" variant="secondary" @click="emit('cancel')">Cancel</Button>
        <Button size="sm" :disabled="!canCapture" @click="emit('captureFront')">
          Capture Front
        </Button>
      </div>
    </template>
    <template v-else-if="step === 'side'">
      <div class="camera-calibration-panel__actions">
        <Button size="sm" variant="secondary" @click="emit('cancel')">Cancel</Button>
        <Button size="sm" :disabled="!canCapture" @click="emit('captureSide')">
          Capture Side
        </Button>
        <Button size="sm" @click="emit('finish')">Done</Button>
      </div>
    </template>
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
