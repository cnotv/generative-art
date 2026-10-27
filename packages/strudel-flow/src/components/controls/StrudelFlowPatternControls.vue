<script setup lang="ts">
import { computed } from 'vue'
import type { StrudelFlowNotesData, StrudelFlowSamplesData } from '../../types'

const props = defineProps<{
  data: StrudelFlowNotesData | StrudelFlowSamplesData
}>()

const emit = defineEmits<{
  update: [data: StrudelFlowNotesData | StrudelFlowSamplesData]
}>()

const label = computed(() => (props.data.kind === 'notes' ? 'Notes' : 'Samples'))

const onPatternInput = (event: Event): void => {
  const patternField = event.target
  if (patternField instanceof HTMLTextAreaElement) {
    emit('update', { ...props.data, pattern: patternField.value })
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
</template>
