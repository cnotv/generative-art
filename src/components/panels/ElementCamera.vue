<script setup lang="ts">
import { computed } from 'vue';
import SchemaControls from './ConfigControls.vue';
import RecordingControls from '@/components/RecordingControls.vue';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { CameraPreset, cameraPresets } from '@webgamekit/threejs';
import { useCameraConfigStore } from '@/stores/cameraConfig';
import { useElementPropertiesStore } from '@/stores/elementProperties';
import { storeToRefs } from 'pinia';

interface Properties {
  isRecording?: boolean;
  minDurationMs?: number;
  maxDurationMs?: number;
}

defineProps<Properties>();

const emit = defineEmits<{
  start: [durationMs: number];
  stop: [];
}>();

const cameraConfigStore = useCameraConfigStore();
const { activeSlot } = storeToRefs(cameraConfigStore);
const { applyPresetToActiveSlot } = cameraConfigStore;

const elementPropertiesStore = useElementPropertiesStore();
const { activeProperties } = storeToRefs(elementPropertiesStore);

const hasExpandedSchema = computed(
  () => Object.keys(activeProperties.value?.schema ?? {}).length > 0
);

const presetLabels: Record<CameraPreset, string> = {
  [CameraPreset.Perspective]: 'Perspective',
  [CameraPreset.Fisheye]: 'Fisheye',
  [CameraPreset.Cinematic]: 'Cinematic',
  [CameraPreset.Orbit]: 'Orbit',
  [CameraPreset.Orthographic]: 'Orthographic',
  [CameraPreset.OrthographicFollowing]: 'Ortho Follow',
  [CameraPreset.TopDown]: 'Top Down',
};

const activePresetType = computed<'perspective' | 'orthographic'>(() =>
  activeSlot.value ? cameraPresets[activeSlot.value.preset].type : 'perspective'
);

const perspectivePresets = computed(() =>
  (Object.entries(presetLabels) as [CameraPreset, string][]).filter(
    ([preset]) => cameraPresets[preset].type === 'perspective'
  )
);

const orthographicPresets = computed(() =>
  (Object.entries(presetLabels) as [CameraPreset, string][]).filter(
    ([preset]) => cameraPresets[preset].type === 'orthographic'
  )
);

const filteredPresets = computed(() =>
  activePresetType.value === 'perspective'
    ? perspectivePresets.value
    : orthographicPresets.value
);

const handleTypeToggle = (type: 'perspective' | 'orthographic') => {
  const presets =
    type === 'perspective' ? perspectivePresets.value : orthographicPresets.value;
  if (presets.length > 0) applyPresetToActiveSlot(presets[0][0]);
};
</script>

<template>
  <Accordion type="multiple" :default-value="['presets', 'properties', 'recording']">
    <AccordionItem value="presets">
      <AccordionTrigger>Presets</AccordionTrigger>
      <AccordionContent>
        <div class="element-camera__type-toggle">
          <Button
            :variant="activePresetType === 'perspective' ? 'default' : 'outline'"
            size="sm"
            class="w-full text-xs"
            @click="handleTypeToggle('perspective')"
            >Perspective</Button
          >
          <Button
            :variant="activePresetType === 'orthographic' ? 'default' : 'outline'"
            size="sm"
            class="w-full text-xs"
            @click="handleTypeToggle('orthographic')"
            >Orthographic</Button
          >
        </div>
        <div class="element-camera__preset-grid">
          <Button
            v-for="[preset, label] in filteredPresets"
            :key="preset"
            :variant="activeSlot?.preset === preset ? 'default' : 'outline'"
            size="sm"
            class="text-xs"
            @click="applyPresetToActiveSlot(preset)"
            >{{ label }}</Button
          >
        </div>
      </AccordionContent>
    </AccordionItem>
    <AccordionItem v-if="hasExpandedSchema" value="properties">
      <AccordionTrigger>Properties</AccordionTrigger>
      <AccordionContent>
        <SchemaControls
          :schema="activeProperties!.schema"
          :get-value="activeProperties!.getValue"
          :on-update="activeProperties!.updateValue"
        />
      </AccordionContent>
    </AccordionItem>
    <AccordionItem value="recording">
      <AccordionTrigger>Recording</AccordionTrigger>
      <AccordionContent>
        <RecordingControls
          :is-recording="isRecording"
          :min-duration-ms="minDurationMs"
          :max-duration-ms="maxDurationMs"
          @start="(ms: number) => emit('start', ms)"
          @stop="emit('stop')"
        />
      </AccordionContent>
    </AccordionItem>
  </Accordion>
</template>

<style scoped>
.element-camera__type-toggle {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-1);
  margin-bottom: var(--spacing-1);
}

.element-camera__preset-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-1);
}
</style>
