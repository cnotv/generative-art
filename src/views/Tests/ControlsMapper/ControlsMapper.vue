<script setup lang="ts">
import ControlsMapper from '@/components/ControlsMapper/ControlsMapper.vue'
</script>

<template>
  <main class="controls-mapper-view">
    <div class="controls-mapper-view__backdrop" aria-hidden="true" />
    <div class="controls-mapper-view__stage">
      <ControlsMapper />
    </div>
  </main>
</template>

<style scoped>
.controls-mapper-view {
  position: relative;
  height: 100dvh;
  overflow-y: auto;
  padding: calc(var(--nav-height) + var(--spacing-4)) var(--spacing-4) var(--spacing-6);
  box-sizing: border-box;
}

.controls-mapper-view__backdrop {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background: linear-gradient(160deg, #3a2c6e 0%, #5b3f8f 45%, #7d4fa0 100%);
}

.controls-mapper-view__stage {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: center;
}
</style>
