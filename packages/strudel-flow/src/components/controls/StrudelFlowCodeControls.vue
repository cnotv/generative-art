<script setup lang="ts">
import type { StrudelFlowCodeData } from '../../types'
import { STRUDEL_FLOW_CODE_DEFAULTS } from '../../nodeDefaults'

const props = defineProps<{
  data: StrudelFlowCodeData
}>()

const emit = defineEmits<{
  update: [data: StrudelFlowCodeData]
}>()

const onCodeInput = (event: Event): void => {
  const codeField = event.target
  if (codeField instanceof HTMLTextAreaElement) {
    emit('update', { kind: 'code', code: codeField.value })
  }
}
</script>

<template>
  <label class="strudel-flow-field">
    <span class="strudel-flow-field__label">Expression</span>
    <textarea
      class="strudel-flow-textarea"
      :value="props.data.code"
      :placeholder="STRUDEL_FLOW_CODE_DEFAULTS.code"
      aria-label="Code expression"
      rows="5"
      spellcheck="false"
      @input="onCodeInput"
    />
  </label>
</template>
