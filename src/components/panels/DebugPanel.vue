<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { Sheet } from '@/components/ui/sheet';
import { usePanels } from '@/composables/usePanels';

const { isDebugOpen, closePanel } = usePanels();

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

const handleOpenChange = (open: boolean) => {
  if (!open) {
    closePanel('debug');
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
    <Sheet :open="isDebugOpen" side="right" @update:open="handleOpenChange">
      <div class="debug-panel__content flex flex-col gap-6">
        <h2 class="text-lg font-semibold">Debug Stats</h2>

        <div class="debug-panel__stats grid gap-4">
          <div class="debug-panel__stat flex justify-between rounded bg-secondary p-3">
            <span class="text-sm font-medium">FPS</span>
            <span class="font-mono text-sm">{{ fps }}</span>
          </div>

          <div class="debug-panel__stat flex justify-between rounded bg-secondary p-3">
            <span class="text-sm font-medium">Memory (MB)</span>
            <span class="font-mono text-sm">{{ memory }}</span>
          </div>

          <div class="debug-panel__stat flex justify-between rounded bg-secondary p-3">
            <span class="text-sm font-medium">Draw Calls</span>
            <span class="font-mono text-sm">{{ drawCalls }}</span>
          </div>
        </div>

        <div class="debug-panel__additional mt-4">
          <slot />
        </div>
      </div>
    </Sheet>
</template>

<style scoped>
.debug-panel__content {
  height: 100%;
}
</style>
