<script setup lang="ts">
import GenericPanel from './GenericPanel.vue';
import RecordingControls from '@/components/RecordingControls.vue';
import SchemaControls from './ConfigControls.vue';
import { computed } from 'vue';
import { useViewConfig } from '@/composables/useViewConfig';

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

const viewConfig = useViewConfig();

const cameraSchema = computed(() => {
  const schema = viewConfig.currentSceneSchema.value;
  if (!schema?.camera) return null;
  return { camera: schema.camera };
});

const handleStart = (durationMs: number) => {
  emit('start', durationMs);
};

const handleStop = () => {
  emit('stop');
};
</script>

<template>
  <GenericPanel panel-type="camera" side="right">
    <SchemaControls
      v-if="cameraSchema"
      :schema="cameraSchema"
      :get-value="viewConfig.getSceneConfigValue"
      :on-update="viewConfig.updateSceneConfig"
    />
    <RecordingControls
      :is-recording="isRecording"
      :min-duration-ms="minDurationMs"
      :max-duration-ms="maxDurationMs"
      @start="handleStart"
      @stop="handleStop"
    />
  </GenericPanel>
</template>
