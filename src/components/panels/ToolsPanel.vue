<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { usePanels } from '@/composables/usePanels';
import { useViewConfig } from '@/composables/useViewConfig';
import ConfigControls from './ConfigControls.vue';
import { Settings, Circle, Square } from 'lucide-vue-next';

const { isConfigOpen, togglePanel, closePanel } = usePanels();
const viewConfig = useViewConfig();

// Config tab
const activeSchema = () => viewConfig.currentSchema.value;
const activeGetValue = (path: string) => viewConfig.getConfigValue(path);
const activeOnUpdate = (path: string, value: any) => {
  viewConfig.updateConfig(path, value);
};
const hasActiveConfig = () => activeSchema() !== null;

// Debug tab
const fps = ref(0);
const memory = ref(0);
const drawCalls = ref(0);

let frameCount = 0;
let lastTime = performance.now();
let animationFrameId: number | null = null;

const updateStats = () => {
  frameCount++;
  const currentTime = performance.now();

  if (currentTime - lastTime >= 1000) {
    fps.value = Math.round(frameCount);
    frameCount = 0;
    lastTime = currentTime;

    if ('memory' in performance) {
      const memoryInfo = (performance as Performance & { memory: { usedJSHeapSize: number } }).memory;
      memory.value = Math.round(memoryInfo.usedJSHeapSize / 1048576);
    }
  }

  animationFrameId = requestAnimationFrame(updateStats);
};

// Recording tab
const isRecording = ref(false);
const recordingDuration = ref(10);

const toggleRecording = () => {
  isRecording.value = !isRecording.value;
};

// Panel controls
const handleToggle = () => {
  togglePanel('config');
};

const handleOpenChange = (open: boolean) => {
  if (!open) {
    closePanel();
  }
};

onMounted(() => {
  updateStats();
});

onUnmounted(() => {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
  }
});
</script>

<template>
  <div class="tools-panel">
    <Button
      variant="ghost"
      size="icon"
      class="tools-panel__trigger fixed right-4 top-4 z-40 opacity-0 hover:opacity-100 hover:bg-black/70 transition-opacity"
      @click="handleToggle"
    >
      <Settings class="h-5 w-5 text-white" />
    </Button>

    <Sheet :open="isConfigOpen" side="right" @update:open="handleOpenChange">
      <div class="tools-panel__content flex flex-col h-full">
        <Tabs default-value="config" class="flex-1 flex flex-col min-h-0">
          <TabsList>
            <TabsTrigger value="config">Config</TabsTrigger>
            <TabsTrigger value="debug">Debug</TabsTrigger>
            <TabsTrigger value="recording">Record</TabsTrigger>
          </TabsList>

          <TabsContent value="config">
            <ConfigControls
              v-if="hasActiveConfig() && activeSchema()"
              :schema="activeSchema()!"
              :get-value="activeGetValue"
              :on-update="activeOnUpdate"
            />
            <p v-else class="text-xs text-muted-foreground">
              No configuration available for this view.
            </p>
          </TabsContent>

          <TabsContent value="debug">
            <div class="debug-stats flex flex-col gap-2">
              <div class="debug-stat flex justify-between rounded bg-secondary p-2">
                <span class="text-xs font-medium">FPS</span>
                <span class="font-mono text-xs">{{ fps }}</span>
              </div>
              <div class="debug-stat flex justify-between rounded bg-secondary p-2">
                <span class="text-xs font-medium">Memory (MB)</span>
                <span class="font-mono text-xs">{{ memory }}</span>
              </div>
              <div class="debug-stat flex justify-between rounded bg-secondary p-2">
                <span class="text-xs font-medium">Draw Calls</span>
                <span class="font-mono text-xs">{{ drawCalls }}</span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="recording">
            <div class="recording-controls flex flex-col gap-3">
              <div class="flex items-center gap-2">
                <label for="duration" class="text-xs">Duration (s):</label>
                <input
                  id="duration"
                  v-model.number="recordingDuration"
                  type="number"
                  min="1"
                  max="300"
                  class="w-16 rounded border bg-background px-2 py-1 text-xs"
                />
              </div>
              <Button
                size="sm"
                :class="isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'"
                class="text-white"
                @click="toggleRecording"
              >
                <component :is="isRecording ? Square : Circle" class="mr-2 h-3 w-3" />
                {{ isRecording ? 'Stop' : 'Start' }}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Sheet>
  </div>
</template>

<style scoped>
.tools-panel__content {
  height: 100%;
}
</style>
