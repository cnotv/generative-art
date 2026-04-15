<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { CanvasEditor } from '@/components/CanvasEditor'
import { registerViewConfig, unregisterViewConfig, createReactiveConfig } from '@/stores/viewConfig'
import type { DrawingTool } from '@webgamekit/canvas-editor'

const route = useRoute()

const reactiveConfig = createReactiveConfig({
  tool: 'brush' as DrawingTool,
  color: '#000000',
  size: 4
})

const configControls = {
  tool: {
    select: [
      { value: 'brush', label: 'Brush' },
      { value: 'eraser', label: 'Eraser' },
      { value: 'fill', label: 'Fill' }
    ],
    label: 'Tool'
  },
  color: { color: true, label: 'Color' },
  size: { min: 1, max: 80, step: 1, label: 'Brush Size' }
}

onMounted(() => {
  registerViewConfig(route.name as string, reactiveConfig, configControls)
})

onUnmounted(() => {
  unregisterViewConfig(route.name as string)
})
</script>

<template>
  <div class="canvas-texture-editor">
    <CanvasEditor
      :tool="reactiveConfig.tool"
      :color="reactiveConfig.color"
      :size="reactiveConfig.size"
      class="canvas-texture-editor__editor"
      @update:tool="reactiveConfig.tool = $event"
      @update:color="reactiveConfig.color = $event"
      @update:size="reactiveConfig.size = $event"
    />
  </div>
</template>

<style scoped>
.canvas-texture-editor {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: calc(100vh - var(--nav-height));
  padding: var(--spacing-4);
  padding-top: calc(var(--nav-height) + var(--spacing-4));
  box-sizing: border-box;
  overflow-y: auto;
}

.canvas-texture-editor__editor {
  width: 100%;
  max-width: 600px;
}
</style>
