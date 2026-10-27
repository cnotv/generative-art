<script setup lang="ts">
import { computed } from 'vue'
import {
  STRUDEL_FLOW_KEY_OPTIONS,
  STRUDEL_FLOW_PAD_MODIFIER_OPTIONS,
  STRUDEL_FLOW_PAD_NOTE_COUNT,
  STRUDEL_FLOW_SCALE_OPTIONS
} from '../../config'
import type { StrudelFlowPadData } from '../../types'
import StrudelFlowAccordion from './StrudelFlowAccordion.vue'
import StrudelFlowSelect from './StrudelFlowSelect.vue'
import StrudelFlowStepper from './StrudelFlowStepper.vue'

const props = defineProps<{
  data: StrudelFlowPadData
}>()

const emit = defineEmits<{
  update: [data: StrudelFlowPadData]
}>()

const noteRows = Array.from({ length: STRUDEL_FLOW_PAD_NOTE_COUNT }, (_, note) => note)
const PAD_MODES = ['arp', 'chord'] as const
const visibleSteps = computed(() =>
  Array.from({ length: props.data.steps }, (_, stepIndex) => stepIndex)
)
const scaleLabel = computed(
  () =>
    STRUDEL_FLOW_SCALE_OPTIONS.find((option) => option.value === props.data.scaleType)?.label ??
    props.data.scaleType
)

const update = (patch: Partial<StrudelFlowPadData>): void => {
  emit('update', { ...props.data, ...patch })
}

const toggleCell = (stepIndex: number, noteIndex: number): void => {
  update({
    grid: props.data.grid.map((row, rowIndex) =>
      rowIndex === stepIndex ? row.map((isOn, note) => (note === noteIndex ? !isOn : isOn)) : row
    )
  })
}

const onModifierChange = (stepIndex: number, event: Event): void => {
  const select = event.target
  if (!(select instanceof HTMLSelectElement)) {
    return
  }
  const columnModifiers = { ...props.data.columnModifiers }
  if (select.value.length === 0) {
    delete columnModifiers[stepIndex]
  } else {
    columnModifiers[stepIndex] = select.value
  }
  update({ columnModifiers })
}
</script>

<template>
  <div class="strudel-flow-pad">
    <div
      class="strudel-flow-pad__grid"
      :style="{ '--pad-steps': data.steps }"
      role="group"
      aria-label="Pad notes"
    >
      <div v-for="stepIndex in visibleSteps" :key="stepIndex" class="strudel-flow-pad__column">
        <span class="strudel-flow-pad__playhead" aria-hidden="true" />
        <button
          v-for="noteIndex in noteRows"
          :key="noteIndex"
          type="button"
          class="strudel-flow-pad__cell nodrag"
          :class="{ 'strudel-flow-pad__cell--on': data.grid[stepIndex]?.[noteIndex] === true }"
          :aria-pressed="data.grid[stepIndex]?.[noteIndex] === true"
          :aria-label="`Note ${noteIndex + 1}, step ${stepIndex + 1}`"
          :title="`Note ${noteIndex + 1}, step ${stepIndex + 1}`"
          @click="toggleCell(stepIndex, noteIndex)"
        />
        <span class="strudel-flow-select strudel-flow-pad__modifier">
          <select
            :value="data.columnModifiers[stepIndex] ?? ''"
            :aria-label="`Step ${stepIndex + 1} variation`"
            :title="`Step ${stepIndex + 1} variation`"
            @change="onModifierChange(stepIndex, $event)"
          >
            <option
              v-for="modifier in STRUDEL_FLOW_PAD_MODIFIER_OPTIONS"
              :key="modifier.value"
              :value="modifier.value"
            >
              {{ modifier.value || '○' }}
            </option>
          </select>
        </span>
      </div>
    </div>

    <StrudelFlowAccordion
      :badge="`${data.key}${data.octave}`"
      :summary="scaleLabel"
      :meta="`${data.steps} steps`"
    >
      <div class="strudel-flow-accordion__row">
        <StrudelFlowSelect
          label="Key"
          :model-value="data.key"
          :options="STRUDEL_FLOW_KEY_OPTIONS"
          @update:model-value="update({ key: $event })"
        />
        <StrudelFlowSelect
          label="Scale"
          :model-value="data.scaleType"
          :options="STRUDEL_FLOW_SCALE_OPTIONS"
          @update:model-value="update({ scaleType: $event })"
        />
        <StrudelFlowStepper
          label="Octave"
          :model-value="data.octave"
          :min="1"
          :max="8"
          @update:model-value="update({ octave: $event })"
        />
      </div>
      <div class="strudel-flow-accordion__row">
        <StrudelFlowStepper
          label="Steps"
          :model-value="data.steps"
          :min="1"
          :max="16"
          @update:model-value="update({ steps: $event })"
        />
        <div class="strudel-flow-field">
          <span class="strudel-flow-field__label">Mode</span>
          <div class="strudel-flow-mode" role="group" aria-label="Pad mode">
            <button
              v-for="mode in PAD_MODES"
              :key="mode"
              type="button"
              class="strudel-flow-mode__button nodrag"
              :class="{ 'strudel-flow-mode__button--active': data.mode === mode }"
              :aria-pressed="data.mode === mode"
              @click="update({ mode })"
            >
              {{ mode === 'arp' ? 'Arp' : 'Chord' }}
            </button>
          </div>
        </div>
      </div>
    </StrudelFlowAccordion>
  </div>
</template>
