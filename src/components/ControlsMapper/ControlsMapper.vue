<script setup lang="ts">
import { onMounted, onUnmounted, watch, ref } from 'vue'
import { createControls } from '@webgamekit/controls'
import type { ControlsExtras } from '@webgamekit/controls'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useControlsMapperStore } from '@/stores/controlsMapper'
import ControlsMapperBindings from './ControlsMapperBindings.vue'
import ControlsMapperStyle from './ControlsMapperStyle.vue'
import ControlsMapperPresets from './ControlsMapperPresets.vue'
import ControlsMapperTester from './ControlsMapperTester.vue'

const store = useControlsMapperStore()

const activeTab = ref<'bindings' | 'test'>('bindings')

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
  <Tabs v-model="activeTab" class="controls-mapper">
    <TabsList>
      <TabsTrigger value="bindings">Bindings</TabsTrigger>
      <TabsTrigger value="test">Test</TabsTrigger>
    </TabsList>

    <TabsContent value="bindings" class="controls-mapper__panel">
      <div class="controls-mapper__toolbar">
        <ControlsMapperPresets />
        <Button
          variant="outline"
          title="Reset the mapping and skin to their defaults"
          @click="store.resetToDefaults()"
        >
          Reset
        </Button>
      </div>
      <ControlsMapperBindings />
    </TabsContent>

    <TabsContent value="test" class="controls-mapper__panel">
      <ControlsMapperStyle />
      <ControlsMapperTester />
    </TabsContent>
  </Tabs>
</template>

<style scoped>
.controls-mapper {
  width: 100%;
  font-size: var(--font-size-md);
}

.controls-mapper__panel {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
}

.controls-mapper__toolbar {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  flex-wrap: wrap;
}
</style>
