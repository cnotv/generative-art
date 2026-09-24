import { ref } from 'vue'
import type { Ref } from 'vue'
import {
  drawingStroke,
  drawingDot,
  drawingFill,
  drawingClear,
  drawingRestore
} from '@webgamekit/canvas-editor'
import type {
  DrawingOptions,
  DrawingPoint,
  StrokeEvent,
  FillEvent
} from '@webgamekit/canvas-editor'
import { useEditorHistory } from '@/composables/useEditorHistory'

const getCanvasPoint = (
  event: MouseEvent | Touch,
  canvasReference: Ref<HTMLCanvasElement | null>
): DrawingPoint => {
  const canvas = canvasReference.value!
  const rect = canvas.getBoundingClientRect()
  return {
    x: (event.clientX - rect.left) * (canvas.width / rect.width),
    y: (event.clientY - rect.top) * (canvas.height / rect.height)
  }
}

type EditorContext = {
  canvasReference: Ref<HTMLCanvasElement | null>
  options: Ref<DrawingOptions>
  isDrawing: Ref<boolean>
  lastPoint: Ref<DrawingPoint>
  record: (label: string) => void
  onUpdate: () => void
  onStrokeCallback?: (event: StrokeEvent) => void
  onFillCallback?: (event: FillEvent) => void
}

const getContext = (ctx: EditorContext): CanvasRenderingContext2D | null =>
  ctx.canvasReference.value?.getContext('2d') ?? null

const startDrawing = (ctx: EditorContext, point: DrawingPoint): void => {
  ctx.isDrawing.value = true
  ctx.lastPoint.value = point
  const renderContext = getContext(ctx)
  if (!renderContext) return
  if (ctx.options.value.tool === 'fill') {
    drawingFill(renderContext, point, ctx.options.value.color)
    ctx.onFillCallback?.({ point, color: ctx.options.value.color })
    ctx.record('Filled')
    ctx.onUpdate()
    ctx.isDrawing.value = false
    return
  }
  drawingDot(renderContext, point, ctx.options.value)
}

const continueDrawing = (ctx: EditorContext, point: DrawingPoint): void => {
  if (!ctx.isDrawing.value) return
  const renderContext = getContext(ctx)
  if (!renderContext) return
  const from = { ...ctx.lastPoint.value }
  drawingStroke(renderContext, from, point, ctx.options.value)
  ctx.onStrokeCallback?.({ from, to: point, options: { ...ctx.options.value } })
  ctx.lastPoint.value = point
}

const finishDrawing = (ctx: EditorContext): void => {
  if (!ctx.isDrawing.value) return
  ctx.isDrawing.value = false
  ctx.record(ctx.options.value.tool === 'eraser' ? 'Erased' : 'Drew')
  ctx.onUpdate()
}

/**
 * Composable managing drawing operations and undo/redo history for a single canvas.
 * @param canvasReference - Ref to the HTMLCanvasElement
 * @param options - Reactive drawing options (tool, color, size)
 * @param onUpdate - Callback fired after any operation that changes the canvas
 * @param onStrokeCallback - Optional callback fired per stroke segment
 * @param onFillCallback - Optional callback fired when a fill is applied
 */
export const useCanvasEditor = (
  canvasReference: Ref<HTMLCanvasElement | null>,
  options: Ref<DrawingOptions>,
  onUpdate: () => void,
  onStrokeCallback?: (event: StrokeEvent) => void,
  onFillCallback?: (event: FillEvent) => void
) => {
  const snapshot = (): string => canvasReference.value?.toDataURL() ?? ''
  const history = useEditorHistory<string>('Opened', snapshot(), async (dataUrl) => {
    const renderContext = canvasReference.value?.getContext('2d')
    if (!renderContext) return
    if (dataUrl) await drawingRestore(renderContext, dataUrl)
    else drawingClear(renderContext)
    onUpdate()
  })
  const record = (label: string): void => history.record(label, snapshot())
  const ctx: EditorContext = {
    canvasReference,
    options,
    isDrawing: ref(false),
    lastPoint: ref({ x: 0, y: 0 }),
    record,
    onUpdate,
    onStrokeCallback,
    onFillCallback
  }

  const renderSegment = (event: StrokeEvent): void => {
    const renderContext = getContext(ctx)
    if (!renderContext) return
    drawingStroke(renderContext, event.from, event.to, event.options)
  }

  const renderFill = (event: FillEvent): void => {
    const renderContext = getContext(ctx)
    if (!renderContext) return
    drawingFill(renderContext, event.point, event.color)
  }

  const silentRestore = async (dataUrl: string): Promise<void> => {
    const renderContext = getContext(ctx)
    if (!renderContext) return
    await drawingRestore(renderContext, dataUrl)
  }

  const clear = (): void => {
    const renderContext = getContext(ctx)
    if (!renderContext) return
    drawingClear(renderContext)
    record('Cleared')
    onUpdate()
  }

  const silentClear = (): void => {
    const renderContext = getContext(ctx)
    if (!renderContext) return
    drawingClear(renderContext)
  }

  const restore = async (dataUrl: string, restoreOptions?: { silent?: boolean }): Promise<void> => {
    const renderContext = getContext(ctx)
    if (!renderContext) return
    await drawingRestore(renderContext, dataUrl)
    record('Loaded image')
    if (!restoreOptions?.silent) onUpdate()
  }

  return {
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    historyLog: history.log,
    snapshot,
    renderSegment,
    renderFill,
    silentRestore,
    onPointerDown: (event: MouseEvent): void =>
      startDrawing(ctx, getCanvasPoint(event, canvasReference)),
    onPointerMove: (event: MouseEvent): void =>
      continueDrawing(ctx, getCanvasPoint(event, canvasReference)),
    onPointerUp: (): void => finishDrawing(ctx),
    onTouchStart: (event: TouchEvent): void =>
      startDrawing(ctx, getCanvasPoint(event.touches[0], canvasReference)),
    onTouchMove: (event: TouchEvent): void =>
      continueDrawing(ctx, getCanvasPoint(event.touches[0], canvasReference)),
    onTouchEnd: (): void => finishDrawing(ctx),
    undo: history.undo,
    redo: history.redo,
    clear,
    silentClear,
    restore
  }
}
