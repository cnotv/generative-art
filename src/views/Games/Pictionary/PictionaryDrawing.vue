<script setup lang="ts">
import { ref } from 'vue'
import type { StrokeEvent } from '@webgamekit/canvas-editor'
import { CanvasEditor } from '@/components/CanvasEditor'

defineProps<{
  isDrawer: boolean
  word: string | null
  maskedWord: string
  roundNumber: number
  totalRounds: number
  timeLeft: number
}>()

const emit = defineEmits<{
  stroke: [event: StrokeEvent]
  clear: []
}>()

const canvasEditorReference = ref<InstanceType<typeof CanvasEditor> | null>(null)

defineExpose({
  renderSegment: (payload: StrokeEvent) => canvasEditorReference.value?.renderSegment(payload),
  silentClear: () => canvasEditorReference.value?.silentClear()
})
</script>

<template>
  <section class="pictionary-drawing">
    <div class="pictionary-drawing__word-banner">
      <span class="pictionary-drawing__banner-label">
        {{ isDrawer ? '🖍 Draw this' : '🔍 Guess this' }}
      </span>
      <span
        class="pictionary-drawing__banner-word"
        :class="{ 'pictionary-drawing__banner-word--masked': !isDrawer }"
      >
        {{ isDrawer ? word : maskedWord }}
      </span>
      <span class="pictionary-drawing__banner-meta">
        Round {{ roundNumber }} / {{ totalRounds }} · ⏱ {{ timeLeft }}s
      </span>
    </div>
    <CanvasEditor
      ref="canvasEditorReference"
      :interactive="isDrawer"
      :show-tools="isDrawer"
      :canvas-width="600"
      :canvas-height="400"
      disable-storage
      @stroke="emit('stroke', $event)"
      @clear="emit('clear')"
    />
  </section>
</template>

<style scoped>
.pictionary-drawing {
  grid-area: main;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  justify-content: space-between;
  align-items: stretch;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

.pictionary-drawing :deep(.canvas-editor) {
  max-height: 100%;
}

.pictionary-drawing :deep(.canvas-editor-canvas) {
  border: 3px solid #111;
  border-radius: 1.25rem;
  box-shadow: 3px 3px 0 #111;
}

.pictionary-drawing :deep(.btn) {
  border-radius: 999px;
}

.pictionary-drawing :deep(.color-picker__swatch) {
  border-radius: 50%;
}

.pictionary-drawing__word-banner {
  box-sizing: border-box;
  width: 100%;
  max-width: min(600px, 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-1);
  padding: var(--spacing-3) var(--spacing-4, 1rem);
  border: 4px dashed #111;
  border-radius: 1.25rem;
  background: linear-gradient(135deg, var(--pic-yellow), var(--pic-orange));
  box-shadow: 5px 5px 0 #111;
  text-align: center;
  z-index: 3;
}

.pictionary-drawing__banner-label {
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: #111;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.pictionary-drawing__banner-word {
  max-width: 100%;
  font-size: clamp(1.25rem, 4vw, 2.5rem);
  font-weight: 900;
  letter-spacing: 0.1em;
  color: #111;
  text-transform: uppercase;
  text-shadow: 2px 2px 0 #fff;
  word-break: break-word;
  overflow-wrap: anywhere;
  line-height: 1.15;
}

.pictionary-drawing__banner-word--masked {
  font-family: var(--font-mono);
  color: #333;
}

.pictionary-drawing__banner-meta {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: #111;
  opacity: 0.8;
}

@media (max-width: 720px) {
  .pictionary-drawing {
    gap: var(--spacing-1);
    min-height: 0;
  }

  .pictionary-drawing__word-banner {
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: center;
    padding: var(--spacing-2) var(--spacing-3);
  }
}
</style>
