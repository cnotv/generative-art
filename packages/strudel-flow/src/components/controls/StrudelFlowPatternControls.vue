<script setup lang="ts">
import { computed, inject } from 'vue'
import type { StrudelFlowNotesData } from '../../types'
import StrudelFlowNotation from '../notation/StrudelFlowNotation.vue'
import { STRUDEL_FLOW_NOTATION_CONTEXT } from '../notation/notationContextKey'

const props = defineProps<{
  data: StrudelFlowNotesData
}>()

const emit = defineEmits<{
  update: [data: StrudelFlowNotesData]
}>()

const notationContext = inject(STRUDEL_FLOW_NOTATION_CONTEXT, null)

// A drawn notation stands in for the text unless asked otherwise; with no reader to draw it, or
// with Mini notation picked, the text is the only view there is.
const isPatternVisible = computed(
  () =>
    !notationContext?.value.readNoteBars ||
    props.data.notation === 'text' ||
    props.data.showPattern === true
)

const onPatternInput = (event: Event): void => {
  const patternField = event.target
  if (patternField instanceof HTMLTextAreaElement) {
    emit('update', { ...props.data, pattern: patternField.value })
  }
}
</script>

<template>
  <StrudelFlowNotation :data="data" @update="emit('update', $event)" />
  <label v-if="isPatternVisible" class="strudel-flow-field">
    <span class="strudel-flow-field__label">Notes in mini notation</span>
    <textarea
      class="strudel-flow-textarea"
      :value="data.pattern"
      aria-label="Notes pattern"
      rows="2"
      spellcheck="false"
      @input="onPatternInput"
    />
  </label>
</template>
