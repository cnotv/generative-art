<script setup lang="ts">
import type { StrudelFlowBeatsData, StrudelFlowDrumInstrument } from '../../types'
import { STRUDEL_FLOW_DRUM_LABELS } from '../../nodeDefaults'

const props = defineProps<{
  data: StrudelFlowBeatsData
}>()

const emit = defineEmits<{
  update: [data: StrudelFlowBeatsData]
}>()

const onStepToggle = (instrument: StrudelFlowDrumInstrument, stepIndex: number): void => {
  emit('update', {
    kind: 'beats',
    rows: props.data.rows.map((row) =>
      row.instrument === instrument
        ? {
            ...row,
            steps: row.steps.map((step, index) => (index === stepIndex ? !step : step))
          }
        : row
    )
  })
}
</script>

<template>
  <div class="strudel-flow-steps" role="group" aria-label="Drum steps">
    <div v-for="row in data.rows" :key="row.instrument" class="strudel-flow-steps__row">
      <span class="strudel-flow-field__label">
        {{ STRUDEL_FLOW_DRUM_LABELS[row.instrument] }}
      </span>
      <div class="strudel-flow-steps__cells">
        <button
          v-for="(isHit, stepIndex) in row.steps"
          :key="stepIndex"
          type="button"
          class="strudel-flow-steps__cell"
          :class="{ 'strudel-flow-steps__cell--active': isHit }"
          :aria-pressed="isHit"
          :aria-label="`${STRUDEL_FLOW_DRUM_LABELS[row.instrument]} step ${stepIndex + 1}`"
          @click="onStepToggle(row.instrument, stepIndex)"
        />
      </div>
    </div>
  </div>
</template>
