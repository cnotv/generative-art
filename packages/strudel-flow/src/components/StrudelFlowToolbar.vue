<script setup lang="ts">
import { ref, watch } from 'vue'
import { ChevronDown } from 'lucide-vue-next'
import {
  STRUDEL_FLOW_BEATS_PER_CYCLE_OPTIONS,
  STRUDEL_FLOW_MAX_BEATS_PER_MINUTE,
  STRUDEL_FLOW_MIN_BEATS_PER_MINUTE
} from '../config'
import { normalizeStrudelFlowBeatsPerMinute } from '../tempo'

const props = defineProps<{
  beatsPerMinute: number
  beatsPerCycle: number
}>()

const emit = defineEmits<{
  'update:beatsPerMinute': [beatsPerMinute: number]
  'update:beatsPerCycle': [beatsPerCycle: number]
}>()

const tempoDraft = ref(String(props.beatsPerMinute))

watch(
  () => props.beatsPerMinute,
  (beatsPerMinute) => {
    tempoDraft.value = String(beatsPerMinute)
  }
)

// A half-typed tempo such as "1" on the way to "128" stays a draft until it is committed.
const commitTempo = (): void => {
  const parsedTempo = Number(tempoDraft.value)
  if (tempoDraft.value.trim().length === 0 || !Number.isFinite(parsedTempo)) {
    tempoDraft.value = String(props.beatsPerMinute)
    return
  }
  const normalizedTempo = normalizeStrudelFlowBeatsPerMinute(parsedTempo)
  tempoDraft.value = String(normalizedTempo)
  if (normalizedTempo !== props.beatsPerMinute) {
    emit('update:beatsPerMinute', normalizedTempo)
  }
}

const onTempoInput = (event: Event): void => {
  if (event.target instanceof HTMLInputElement) {
    tempoDraft.value = event.target.value
  }
}

const onCycleChange = (event: Event): void => {
  if (event.target instanceof HTMLSelectElement) {
    emit('update:beatsPerCycle', Number(event.target.value))
  }
}
</script>

<template>
  <div class="strudel-flow-toolbar nodrag" role="group" aria-label="Tempo">
    <label class="strudel-flow-toolbar__field">
      <input
        class="strudel-flow-toolbar__tempo"
        type="number"
        inputmode="numeric"
        :min="STRUDEL_FLOW_MIN_BEATS_PER_MINUTE"
        :max="STRUDEL_FLOW_MAX_BEATS_PER_MINUTE"
        :value="tempoDraft"
        aria-label="Beats per minute"
        @input="onTempoInput"
        @blur="commitTempo"
        @keydown.enter="commitTempo"
      />
      <span class="strudel-flow-toolbar__unit">BPM</span>
    </label>
    <label class="strudel-flow-toolbar__field">
      <span class="strudel-flow-toolbar__cycle">
        <select :value="String(beatsPerCycle)" aria-label="Beats per cycle" @change="onCycleChange">
          <option
            v-for="option in STRUDEL_FLOW_BEATS_PER_CYCLE_OPTIONS"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
        <ChevronDown aria-hidden="true" />
      </span>
      <span class="strudel-flow-toolbar__unit">B/C</span>
    </label>
  </div>
</template>
