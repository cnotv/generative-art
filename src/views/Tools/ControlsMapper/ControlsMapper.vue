<script setup lang="ts">
import ControlsMapper from '@/components/ControlsMapper/ControlsMapper.vue'
</script>

<template>
  <main class="controls-mapper-view">
    <header class="controls-mapper-view__header">
      <h1 class="controls-mapper-view__title">Controls Mapper</h1>
      <p class="controls-mapper-view__subtitle">
        Remap keyboard, gamepad and faux-pad controls, style the on-screen widget, save presets, and
        test them live.
      </p>
    </header>
    <ControlsMapper />
  </main>
</template>

<style scoped>
.controls-mapper-view {
  padding: calc(var(--nav-height) + var(--spacing-4)) var(--spacing-4) var(--spacing-4);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
}

.controls-mapper-view__header {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.controls-mapper-view__title {
  margin: 0;
  font-size: var(--font-size-xl);
}

.controls-mapper-view__subtitle {
  margin: 0;
  color: var(--color-muted-foreground);
}
</style>
