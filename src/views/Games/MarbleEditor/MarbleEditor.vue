<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useMarbleEditor } from './useMarbleEditor'
import { useMarbleRace } from './useMarbleRace'
import EditorPalette from './EditorPalette.vue'
import { DEFAULT_MARBLE } from '../MarbleMadness/config'
import type { CameraMode } from './types'

const CAMERA_MODES: { value: CameraMode; label: string; tooltip: string }[] = [
  { value: 'third', label: 'Third', tooltip: 'Follow the marble from behind (press C to cycle)' },
  { value: 'first', label: 'First', tooltip: 'View from the marble (press C to cycle)' },
  { value: 'free', label: 'Free', tooltip: 'Free orbit camera (press C to cycle)' }
]

const editorCanvas = ref<HTMLCanvasElement | null>(null)
const raceCanvas = ref<HTMLCanvasElement | null>(null)
const phase = ref<'edit' | 'race'>('edit')

const editor = useMarbleEditor({ canvas: editorCanvas })

const marbleTexture = ref<string | undefined>(DEFAULT_MARBLE.url)

const race = useMarbleRace({
  canvas: raceCanvas,
  map: editor.currentMap,
  marbleTexture,
  onFinish: () => {}
})

const formattedTime = computed(() => {
  const total = race.elapsed.value
  const minutes = Math.floor(total / 60)
  const seconds = (total % 60).toFixed(1).padStart(4, '0')
  return `${minutes}:${seconds}`
})

const startRace = async (): Promise<void> => {
  editor.destroy()
  phase.value = 'race'
  await nextTick()
  await race.init()
}

const backToEditor = async (): Promise<void> => {
  race.destroy()
  phase.value = 'edit'
  await nextTick()
  await editor.init()
}

const restartRace = async (): Promise<void> => {
  race.destroy()
  await nextTick()
  await race.init()
}

onMounted(() => {
  editor.init()
})
</script>

<template>
  <div class="marble-editor">
    <template v-if="phase === 'edit'">
      <canvas ref="editorCanvas" class="marble-editor__canvas"></canvas>
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
        @play="startRace"
      />
    </template>

    <template v-else>
      <canvas ref="raceCanvas" class="marble-editor__canvas"></canvas>
      <div class="marble-editor__hud">
        <span class="marble-editor__timer">{{ formattedTime }}</span>
        <span v-if="race.penaltyCount.value > 0" class="marble-editor__penalties">
          Falls: {{ race.penaltyCount.value }}
        </span>
        <div class="marble-editor__camera-group" role="group" aria-label="Camera mode">
          <button
            v-for="mode in CAMERA_MODES"
            :key="mode.value"
            class="marble-editor__hud-button"
            :class="{
              'marble-editor__hud-button--active': race.cameraMode.value === mode.value
            }"
            :title="mode.tooltip"
            @click="race.setCameraMode(mode.value)"
          >
            {{ mode.label }}
          </button>
        </div>
        <button
          class="marble-editor__hud-button"
          title="Return to the track editor"
          @click="backToEditor"
        >
          Back to editor
        </button>
      </div>
      <div v-if="race.finished.value" class="marble-editor__overlay">
        <h2 class="marble-editor__overlay-title">Finished</h2>
        <p class="marble-editor__overlay-time">{{ formattedTime }}</p>
        <div class="marble-editor__overlay-actions">
          <button
            class="marble-editor__hud-button"
            title="Race the track again"
            @click="restartRace"
          >
            Race again
          </button>
          <button
            class="marble-editor__hud-button"
            title="Return to the track editor"
            @click="backToEditor"
          >
            Back to editor
          </button>
        </div>
      </div>
    </template>
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

.marble-editor__hud {
  position: absolute;
  top: calc(var(--nav-height) + var(--spacing-4));
  left: 50%;
  display: flex;
  gap: var(--spacing-4);
  align-items: center;
  padding: var(--spacing-2) var(--spacing-4);
  color: var(--color-foreground);
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  transform: translateX(-50%);
}

.marble-editor__timer {
  font-size: var(--font-size-lg);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.marble-editor__penalties {
  font-size: var(--font-size-sm);
  color: var(--color-muted-foreground);
}

.marble-editor__hud-button {
  padding: var(--spacing-1) var(--spacing-2);
  font-size: var(--font-size-sm);
  color: var(--color-foreground);
  cursor: pointer;
  background: var(--color-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.marble-editor__hud-button:hover {
  background: var(--color-accent);
}

.marble-editor__hud-button--active {
  color: var(--color-primary-foreground);
  background: var(--color-primary);
}

.marble-editor__camera-group {
  display: flex;
  gap: var(--spacing-1);
}

.marble-editor__overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  align-items: center;
  padding: var(--spacing-6);
  color: var(--color-foreground);
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  transform: translate(-50%, -50%);
}

.marble-editor__overlay-title {
  margin: 0;
  font-size: var(--font-size-xl);
}

.marble-editor__overlay-time {
  margin: 0;
  font-size: var(--font-size-lg);
  font-variant-numeric: tabular-nums;
}

.marble-editor__overlay-actions {
  display: flex;
  gap: var(--spacing-2);
}
</style>
