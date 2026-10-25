<script setup lang="ts">
import type { StrudelFlowPadData } from '../../types'
import { STRUDEL_FLOW_SOUND_OPTIONS } from '../../config'

const props = defineProps<{
  data: StrudelFlowPadData
}>()

const emit = defineEmits<{
  update: [data: StrudelFlowPadData]
}>()

const onNotesInput = (value: string | number): void => {
  emit('update', { ...props.data, notes: String(value) })
}

const onSoundChange = (event: Event): void => {
  const select = event.target
  if (select instanceof HTMLSelectElement) {
    emit('update', { ...props.data, sound: select.value })
  }
}
</script>

<template>
  <div class="strudel-flow-controls">
    <label class="strudel-flow-field">
      <span class="strudel-flow-field__label">Notes</span>
      <input
        class="input"
        :model-value="data.notes"
        aria-label="Pad notes"
        placeholder="&lt;c3 eb3 g3&gt;"
        @input="onNotesInput"
      />
    </label>
    <label class="strudel-flow-field">
      <span class="strudel-flow-field__label">Synth</span>
      <select
        :value="data.sound"
        aria-label="Pad synth"
        @change="onSoundChange"
      >
        <option
          v-for="option in STRUDEL_FLOW_SOUND_OPTIONS"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </option>
      </select>
    </label>
  </div>
</template>
