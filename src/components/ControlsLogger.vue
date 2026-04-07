<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  logs: string[]
}>()

const expanded = ref(false)
</script>

<template>
  <div class="controls-logger">
    <div class="controls-logger__header">
      <span>{{ logs[0] }}</span>
      <button v-if="logs.length > 1" class="controls-logger__toggle" @click="expanded = !expanded">
        {{ expanded ? '−' : '+' }}
      </button>
    </div>
    <div :class="['controls-logger__body', { 'controls-logger__body--expanded': expanded }]">
      <div v-for="(log, i) in logs.slice(1)" :key="i">{{ log }}</div>
    </div>
    <slot></slot>
  </div>
</template>

<style scoped>
.controls-logger {
  position: relative;
  display: flex;
  flex-direction: column;
  align-self: center;
  font-size: var(--font-size-md);
  line-height: 1.4;
  margin: var(--spacing-4);
  gap: var(--spacing-1);
}

.controls-logger__header {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

.controls-logger__toggle {
  display: none;
  background: none;
  border: none;
  font-size: var(--font-size-md);
  cursor: pointer;
  color: inherit;
  padding: 0 var(--spacing-1);
  line-height: 1;
}

@media (max-width: 600px) {
  .controls-logger__toggle {
    display: inline;
  }

  .controls-logger__body {
    display: none;
  }

  .controls-logger__body--expanded {
    display: block;
  }
}
</style>
