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
    <div class="camera-panel flex flex-col h-full">

      <div class="camera-panel__content flex-1 p-4 overflow-y-auto flex flex-col gap-2">
        <div v-if="cameraSchema">
          <SchemaControls
            :schema="cameraSchema"
            :get-value="viewConfig.getSceneConfigValue"
            :on-update="viewConfig.updateSceneConfig"
          />
        </div>

        <div class="camera-panel__recording">
          <RecordingControls
            :is-recording="isRecording"
            :min-duration-ms="minDurationMs"
            :max-duration-ms="maxDurationMs"
            @start="handleStart"
            @stop="handleStop"
          />
        </div>
      </div>
    </div>
  </GenericPanel>
</template>

<style scoped>
.camera-panel__content {
  min-height: 0;
}
</style>
