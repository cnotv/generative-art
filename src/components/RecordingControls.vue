<script setup lang="ts">
import { ref, computed } from 'vue';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Circle, Square } from 'lucide-vue-next';

const emit = defineEmits<{
  start: [durationMs: number];
  stop: [];
}>();

const props = withDefaults(
  defineProps<{
    isRecording?: boolean;
    minDurationMs?: number;
    maxDurationMs?: number;
  }>(),
  {
    isRecording: false,
    minDurationMs: 0,
    maxDurationMs: 300000, // 300 seconds = 5 minutes
  }
);

// Duration in milliseconds
const recordingDurationMs = ref(10000); // Default 10 seconds

// Display values
const durationSeconds = computed(() => (recordingDurationMs.value / 1000).toFixed(1));
const durationMinutes = computed(() => {
  const totalSeconds = recordingDurationMs.value / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
});

const handleToggleRecording = () => {
  if (props.isRecording) {
    emit('stop');
  } else {
    emit('start', recordingDurationMs.value);
  }
};

const handleSliderChange = (value: number[]) => {
  recordingDurationMs.value = value[0];
};
</script>

<template>
  <div class="recording-controls">
    <div class="recording-controls__duration">
      <div class="recording-controls__header">
        <label class="recording-controls__label">Duration</label>
        <span class="recording-controls__value">{{ durationMinutes }}</span>
      </div>
      <Slider
        :model-value="[recordingDurationMs]"
        :min="minDurationMs"
        :max="maxDurationMs"
        :step="1000"
        :disabled="isRecording"
        @update:model-value="handleSliderChange"
      />
    </div>

    <Button
      size="sm"
      :class="[
        'recording-controls__button',
        isRecording
          ? 'bg-red-500 hover:bg-red-600'
          : 'bg-green-500 hover:bg-green-600',
      ]"
      @click="handleToggleRecording"
    >
      <component :is="isRecording ? Square : Circle" class="recording-controls__icon" />
      {{ isRecording ? 'Stop' : 'Start' }}
    </Button>

    <p v-if="isRecording" class="recording-controls__status">
      Recording in progress...
    </p>
  </div>
</template>

<style scoped>
.recording-controls {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.recording-controls__duration {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.recording-controls__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.recording-controls__label {
  font-size: 0.75rem;
  font-weight: 500;
}

.recording-controls__value {
  font-size: 0.75rem;
  font-family: monospace;
  color: var(--color-muted-foreground, #999);
}

.recording-controls__button {
  color: white;
  font-weight: 500;
}

.recording-controls__icon {
  width: 0.75rem;
  height: 0.75rem;
  margin-right: 0.5rem;
}

.recording-controls__status {
  font-size: 0.75rem;
  color: var(--color-muted-foreground, #999);
  text-align: center;
}
</style>
