<script setup lang="ts">
import { Select } from '@/components/ui/select'
import {
  STRUDEL_FLOW_CHORD_ROOT_OPTIONS,
  STRUDEL_FLOW_CHORD_TYPE_OPTIONS,
  STRUDEL_FLOW_SOUND_OPTIONS
} from '../config'
import type { StrudelFlowChordsData } from '../types'

const props = defineProps<{
  data: StrudelFlowChordsData
}>()

const emit = defineEmits<{
  update: [data: StrudelFlowChordsData]
}>()

const onRootChange = (root: string): void => {
  emit('update', { ...props.data, root })
}

const onChordTypeChange = (chordType: string): void => {
  emit('update', { ...props.data, chordType })
}

const onSoundChange = (sound: string): void => {
  emit('update', { ...props.data, sound })
}
</script>

<template>
  <div class="strudel-flow-controls">
    <label class="strudel-flow-field">
      <span class="strudel-flow-field__label">Root</span>
      <Select
        :model-value="data.root"
        :options="STRUDEL_FLOW_CHORD_ROOT_OPTIONS"
        aria-label="Chord root"
        @update:model-value="onRootChange"
      />
    </label>
    <label class="strudel-flow-field">
      <span class="strudel-flow-field__label">Chord</span>
      <Select
        :model-value="data.chordType"
        :options="STRUDEL_FLOW_CHORD_TYPE_OPTIONS"
        aria-label="Chord type"
        @update:model-value="onChordTypeChange"
      />
    </label>
    <label class="strudel-flow-field">
      <span class="strudel-flow-field__label">Synth</span>
      <Select
        :model-value="data.sound"
        :options="STRUDEL_FLOW_SOUND_OPTIONS"
        aria-label="Chord synth"
        @update:model-value="onSoundChange"
      />
    </label>
  </div>
</template>
