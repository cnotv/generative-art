<script setup lang="ts">
import GenericPanel from './GenericPanel.vue';
import RecordingControls from '@/components/RecordingControls.vue';

interface Props {
  isRecording?: boolean;
  minDurationMs?: number;
  maxDurationMs?: number;
}

interface Emits {
  (e: 'start', durationMs: number): void;
  (e: 'stop'): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

const handleStart = (durationMs: number) => {
  emit('start', durationMs);
};

const handleStop = () => {
  emit('stop');
};
</script>

<template>
  <GenericPanel
    panel-type="recording"
    side="right"
  >
    <div class="recording-panel flex flex-col h-full">
      <div class="recording-panel__header p-4 border-b border-white/10">
        <h2 class="text-lg font-semibold text-white">Recording</h2>
      </div>

      <div class="recording-panel__content flex-1 p-4 overflow-y-auto">
        <RecordingControls
          :is-recording="isRecording"
          :min-duration-ms="minDurationMs"
          :max-duration-ms="maxDurationMs"
          @start="handleStart"
          @stop="handleStop"
        />
      </div>
    </div>
  </GenericPanel>
</template>

<style scoped>
.recording-panel__content {
  min-height: 0;
}
</style>
