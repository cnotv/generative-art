<script setup lang="ts">
import { computed, ref } from 'vue'
import type {
  StrudelFlowNotesData,
  StrudelFlowSamplesData,
  StrudelFlowSoundGroup
} from '../../types'
import StrudelFlowSelect from './StrudelFlowSelect.vue'

const props = defineProps<{
  data: StrudelFlowNotesData | StrudelFlowSamplesData
  sampleGroups?: StrudelFlowSoundGroup[]
}>()

const emit = defineEmits<{
  update: [data: StrudelFlowNotesData | StrudelFlowSamplesData]
}>()

const SAMPLE_PICKER_PROMPT = [{ value: '', label: 'Pick a sample to add' }]

const label = computed(() => (props.data.kind === 'notes' ? 'Notes' : 'Samples'))

const pickerGroups = computed(() =>
  props.data.kind === 'samples'
    ? (props.sampleGroups ?? [])
        .filter((group) => group.sounds.length > 0)
        .map((group) => ({
          label: group.label,
          options: group.sounds.map((sound) => ({ value: sound, label: sound }))
        }))
    : []
)

// The picker adds and empties itself, so remounting it puts the prompt back after each pick.
const pickerResetCount = ref(0)

const onPatternInput = (event: Event): void => {
  const patternField = event.target
  if (patternField instanceof HTMLTextAreaElement) {
    emit('update', { ...props.data, pattern: patternField.value })
  }
}

const addSample = (sound: string): void => {
  pickerResetCount.value += 1
  if (sound.length > 0) {
    emit('update', { ...props.data, pattern: `${props.data.pattern.trim()} ${sound}`.trim() })
  }
}
</script>

<template>
  <label class="strudel-flow-field">
    <span class="strudel-flow-field__label">{{ label }} in mini notation</span>
    <textarea
      class="strudel-flow-textarea"
      :value="data.pattern"
      :aria-label="`${label} pattern`"
      rows="2"
      spellcheck="false"
      @input="onPatternInput"
    />
  </label>
  <StrudelFlowSelect
    v-if="pickerGroups.length > 0"
    :key="pickerResetCount"
    label="Add sample"
    model-value=""
    :options="SAMPLE_PICKER_PROMPT"
    :groups="pickerGroups"
    @update:model-value="addSample"
  />
</template>
