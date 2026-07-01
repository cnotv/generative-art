<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import { createControls } from '@webgamekit/controls'
import type { ControlsExtras } from '@webgamekit/controls'
import { useControlsMapperStore } from '@/stores/controlsMapper'
import ControlsMapperBindings from './ControlsMapperBindings.vue'
import ControlsMapperStyle from './ControlsMapperStyle.vue'
import ControlsMapperPresets from './ControlsMapperPresets.vue'
import ControlsMapperTester from './ControlsMapperTester.vue'

const store = useControlsMapperStore()

let controls: ControlsExtras | null = null

watch(
  () => store.mapping,
  (mapping) => controls?.setMapping(mapping),
  { deep: true }
)

onMounted(() => {
  controls = createControls({
    mapping: store.mapping,
    onAction: (action, trigger, device) => store.recordAction(action, trigger, device),
    onRelease: (action) => store.recordRelease(action),
    touch: false,
    mouse: false
  })
})

onUnmounted(() => {
  controls?.destroyControls()
  controls = null
})
</script>

<template>
  <div class="controls-mapper">
    <section class="controls-mapper__card">
      <h2 class="controls-mapper__title">Bindings</h2>
      <ControlsMapperBindings />
    </section>

    <section class="controls-mapper__card">
      <h2 class="controls-mapper__title">Style</h2>
      <ControlsMapperStyle />
    </section>

    <section class="controls-mapper__card">
      <h2 class="controls-mapper__title">Presets</h2>
      <ControlsMapperPresets />
    </section>

    <section class="controls-mapper__card">
      <h2 class="controls-mapper__title">Test</h2>
      <ControlsMapperTester />
    </section>
  </div>
</template>

<style scoped>
.controls-mapper {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
  gap: var(--spacing-4);
  width: 100%;
}

.controls-mapper__card {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  padding: var(--spacing-4);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background-color: var(--color-background);
}

.controls-mapper__title {
  margin: 0;
  font-size: var(--font-size-lg);
}
</style>
