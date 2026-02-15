<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useViewConfig } from '@/composables/useViewConfig';
import GenericPanel from './GenericPanel.vue';
import ConfigControls from './ConfigControls.vue';
import DebugStats from '@/components/DebugStats.vue';
import RecordingControls from '@/components/RecordingControls.vue';
import { Settings } from 'lucide-vue-next';
import type { DebugStat } from '@/components/DebugStats.vue';

const route = useRoute();
const router = useRouter();
const viewConfig = useViewConfig();

// Config tab
const configSchema = () => viewConfig.currentSchema.value;
const sceneSchema = () => viewConfig.currentSceneSchema.value;
const configGetValue = (path: string) => viewConfig.getConfigValue(path);
const sceneGetValue = (path: string) => viewConfig.getSceneConfigValue(path);
const configOnUpdate = (path: string, value: any) => {
  viewConfig.updateConfig(path, value);
};
const sceneOnUpdate = (path: string, value: any) => {
  viewConfig.updateSceneConfig(path, value);
};

// Debug tab - custom stats can be passed to DebugStats component
const customDebugStats = ref<DebugStat[]>([
  { label: 'Draw Calls', value: 0 },
]);

// Recording tab - uses route.query.record
const isRecording = computed(() => !!route.query.record);

const handleStartRecording = (durationMs: number) => {
  // Calculate total frames at 30fps
  const fps = 30;
  const durationSeconds = durationMs / 1000;
  const totalFrames = Math.floor(durationSeconds * fps);

  console.log('[ToolsPanel] Starting recording for', durationMs, 'ms (', totalFrames, 'frames)');

  // Set route query to trigger recording via video.ts
  router.push({
    query: { ...route.query, record: String(totalFrames) }
  });
};

const handleStopRecording = () => {
  console.log('[ToolsPanel] Stopping recording');

  // Remove record query parameter to stop recording
  const query = { ...route.query };
  delete query.record;
  router.push({ query });
};

// Define tabs programmatically
const tabs = computed(() => {
  const availableTabs = [];

  if (configSchema() !== null) {
    availableTabs.push({
      value: 'config',
      label: 'Config',
      schema: configSchema()!,
      getValue: configGetValue,
      onUpdate: configOnUpdate,
    });
  }

  if (sceneSchema() !== null) {
    availableTabs.push({
      value: 'scene',
      label: 'Scene',
      schema: sceneSchema()!,
      getValue: sceneGetValue,
      onUpdate: sceneOnUpdate,
    });
  }

  availableTabs.push({
    value: 'debug',
    label: 'Debug',
  });

  availableTabs.push({
    value: 'recording',
    label: 'Record',
  });

  return availableTabs;
});
</script>

<template>
  <GenericPanel
    panel-type="config"
    side="right"
    :icon="Settings"
    trigger-class="right-4 top-4"
  >
    <div class="tools-panel__content flex flex-col h-full">
      <Tabs :default-value="tabs[0]?.value" class="flex-1 flex flex-col min-h-0">
        <TabsList>
          <TabsTrigger v-for="tab in tabs" :key="tab.value" :value="tab.value">
            {{ tab.label }}
          </TabsTrigger>
        </TabsList>

        <TabsContent
          v-for="tab in tabs.filter(t => t.value === 'config' || t.value === 'scene')"
          :key="tab.value"
          :value="tab.value"
        >
          <ConfigControls
            :schema="tab.schema!"
            :get-value="tab.getValue!"
            :on-update="tab.onUpdate!"
          />
        </TabsContent>

        <TabsContent value="debug">
          <DebugStats :stats="customDebugStats" />
        </TabsContent>

        <TabsContent value="recording">
          <RecordingControls
            :is-recording="isRecording"
            @start="handleStartRecording"
            @stop="handleStopRecording"
          />
        </TabsContent>
      </Tabs>
    </div>
  </GenericPanel>
</template>

<style scoped>
.tools-panel__content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
</style>
