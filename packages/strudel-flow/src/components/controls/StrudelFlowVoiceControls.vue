<script setup lang="ts">
import { computed } from 'vue'
import { STRUDEL_FLOW_SOUND_OPTIONS } from '../../config'
import type { StrudelFlowSampleGroup, StrudelFlowVoiceData } from '../../types'
import StrudelFlowSamplePicker from './StrudelFlowSamplePicker.vue'

const props = defineProps<{
  data: StrudelFlowVoiceData
  /** Every synth and instrument the host can play, under their headings. */
  voiceGroups?: StrudelFlowSampleGroup[]
}>()

const emit = defineEmits<{
  update: [data: StrudelFlowVoiceData]
}>()

const sound = computed(() => props.data.sound)

const waveformValues = new Set(STRUDEL_FLOW_SOUND_OPTIONS.map((option) => option.value))

// The four waveforms are listed above, so the host's copies of them are left out of the groups.
const soundGroups = computed<StrudelFlowSampleGroup[]>(() => [
  { label: 'Waveforms', samples: STRUDEL_FLOW_SOUND_OPTIONS },
  ...(props.voiceGroups ?? [])
    .map((group) => ({
      label: group.label,
      samples: group.samples.filter((sample) => !waveformValues.has(sample.value))
    }))
    .filter((group) => group.samples.length > 0)
])

const setSound = (nextSound: string): void => {
  emit('update', { kind: 'voice', sound: nextSound })
}

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
        @click="setSound(waveform.value)"
      >
        <svg viewBox="0 0 36 32" aria-hidden="true">
          <path :d="waveform.path" />
        </svg>
      </button>
    </div>
    <StrudelFlowSamplePicker
      label="Voice"
      :model-value="sound"
      :groups="soundGroups"
      @update:model-value="setSound"
    />
  </div>
</template>
