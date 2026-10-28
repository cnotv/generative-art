<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  STRUDEL_FLOW_CHORD_PRESETS,
  getStrudelFlowChordLabels,
  getStrudelFlowChordNotes,
  getStrudelFlowChordProgression
} from '../../chords'
import {
  STRUDEL_FLOW_CHORD_SCALE_OPTIONS,
  STRUDEL_FLOW_KEY_OPTIONS,
  STRUDEL_FLOW_SCALE_OPTIONS
} from '../../config'
import type { StrudelFlowChordsData } from '../../types'
import StrudelFlowAccordion from './StrudelFlowAccordion.vue'
import StrudelFlowChordEditor from './StrudelFlowChordEditor.vue'
import StrudelFlowSelect from './StrudelFlowSelect.vue'
import StrudelFlowStepper from './StrudelFlowStepper.vue'

const props = defineProps<{
  data: StrudelFlowChordsData
}>()

const emit = defineEmits<{
  update: [data: StrudelFlowChordsData]
}>()

const selectedStep = ref(0)
const chords = computed(() => getStrudelFlowChordNotes(props.data))
const progression = computed(() => getStrudelFlowChordProgression(props.data))
const labels = computed(() => getStrudelFlowChordLabels(props.data))
const activeStep = computed(() =>
  Math.min(selectedStep.value, Math.max(0, chords.value.length - 1))
)
const tones = computed(() => chords.value[activeStep.value] ?? [])
const noteSlots = computed(() =>
  Math.max(14, Math.ceil((Math.max(0, ...chords.value.flat()) + 1) / 7) * 7)
)
const scaleLabel = computed(
  () =>
    STRUDEL_FLOW_SCALE_OPTIONS.find((option) => option.value === props.data.scaleType)?.label ??
    props.data.scaleType
)
const maxNote = computed(() => Math.max(13, ...chords.value.flat()))

const update = (patch: Partial<StrudelFlowChordsData>): void => {
  emit('update', { ...props.data, ...patch })
}

const changeNotes = (notes: number[][]): void => {
  update({ chordNotes: notes })
}

const changeChord = (notes: number[]): void => {
  changeNotes(
    chords.value.length > 0
      ? chords.value.map((chord, index) => (index === activeStep.value ? notes : chord))
      : [notes]
  )
}

const applyPreset = (steps: readonly number[]): void => {
  update({ chordProgression: [...steps], chordNotes: undefined })
  selectedStep.value = 0
}

const addChord = (): void => {
  if (progression.value.length >= 16) {
    return
  }
  const lastChord = chords.value.at(-1) ?? [0, 2, 4]
  changeNotes([...chords.value, [...lastChord]])
  selectedStep.value = chords.value.length
}

const presetPoints = (steps: readonly number[]): string =>
  steps.map((degree, index) => `${9 + index * 18},${18 - degree * 2}`).join(' ')

const onScaleChange = (value: string): void => {
  if (value === 'major' || value === 'minor') {
    update({ scaleType: value })
  }
}

const cardLabel = (index: number): string => {
  if (props.data.chordNotes !== undefined) {
    return chords.value[index]?.length ? chords.value[index].join(', ') : 'rest'
  }
  return labels.value.degrees[progression.value[index] ?? 0] ?? ''
}

const cardName = (index: number): string => {
  if (props.data.chordNotes !== undefined) {
    return chords.value[index]?.length ? chords.value[index].join('·') : 'Rest'
  }
  return labels.value.chordName(progression.value[index] ?? 0)
}
</script>

<template>
  <div class="strudel-flow-chords">
    <StrudelFlowChordEditor
      :key="activeStep"
      :notes="tones"
      :note-slots="noteSlots"
      :note-name="labels.noteName"
      :note-label="labels.noteLabel"
      @update="changeChord"
    />

    <div class="strudel-flow-chords__presets" role="group" aria-label="Progression presets">
      <button
        v-for="preset in STRUDEL_FLOW_CHORD_PRESETS"
        :key="preset.label"
        type="button"
        class="strudel-flow-chords__preset nodrag"
        @click="applyPreset(preset.steps)"
      >
        <svg viewBox="0 0 72 22" aria-hidden="true">
          <polyline :points="presetPoints(preset.steps)" fill="none" />
          <circle
            v-for="(degree, index) in preset.steps"
            :key="index"
            :cx="9 + index * 18"
            :cy="18 - degree * 2"
            r="3"
          />
        </svg>
        {{ preset.label }}
      </button>
    </div>

    <div class="strudel-flow-chords__progression" role="group" aria-label="Chord progression">
      <button
        v-for="(degree, index) in progression"
        :key="index"
        type="button"
        class="strudel-flow-chords__card nodrag"
        :class="{ 'strudel-flow-chords__card--active': activeStep === index }"
        :aria-label="`Chord step ${index + 1}: ${cardLabel(index)}`"
        :aria-pressed="activeStep === index"
        @click="selectedStep = index"
      >
        <span class="strudel-flow-chords__card-meta">
          <span>{{ index + 1 }}</span>
          <span>{{ data.chordNotes !== undefined ? 'n' : labels.degrees[degree] }}</span>
        </span>
        <svg viewBox="0 0 48 40" class="strudel-flow-chords__shape" aria-hidden="true">
          <path
            v-for="line in [0, 1, 2, 3, 4]"
            :key="line"
            :d="`M4 ${6 + line * 7}H44`"
            class="strudel-flow-chords__staff"
          />
          <rect
            v-for="(note, noteIndex) in chords[index]"
            :key="noteIndex"
            :x="5 + (noteIndex * 28) / Math.max(1, (chords[index]?.length ?? 1) - 1)"
            :y="32 - (note / maxNote) * 26"
            width="15"
            height="4"
            rx="2"
            class="strudel-flow-chords__note"
          />
        </svg>
        <span class="strudel-flow-chords__card-name">{{ cardName(index) }}</span>
      </button>
    </div>

    <button
      type="button"
      class="strudel-flow-chords__add nodrag"
      aria-label="Add chord step"
      :disabled="progression.length >= 16"
      @click="addChord"
    >
      +
    </button>

    <StrudelFlowAccordion
      :badge="`${data.key}${data.octave}`"
      :summary="scaleLabel"
      :meta="`${progression.length} chords`"
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
          :options="STRUDEL_FLOW_CHORD_SCALE_OPTIONS"
          @update:model-value="onScaleChange"
        />
        <StrudelFlowStepper
          label="Octave"
          :model-value="data.octave"
          :min="1"
          :max="8"
          @update:model-value="update({ octave: $event })"
        />
      </div>
    </StrudelFlowAccordion>
  </div>
</template>
