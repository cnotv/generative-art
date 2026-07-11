<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useMarbleEditor } from './useMarbleEditor'
import EditorPalette from './EditorPalette.vue'

const canvas = ref<HTMLCanvasElement | null>(null)

const editor = useMarbleEditor({ canvas })

onMounted(() => {
  editor.init()
})
</script>

<template>
  <div class="marble-editor">
    <canvas ref="canvas" class="marble-editor__canvas"></canvas>
    <EditorPalette
      class="marble-editor__palette"
      :selected-piece="editor.selectedPiece.value"
      :saved-maps="editor.savedMaps.value"
      :map-name="editor.currentMap.value.name"
      @add="editor.addPiece"
      @preview="editor.previewPiece"
      @recolor="editor.recolorSelectedPiece"
      @delete-piece="editor.removeSelectedPiece"
      @save-as="editor.saveMapAsName"
      @load-map="editor.loadMap"
      @delete-map="editor.deleteMapByName"
      @new-map="editor.startNewMap"
    />
  </div>
</template>

<style scoped>
.marble-editor {
  position: relative;
  width: 100%;
  height: 100vh;
  padding-top: var(--nav-height);
  overflow: hidden;
}

.marble-editor__canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.marble-editor__palette {
  position: absolute;
  top: calc(var(--nav-height) + var(--spacing-4));
  left: var(--spacing-4);
  max-height: calc(100vh - var(--nav-height) - 2 * var(--spacing-4));
}
</style>
