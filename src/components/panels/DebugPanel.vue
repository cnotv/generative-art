<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import GenericPanel from './GenericPanel.vue';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';

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
  <GenericPanel panel-type="debug" side="right">
    <Accordion type="multiple" :default-value="['stats']" class="w-full">
      <AccordionItem value="stats">
        <AccordionTrigger class="text-sm font-medium py-2">
          Performance Stats
        </AccordionTrigger>
        <AccordionContent>
          <div class="debug-panel__stats grid gap-1 pb-1">
            <div class="debug-panel__stat flex justify-between rounded bg-secondary p-1">
              <span class="text-xs font-medium">FPS</span>
              <span class="font-mono text-xs">{{ fps }}</span>
            </div>
            <div class="debug-panel__stat flex justify-between rounded bg-secondary p-1">
              <span class="text-xs font-medium">Memory (MB)</span>
              <span class="font-mono text-xs">{{ memory }}</span>
            </div>
            <div class="debug-panel__stat flex justify-between rounded bg-secondary p-1">
              <span class="text-xs font-medium">Draw Calls</span>
              <span class="font-mono text-xs">{{ drawCalls }}</span>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>

    <slot />
  </GenericPanel>
</template>
