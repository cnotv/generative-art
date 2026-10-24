<script setup lang="ts">
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { STRUDEL_FLOW_SOUND_OPTIONS } from '../config'
import type { StrudelFlowPadData } from '../types'

const props = defineProps<{
  data: StrudelFlowPadData
}>()

const emit = defineEmits<{
  update: [data: StrudelFlowPadData]
}>()

const onNotesInput = (value: string | number): void => {
  emit('update', { ...props.data, notes: String(value) })
}

const onSoundChange = (sound: string): void => {
  emit('update', { ...props.data, sound })
}
</script>

<template>
  <div class="strudel-flow-controls">
    <label class="strudel-flow-field">
      <span class="strudel-flow-field__label">Notes</span>
      <Input
        :model-value="data.notes"
        aria-label="Pad notes"
        placeholder="&lt;c3 eb3 g3&gt;"
        @update:model-value="onNotesInput"
      />
    </label>
    <label class="strudel-flow-field">
      <span class="strudel-flow-field__label">Synth</span>
      <Select
        :model-value="data.sound"
        :options="STRUDEL_FLOW_SOUND_OPTIONS"
        aria-label="Pad synth"
        @update:model-value="onSoundChange"
      />
    </label>
  </div>
</template>
