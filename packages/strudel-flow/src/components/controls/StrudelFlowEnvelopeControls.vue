<script setup lang="ts">
import StrudelFlowKnob from './StrudelFlowKnob.vue'
import { computed } from 'vue'
import { getEnvelopePoints } from '../../envelopeShape'
import type { StrudelFlowEnvelopeData } from '../../types'

const props = defineProps<{
  data: StrudelFlowEnvelopeData
}>()

const emit = defineEmits<{
  update: [data: StrudelFlowEnvelopeData]
}>()

const update = (patch: Partial<StrudelFlowEnvelopeData>): void => {
  emit('update', { ...props.data, ...patch })
}

const CHART_WIDTH = 160
const CHART_HEIGHT = 56
const CHART_PADDING = 4

const curvePoints = computed(() =>
  getEnvelopePoints(props.data)
    .map(
      ({ x, y }) =>
        `${CHART_PADDING + x * (CHART_WIDTH - CHART_PADDING * 2)},${CHART_HEIGHT - CHART_PADDING - y * (CHART_HEIGHT - CHART_PADDING * 2)}`
    )
    .join(' ')
)
</script>

<template>
  <svg
    class="strudel-flow-envelope-chart"
    :viewBox="`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`"
    role="img"
    aria-label="Envelope shape"
  >
    <polygon
      :points="`${CHART_PADDING},${CHART_HEIGHT - CHART_PADDING} ${curvePoints}`"
      class="fill"
    />
    <polyline :points="curvePoints" class="line" />
  </svg>
  <div class="strudel-flow-knobs">
    <StrudelFlowKnob
      label="Attack"
      :model-value="data.attack"
      :min="0"
      :max="2"
      :step="0.01"
      @update:model-value="update({ attack: $event })"
    />
    <StrudelFlowKnob
      label="Decay"
      :model-value="data.decay"
      :min="0"
      :max="2"
      :step="0.01"
      @update:model-value="update({ decay: $event })"
    />
    <StrudelFlowKnob
      label="Sustain"
      :model-value="data.sustain"
      :min="0"
      :max="1"
      :step="0.01"
      @update:model-value="update({ sustain: $event })"
    />
    <StrudelFlowKnob
      label="Release"
      :model-value="data.release"
      :min="0"
      :max="2"
      :step="0.01"
      @update:model-value="update({ release: $event })"
    />
  </div>
</template>
