<script setup lang="ts">
import type { StrudelFlowChordsData } from '../../types'
import {
  STRUDEL_FLOW_CHORD_ROOT_OPTIONS,
  STRUDEL_FLOW_CHORD_TYPE_OPTIONS,
  STRUDEL_FLOW_SOUND_OPTIONS
} from '../../config'

const props = defineProps<{
  data: StrudelFlowChordsData
}>()

const emit = defineEmits<{
  update: [data: StrudelFlowChordsData]
}>()

const onRootChange = (event: Event): void => {
  const select = event.target
  if (select instanceof HTMLSelectElement) {
    emit('update', { ...props.data, root: select.value })
  }
}

const onChordTypeChange = (event: Event): void => {
  const select = event.target
  if (select instanceof HTMLSelectElement) {
    emit('update', { ...props.data, chordType: select.value })
  }
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
      <span class="strudel-flow-field__label">Root</span>
      <select :value="data.root" aria-label="Chord root" @change="onRootChange">
        <option
          v-for="option in STRUDEL_FLOW_CHORD_ROOT_OPTIONS"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </option>
      </select>
    </label>
    <label class="strudel-flow-field">
      <span class="strudel-flow-field__label">Chord</span>
      <select :value="data.chordType" aria-label="Chord type" @change="onChordTypeChange">
        <option
          v-for="option in STRUDEL_FLOW_CHORD_TYPE_OPTIONS"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </option>
      </select>
    </label>
    <label class="strudel-flow-field">
      <span class="strudel-flow-field__label">Synth</span>
      <select :value="data.sound" aria-label="Chord synth" @change="onSoundChange">
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
