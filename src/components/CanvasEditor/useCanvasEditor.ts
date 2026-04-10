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
import type { DrawingOptions, DrawingPoint, HistoryStack } from '@webgamekit/canvas-editor'

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

/**
 * Composable managing drawing operations and undo/redo history for a single canvas.
 * @param canvasReference - Ref to the HTMLCanvasElement
 * @param options - Reactive drawing options (tool, color, size)
 * @param onUpdate - Callback fired after any operation that changes the canvas
 */
export const useCanvasEditor = (
  canvasReference: Ref<HTMLCanvasElement | null>,
  options: Ref<DrawingOptions>,
  onUpdate: () => void
) => {
  const isDrawing = ref(false)
  const lastPoint = ref({ x: 0, y: 0 })

  const getContext = (): CanvasRenderingContext2D | null =>
    canvasReference.value?.getContext('2d') ?? null

  const snapshot = (): string => canvasReference.value?.toDataURL() ?? ''

  const history = useHistory(snapshot)

  const startDrawing = (point: DrawingPoint): void => {
    isDrawing.value = true
    lastPoint.value = point
    const ctx = getContext()
    if (!ctx) return

    if (options.value.tool === 'fill') {
      history.push()
      drawingFill(ctx, point, options.value.color)
      onUpdate()
      isDrawing.value = false
      return
    }

    drawingDot(ctx, point, options.value)
  }

  const continueDrawing = (point: DrawingPoint): void => {
    if (!isDrawing.value) return
    const ctx = getContext()
    if (!ctx) return
    drawingStroke(ctx, lastPoint.value, point, options.value)
    lastPoint.value = point
  }

  const finishDrawing = (): void => {
    if (!isDrawing.value) return
    isDrawing.value = false
    history.push()
    onUpdate()
  }

  const onPointerDown = (event: MouseEvent): void =>
    startDrawing(getCanvasPoint(event, canvasReference))

  const onPointerMove = (event: MouseEvent): void =>
    continueDrawing(getCanvasPoint(event, canvasReference))

  const onPointerUp = (): void => finishDrawing()

  const onTouchStart = (event: TouchEvent): void => {
    event.preventDefault()
    startDrawing(getCanvasPoint(event.touches[0], canvasReference))
  }

  const onTouchMove = (event: TouchEvent): void => {
    event.preventDefault()
    continueDrawing(getCanvasPoint(event.touches[0], canvasReference))
  }

  const onTouchEnd = (): void => finishDrawing()

  const undo = async (): Promise<void> => {
    const ctx = getContext()
    if (!ctx) return
    await history.applyUndo(ctx, onUpdate)
  }

  const redo = async (): Promise<void> => {
    const ctx = getContext()
    if (!ctx) return
    await history.applyRedo(ctx, onUpdate)
  }

  const clear = (): void => {
    const ctx = getContext()
    if (!ctx) return
    history.push()
    drawingClear(ctx)
    onUpdate()
  }

  const restore = async (dataUrl: string): Promise<void> => {
    const ctx = getContext()
    if (!ctx) return
    history.push()
    await drawingRestore(ctx, dataUrl)
    onUpdate()
  }

  return {
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    snapshot,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    undo,
    redo,
    clear,
    restore
  }
}
