<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { STRUDEL_DRAW_CANVAS_ID, STRUDEL_EDITOR_ARIA_LABEL } from './config'
import type { StrudelCodeMirror, StrudelEditorHandle } from './types'

const props = defineProps<{
  code: string
}>()

const emit = defineEmits<{
  'update:code': [patternCode: string]
  evaluate: []
  stop: []
  ready: [editorHandle: StrudelEditorHandle | null]
}>()

const editorHost = ref<HTMLElement | null>(null)
const visualsCanvas = ref<HTMLCanvasElement | null>(null)
const codeMirror = ref<StrudelCodeMirror | null>(null)
let isUnmounted = false
let canvasResizeObserver: ResizeObserver | null = null

const fitCanvasToEditor = (canvas: HTMLCanvasElement): void => {
  const pixelWidth = Math.round(canvas.clientWidth * window.devicePixelRatio)
  const pixelHeight = Math.round(canvas.clientHeight * window.devicePixelRatio)
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth
    canvas.height = pixelHeight
  }
}

const getDrawContext = (): CanvasRenderingContext2D | null => {
  if (visualsCanvas.value === null) {
    return null
  }
  fitCanvasToEditor(visualsCanvas.value)
  return visualsCanvas.value.getContext('2d')
}

const clearVisuals = (): void => {
  const drawContext = getDrawContext()
  drawContext?.clearRect(0, 0, drawContext.canvas.width, drawContext.canvas.height)
}

onMounted(async () => {
  if (visualsCanvas.value !== null && typeof ResizeObserver !== 'undefined') {
    const canvas = visualsCanvas.value
    canvasResizeObserver = new ResizeObserver(() => fitCanvasToEditor(canvas))
    canvasResizeObserver.observe(canvas)
  }
  // CodeMirror and the Strudel editor extensions stay out of the view chunk until needed.
  const { createStrudelCodeMirror } = await import('./codeEditor/createStrudelCodeMirror')
  if (isUnmounted || editorHost.value === null) {
    return
  }
  const createdEditor = createStrudelCodeMirror({
    parent: editorHost.value,
    initialCode: props.code,
    ariaLabel: STRUDEL_EDITOR_ARIA_LABEL,
    onCodeChange: (patternCode) => emit('update:code', patternCode),
    onEvaluate: () => emit('evaluate'),
    onStop: () => emit('stop')
  })
  codeMirror.value = createdEditor
  emit('ready', {
    applyEvaluation: createdEditor.applyEvaluation,
    highlight: createdEditor.highlight,
    clearHighlights: createdEditor.clearHighlights,
    getDrawContext,
    clearVisuals
  })
})

watch(
  () => props.code,
  (patternCode) => codeMirror.value?.setCode(patternCode)
)

onUnmounted(() => {
  isUnmounted = true
  canvasResizeObserver?.disconnect()
  emit('ready', null)
  codeMirror.value?.destroy()
})
</script>

<template>
  <div ref="editorHost" class="strudel-code-editor">
    <canvas
      :id="STRUDEL_DRAW_CANVAS_ID"
      ref="visualsCanvas"
      class="strudel-code-editor__visuals"
      aria-hidden="true"
    />
  </div>
</template>

<style scoped>
/*
 * --background comes from the strudel.cc theme, set on this element by the editor itself.
 * The editor's own background is transparent, so the visuals canvas shows behind the code.
 */
.strudel-code-editor {
  position: relative;
  display: grid;
  grid-template-rows: minmax(0, 1fr);
  grid-template-columns: minmax(0, 1fr);
  min-height: 14rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--background);
}

.strudel-code-editor__visuals {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
</style>
