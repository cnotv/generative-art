<script setup lang="ts">
import { computed } from 'vue'
import { STRUDEL_FLOW_SOUND_OPTIONS } from '../../config'
import type { StrudelFlowSampleGroup, StrudelFlowVoiceData } from '../../types'
import StrudelFlowSelect from './StrudelFlowSelect.vue'

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
const soundGroups = computed(() =>
  (props.voiceGroups ?? [])
    .map((group) => ({
      label: group.label,
      options: group.samples.filter((sample) => !waveformValues.has(sample.value))
    }))
    .filter((group) => group.options.length > 0)
)

const isListed = computed(
  () =>
    waveformValues.has(sound.value) ||
    soundGroups.value.some((group) => group.options.some((option) => option.value === sound.value))
)

// A sound read from code that the host does not list stays selectable next to the waveforms.
const soundOptions = computed(() =>
  isListed.value
    ? STRUDEL_FLOW_SOUND_OPTIONS
    : [...STRUDEL_FLOW_SOUND_OPTIONS, { value: sound.value, label: sound.value }]
)

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
    <StrudelFlowSelect
      label="Voice"
      :model-value="sound"
      :options="soundOptions"
      :groups="soundGroups"
      @update:model-value="setSound"
    />
  </div>
</template>
