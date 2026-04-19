import { ref } from 'vue'
import type { Ref } from 'vue'
import {
  drawingStroke,
  drawingDot,
  drawingFill,
  drawingClear,
  drawingRestore,
  historyCreate,
  historyPush,
  historyUndo,
  historyRedo,
  historyCanUndo,
  historyCanRedo
} from '@webgamekit/canvas-editor'
import type {
  DrawingOptions,
  DrawingPoint,
  StrokeEvent,
  HistoryStack
} from '@webgamekit/canvas-editor'

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

const useHistory = (getSnapshot: () => string) => {
  const canUndo = ref(false)
  const canRedo = ref(false)
  const stack = ref<HistoryStack>(historyCreate())

  const sync = (): void => {
    canUndo.value = historyCanUndo(stack.value)
    canRedo.value = historyCanRedo(stack.value)
  }

  const push = (): void => {
    stack.value = historyPush(stack.value, getSnapshot())
    sync()
  }

  const applyUndo = async (ctx: CanvasRenderingContext2D, onUpdate: () => void): Promise<void> => {
    const { stack: next, snapshot } = historyUndo(stack.value)
    stack.value = next
    sync()
    if (snapshot) {
      await drawingRestore(ctx, snapshot)
    } else {
      drawingClear(ctx)
    }
    onUpdate()
  }

  const applyRedo = async (ctx: CanvasRenderingContext2D, onUpdate: () => void): Promise<void> => {
    const { stack: next, snapshot } = historyRedo(stack.value)
    stack.value = next
    sync()
    if (snapshot) await drawingRestore(ctx, snapshot)
    onUpdate()
  }

  return { canUndo, canRedo, push, applyUndo, applyRedo }
}

type EditorContext = {
  canvasReference: Ref<HTMLCanvasElement | null>
  options: Ref<DrawingOptions>
  isDrawing: Ref<boolean>
  lastPoint: Ref<DrawingPoint>
  history: ReturnType<typeof useHistory>
  onUpdate: () => void
  onStrokeCallback?: (event: StrokeEvent) => void
}

const getContext = (ctx: EditorContext): CanvasRenderingContext2D | null =>
  ctx.canvasReference.value?.getContext('2d') ?? null

const startDrawing = (ctx: EditorContext, point: DrawingPoint): void => {
  ctx.isDrawing.value = true
  ctx.lastPoint.value = point
  const renderContext = getContext(ctx)
  if (!renderContext) return
  if (ctx.options.value.tool === 'fill') {
    ctx.history.push()
    drawingFill(renderContext, point, ctx.options.value.color)
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
  ctx.history.push()
  ctx.onUpdate()
}

/**
 * Composable managing drawing operations and undo/redo history for a single canvas.
 * @param canvasReference - Ref to the HTMLCanvasElement
 * @param options - Reactive drawing options (tool, color, size)
 * @param onUpdate - Callback fired after any operation that changes the canvas
 * @param onStrokeCallback - Optional callback fired per stroke segment
 */
export const useCanvasEditor = (
  canvasReference: Ref<HTMLCanvasElement | null>,
  options: Ref<DrawingOptions>,
  onUpdate: () => void,
  onStrokeCallback?: (event: StrokeEvent) => void
) => {
  const snapshot = (): string => canvasReference.value?.toDataURL() ?? ''
  const history = useHistory(snapshot)
  const ctx: EditorContext = {
    canvasReference,
    options,
    isDrawing: ref(false),
    lastPoint: ref({ x: 0, y: 0 }),
    history,
    onUpdate,
    onStrokeCallback
  }

  const renderSegment = (event: StrokeEvent): void => {
    const renderContext = getContext(ctx)
    if (!renderContext) return
    drawingStroke(renderContext, event.from, event.to, event.options)
  }

  const undo = async (): Promise<void> => {
    const renderContext = getContext(ctx)
    if (!renderContext) return
    await history.applyUndo(renderContext, onUpdate)
  }

  const redo = async (): Promise<void> => {
    const renderContext = getContext(ctx)
    if (!renderContext) return
    await history.applyRedo(renderContext, onUpdate)
  }

  const clear = (): void => {
    const renderContext = getContext(ctx)
    if (!renderContext) return
    history.push()
    drawingClear(renderContext)
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
    history.push()
    await drawingRestore(renderContext, dataUrl)
    if (!restoreOptions?.silent) onUpdate()
  }

  return {
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    snapshot,
    renderSegment,
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
    undo,
    redo,
    clear,
    silentClear,
    restore
  }
}
