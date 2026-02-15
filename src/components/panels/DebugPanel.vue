<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { Sheet } from '@/components/ui/sheet';
import { usePanels } from '@/composables/usePanels';
import { Box, Lightbulb, Sun, Mountain, Image } from 'lucide-vue-next';
import IconPreview from '@/components/IconPreview.vue';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';

interface SceneElement {
  name: string;
  type: string;
}

interface Props {
  sceneElements?: SceneElement[];
}

const props = withDefaults(defineProps<Props>(), {
  sceneElements: () => [],
});

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

// Get icon component based on element type or name
const getElementIcon = (element: SceneElement) => {
  const name = element.name.toLowerCase();
  const type = element.type.toLowerCase();

  if (name.includes('light')) return Lightbulb;
  if (name.includes('sky')) return Sun;
  if (name.includes('ground')) return Mountain;
  if (type.includes('mesh')) return Box;
  if (name.includes('wireframe')) return Box;

  return Image;
};

// Get color class based on element type
const getElementColor = (element: SceneElement) => {
  const name = element.name.toLowerCase();

  if (name.includes('light')) return 'text-yellow-400';
  if (name.includes('sky')) return 'text-blue-400';
  if (name.includes('ground')) return 'text-green-600';
  if (name.includes('wireframe')) return 'text-green-400';

  return 'text-gray-400';
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
      <div class="debug-panel__content flex flex-col gap-4 h-full">
        <div class="debug-panel__header p-4 border-b border-white/10">
          <h2 class="text-lg font-semibold text-white">Debug</h2>
        </div>

        <div class="flex-1 overflow-y-auto px-4">
          <Accordion type="multiple" :default-value="['stats', 'scene']" class="w-full">
            <!-- Stats Section -->
            <AccordionItem value="stats">
              <AccordionTrigger class="text-sm font-medium py-2">
                Performance Stats
              </AccordionTrigger>
              <AccordionContent>
                <div class="debug-panel__stats grid gap-3 pb-2">
                  <div class="debug-panel__stat flex justify-between rounded bg-secondary p-2.5">
                    <span class="text-xs font-medium">FPS</span>
                    <span class="font-mono text-xs">{{ fps }}</span>
                  </div>

                  <div class="debug-panel__stat flex justify-between rounded bg-secondary p-2.5">
                    <span class="text-xs font-medium">Memory (MB)</span>
                    <span class="font-mono text-xs">{{ memory }}</span>
                  </div>

                  <div class="debug-panel__stat flex justify-between rounded bg-secondary p-2.5">
                    <span class="text-xs font-medium">Draw Calls</span>
                    <span class="font-mono text-xs">{{ drawCalls }}</span>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <!-- Scene Elements Section -->
            <AccordionItem value="scene" v-if="sceneElements && sceneElements.length > 0">
              <AccordionTrigger class="text-sm font-medium py-2">
                Scene Elements ({{ sceneElements.length }})
              </AccordionTrigger>
              <AccordionContent>
                <div class="scene-elements flex flex-col gap-2 pb-2">
                  <div
                    v-for="(element, index) in sceneElements"
                    :key="index"
                    class="element-item flex items-center gap-4 p-3 rounded-lg border border-white/10 bg-white/5 transition-colors"
                  >
                    <IconPreview
                      :icon="getElementIcon(element)"
                      :color="getElementColor(element)"
                    />
                    <div class="element-info flex-1 min-w-0">
                      <span class="text-xs text-white/90 font-mono truncate block">
                        {{ element.name }}
                      </span>
                      <span class="text-[10px] text-muted-foreground block mt-0.5">
                        {{ element.type }}
                      </span>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div class="debug-panel__additional mt-4">
            <slot />
          </div>
        </div>
      </div>
    </Sheet>
</template>

<style scoped>
/* No additional styles needed - using TexturesPanel structure */
</style>
