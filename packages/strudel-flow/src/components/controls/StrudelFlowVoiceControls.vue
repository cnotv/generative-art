<script setup lang="ts">
import { STRUDEL_FLOW_SOUND_OPTIONS } from '../../config'
import StrudelFlowSelect from './StrudelFlowSelect.vue'

defineProps<{
  sound: string
}>()

const emit = defineEmits<{
  'update:sound': [sound: string]
}>()

const WAVEFORMS = [
  { value: 'sine', label: 'Sine', path: 'M2 16 C8 0 12 0 18 16 S28 32 34 16' },
  { value: 'triangle', label: 'Triangle', path: 'M2 24 L10 8 L26 24 L34 8' },
  { value: 'sawtooth', label: 'Saw', path: 'M2 24 L17 8 L17 24 L32 8 L32 24' },
  { value: 'square', label: 'Square', path: 'M2 24 L2 8 L18 8 L18 24 L34 24 L34 8' }
]
</script>

<template>
  <div class="strudel-flow-voice">
    <div class="strudel-flow-voice__waveforms" role="group" aria-label="Voice waveform">
      <button
        v-for="waveform in WAVEFORMS"
        :key="waveform.value"
        type="button"
        class="strudel-flow-voice__waveform nodrag"
        :class="{ 'strudel-flow-voice__waveform--active': sound === waveform.value }"
        :aria-label="waveform.label"
        :title="waveform.label"
        :aria-pressed="sound === waveform.value"
        @click="emit('update:sound', waveform.value)"
      >
        <svg viewBox="0 0 36 32" aria-hidden="true">
          <path :d="waveform.path" />
        </svg>
      </button>
    </div>
    <StrudelFlowSelect
      label="Voice"
      :model-value="sound"
      :options="STRUDEL_FLOW_SOUND_OPTIONS"
      @update:model-value="emit('update:sound', $event)"
    />
  </div>
</template>
