<script setup lang="ts">
import { computed } from 'vue'
import {
  STRUDEL_FLOW_DRUM_SOUND_GROUPS,
  STRUDEL_FLOW_MAX_DRUM_ROWS,
  STRUDEL_FLOW_NEW_DRUM_SOUNDS,
  STRUDEL_FLOW_PAD_MODIFIER_OPTIONS,
  STRUDEL_FLOW_STEP_COUNT
} from '../../config'
import { createStrudelFlowDrumRow } from '../../nodeDefaults'
import type { StrudelFlowBeatsData, StrudelFlowDrumRow, StrudelFlowSampleGroup } from '../../types'
import StrudelFlowAccordion from './StrudelFlowAccordion.vue'
import StrudelFlowSelect from './StrudelFlowSelect.vue'
import StrudelFlowStepper from './StrudelFlowStepper.vue'

const props = defineProps<{
  data: StrudelFlowBeatsData
  sampleGroups?: StrudelFlowSampleGroup[]
}>()

const emit = defineEmits<{
  update: [data: StrudelFlowBeatsData]
}>()

const visibleSteps = computed(() =>
  Array.from({ length: props.data.steps }, (_, stepIndex) => stepIndex)
)

const DRUM_SOUNDS = new Set(STRUDEL_FLOW_DRUM_SOUND_GROUPS.flatMap((group) => group.sounds))

// The host's full library follows the drum shortlist, minus what the shortlist already names.
const libraryGroups = computed(() =>
  (props.sampleGroups ?? [])
    .map((group) => ({
      label: group.label,
      options: group.samples.filter((sample) => !DRUM_SOUNDS.has(sample.value))
    }))
    .filter((group) => group.options.length > 0)
)

const knownSounds = computed(
  () =>
    new Set([
      ...DRUM_SOUNDS,
      ...libraryGroups.value.flatMap((group) => group.options.map((option) => option.value))
    ])
)

const toOptions = (sounds: string[]): { value: string; label: string }[] =>
  sounds.map((sound) => ({ value: sound, label: sound }))

// A sample read from code that the list does not name, such as "bd:3", stays selectable.
const soundGroups = (
  sound: string
): { label: string; options: { value: string; label: string }[] }[] => [
  ...(knownSounds.value.has(sound)
    ? []
    : [{ label: 'In this pattern', options: toOptions([sound]) }]),
  ...STRUDEL_FLOW_DRUM_SOUND_GROUPS.map((group) => ({
    label: group.label,
    options: toOptions(group.sounds)
  })),
  ...libraryGroups.value
]

const update = (patch: Partial<StrudelFlowBeatsData>): void => {
  emit('update', { ...props.data, ...patch })
}

const updateRow = (rowIndex: number, patch: Partial<StrudelFlowDrumRow>): void => {
  update({
    rows: props.data.rows.map((row, index) => (index === rowIndex ? { ...row, ...patch } : row))
  })
}

const toggleStep = (rowIndex: number, stepIndex: number): void => {
  const row = props.data.rows[rowIndex]
  if (row !== undefined) {
    updateRow(rowIndex, {
      steps: row.steps.map((isHit, index) => (index === stepIndex ? !isHit : isHit))
    })
  }
}

const setModifier = (rowIndex: number, stepIndex: number, event: Event): void => {
  const row = props.data.rows[rowIndex]
  if (row === undefined || !(event.target instanceof HTMLSelectElement)) {
    return
  }
  const modifier = event.target.value
  updateRow(rowIndex, {
    modifiers: Object.fromEntries([
      ...Object.entries(row.modifiers).filter(([step]) => Number(step) !== stepIndex),
      ...(modifier.length > 0 ? [[stepIndex, modifier]] : [])
    ])
  })
}

const nextSound = (rows: StrudelFlowDrumRow[]): string =>
  STRUDEL_FLOW_NEW_DRUM_SOUNDS.find((sound) => !rows.some((row) => row.sound === sound)) ??
  STRUDEL_FLOW_NEW_DRUM_SOUNDS[0]

const setTrackCount = (trackCount: number): void => {
  const rows =
    trackCount <= props.data.rows.length
      ? props.data.rows.slice(0, trackCount)
      : Array.from({ length: trackCount - props.data.rows.length }).reduce<StrudelFlowDrumRow[]>(
          (current) => [...current, createStrudelFlowDrumRow(nextSound(current))],
          props.data.rows
        )
  update({ rows })
}
</script>

<template>
  <div class="strudel-flow-beats">
    <div class="strudel-flow-beats__tracks" role="group" aria-label="Drum tracks">
      <div v-for="(row, rowIndex) in data.rows" :key="rowIndex" class="strudel-flow-beats__track">
        <StrudelFlowSelect
          class="strudel-flow-beats__sound"
          :label="`Track ${rowIndex + 1} sound`"
          hide-label
          :model-value="row.sound"
          :groups="soundGroups(row.sound)"
          @update:model-value="updateRow(rowIndex, { sound: $event })"
        />
        <div class="strudel-flow-beats__steps" :style="{ '--beats-steps': data.steps }">
          <div v-for="stepIndex in visibleSteps" :key="stepIndex" class="strudel-flow-pad__column">
            <button
              type="button"
              class="strudel-flow-pad__cell nodrag"
              :class="{ 'strudel-flow-pad__cell--on': row.steps[stepIndex] }"
              :aria-pressed="row.steps[stepIndex] === true"
              :aria-label="`${row.sound} step ${stepIndex + 1}`"
              :title="`${row.sound} step ${stepIndex + 1}`"
              @click="toggleStep(rowIndex, stepIndex)"
            />
            <span v-if="data.showModifiers" class="strudel-flow-select strudel-flow-pad__modifier">
              <select
                class="nodrag"
                :value="row.modifiers[stepIndex] ?? ''"
                :aria-label="`${row.sound} step ${stepIndex + 1} variation`"
                @change="setModifier(rowIndex, stepIndex, $event)"
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
      </div>
    </div>

    <StrudelFlowAccordion
      :badge="String(data.rows.length)"
      summary="Shape"
      :meta="`${data.steps} steps`"
    >
      <div class="strudel-flow-accordion__row">
        <StrudelFlowStepper
          label="Steps"
          :model-value="data.steps"
          :min="1"
          :max="STRUDEL_FLOW_STEP_COUNT"
          @update:model-value="update({ steps: $event })"
        />
        <StrudelFlowStepper
          label="Tracks"
          :model-value="data.rows.length"
          :min="1"
          :max="STRUDEL_FLOW_MAX_DRUM_ROWS"
          @update:model-value="setTrackCount"
        />
        <div class="strudel-flow-field">
          <span class="strudel-flow-field__label">Modifiers</span>
          <button
            type="button"
            role="switch"
            class="strudel-flow-switch nodrag"
            :aria-checked="data.showModifiers"
            aria-label="Show step modifiers"
            @click="update({ showModifiers: !data.showModifiers })"
          >
            <span class="strudel-flow-switch__thumb" aria-hidden="true" />
          </button>
        </div>
      </div>
    </StrudelFlowAccordion>
  </div>
</template>
