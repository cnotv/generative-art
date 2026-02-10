<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

export type DebugStat = {
  label: string;
  value: string | number;
};

defineProps<{
  stats?: DebugStat[];
}>();

// Built-in performance stats
const fps = ref(0);
const memory = ref(0);
const drawCalls = ref(0);

let frameCount = 0;
let lastTime = performance.now();
let animationFrameId: number;

const updateStats = () => {
  frameCount++;
  const currentTime = performance.now();
  const delta = currentTime - lastTime;

  // Update FPS every second
  if (delta >= 1000) {
    fps.value = Math.round((frameCount * 1000) / delta);
    frameCount = 0;
    lastTime = currentTime;

    // Update memory if available
    if (performance.memory) {
      memory.value = Math.round(performance.memory.usedJSHeapSize / 1048576);
    }
  }

  animationFrameId = requestAnimationFrame(updateStats);
};

onMounted(() => {
  updateStats();
});

onUnmounted(() => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
});
</script>

<template>
  <div class="debug-stats">
    <!-- Built-in performance stats -->
    <div class="debug-stats__item">
      <span class="debug-stats__label">FPS</span>
      <span class="debug-stats__value">{{ fps }}</span>
    </div>

    <div v-if="memory > 0" class="debug-stats__item">
      <span class="debug-stats__label">Memory (MB)</span>
      <span class="debug-stats__value">{{ memory }}</span>
    </div>

    <!-- Custom stats -->
    <div
      v-for="stat in stats"
      :key="stat.label"
      class="debug-stats__item"
    >
      <span class="debug-stats__label">{{ stat.label }}</span>
      <span class="debug-stats__value">{{ stat.value }}</span>
    </div>
  </div>
</template>

<style scoped>
.debug-stats {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.debug-stats__item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  border-radius: var(--radius-sm, 0.25rem);
  background-color: rgba(0, 0, 0, 0.3);
}

.debug-stats__label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-muted-foreground, #999);
}

.debug-stats__value {
  font-size: 0.75rem;
  font-family: monospace;
  color: var(--color-foreground, #fff);
}
</style>
