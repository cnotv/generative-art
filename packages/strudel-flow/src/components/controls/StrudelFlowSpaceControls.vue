<script setup lang="ts">
import StrudelFlowKnob from './StrudelFlowKnob.vue'
import type { StrudelFlowSpaceData } from '../../types'

const props = defineProps<{
  data: StrudelFlowSpaceData
}>()

const emit = defineEmits<{
  update: [data: StrudelFlowSpaceData]
}>()

const update = (patch: Partial<StrudelFlowSpaceData>): void => {
  emit('update', { ...props.data, ...patch })
}
</script>

<template>
  <div class="strudel-flow-knobs">
    <StrudelFlowKnob
      label="Room"
      :model-value="data.room"
      :min="0"
      :max="1"
      :step="0.01"
      @update:model-value="update({ room: $event })"
    />
    <StrudelFlowKnob
      label="Size"
      :model-value="data.roomSize"
      :min="0"
      :max="20"
      :step="0.1"
      @update:model-value="update({ roomSize: $event })"
    />
    <StrudelFlowKnob
      label="Fade"
      :model-value="data.roomFade"
      :min="0"
      :max="10"
      :step="0.1"
      @update:model-value="update({ roomFade: $event })"
    />
    <StrudelFlowKnob
      label="Low-pass"
      :model-value="data.roomLowPass"
      :min="0"
      :max="20000"
      :step="100"
      suffix="Hz"
      @update:model-value="update({ roomLowPass: $event })"
    />
    <StrudelFlowKnob
      label="Dim"
      :model-value="data.roomDim"
      :min="0"
      :max="20000"
      :step="100"
      suffix="Hz"
      @update:model-value="update({ roomDim: $event })"
    />
  </div>
</template>
