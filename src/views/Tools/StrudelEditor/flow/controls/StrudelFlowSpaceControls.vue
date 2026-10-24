<script setup lang="ts">
import StrudelFlowSliderField from './StrudelFlowSliderField.vue'
import type { StrudelFlowSpaceData } from '../types'

const props = defineProps<{
  data: StrudelFlowSpaceData
}>()

const emit = defineEmits<{
  update: [data: StrudelFlowSpaceData]
}>()

const onRoomChange = (room: number): void => {
  emit('update', { ...props.data, room })
}

const onRoomSizeChange = (roomSize: number): void => {
  emit('update', { ...props.data, roomSize })
}
</script>

<template>
  <div class="strudel-flow-controls">
    <StrudelFlowSliderField
      label="Room"
      :model-value="data.room"
      :min="0"
      :max="1"
      :step="0.01"
      @update:model-value="onRoomChange"
    />
    <StrudelFlowSliderField
      label="Room size"
      :model-value="data.roomSize"
      :min="0"
      :max="20"
      :step="0.1"
      @update:model-value="onRoomSizeChange"
    />
  </div>
</template>
