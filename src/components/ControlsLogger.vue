<script setup lang="ts">
defineProps<{
  logs: string[];
}>();
</script>

<template>
  <div class="controls-logger">
    <slot></slot>
    <div v-for="(log, i) in logs" :key="i">{{ log }}</div>
  </div>
</template>

<style scoped>
.controls-logger {
  position: relative;
  display: flex;
  flex-direction: column;
  align-self: center;
  font-size: 24px;
  line-height: 1.2em;
  margin: 1rem;
}

@media (max-width: 600px) {
  .controls-logger {
    line-height: 0.2em;
  }
}
</style>
