import { describe, it, expect, vi, afterEach } from 'vitest'
import { drawingRestore } from './drawing'

const CANVAS_SIZE = 304

type DrawImageCall = {
  offsetX: number
  offsetY: number
  drawWidth: number
  drawHeight: number
}

const makeContext = (width = CANVAS_SIZE, height = CANVAS_SIZE) => {
  const drawImageCalls: DrawImageCall[] = []
  const ctx = {
    canvas: { width, height },
    clearRect: vi.fn(),
    drawImage: vi.fn(
      (_img: unknown, offsetX: number, offsetY: number, drawWidth: number, drawHeight: number) => {
        drawImageCalls.push({ offsetX, offsetY, drawWidth, drawHeight })
      }
    )
  } as unknown as CanvasRenderingContext2D
  return { ctx, drawImageCalls }
}

const makeFakeImage = (naturalWidth: number, naturalHeight: number) => {
  const instance = {
    onload: null as (() => void) | null,
    src: '',
    width: naturalWidth,
    height: naturalHeight
  }
  const ImageStub = function (this: typeof instance) {
    Object.assign(this, instance)
    // trigger onload when src is set
    Object.defineProperty(this, 'src', {
      set(_: string) {
        Promise.resolve().then(() => this.onload?.())
      },
      get() {
        return ''
      }
    })
  }
  return { ImageStub, instance }
}

describe('drawingRestore', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('scales a small image (64×99) to fully cover a 304×304 canvas (object-fit: cover)', async () => {
    const { ctx, drawImageCalls } = makeContext(CANVAS_SIZE, CANVAS_SIZE)
    const { ImageStub, instance } = makeFakeImage(64, 99)
    vi.stubGlobal('Image', ImageStub)

    const promise = drawingRestore(ctx, 'data:image/webp;base64,stickman')
    instance.onload?.()
    await promise

    const expectedScale = Math.max(CANVAS_SIZE / 64, CANVAS_SIZE / 99)
    const expectedW = 64 * expectedScale
    const expectedH = 99 * expectedScale

    const { offsetX, offsetY, drawWidth, drawHeight } = drawImageCalls[0]
    expect(drawWidth).toBeCloseTo(expectedW, 1)
    expect(drawHeight).toBeCloseTo(expectedH, 1)
    expect(offsetX).toBeCloseTo((CANVAS_SIZE - expectedW) / 2, 1)
    expect(offsetY).toBeCloseTo((CANVAS_SIZE - expectedH) / 2, 1)
    expect(Math.min(drawWidth, drawHeight)).toBeGreaterThanOrEqual(CANVAS_SIZE)
  })

  it('does not scale when snapshot already matches canvas size (304×304)', async () => {
    const { ctx, drawImageCalls } = makeContext(CANVAS_SIZE, CANVAS_SIZE)
    const { ImageStub, instance } = makeFakeImage(CANVAS_SIZE, CANVAS_SIZE)
    vi.stubGlobal('Image', ImageStub)

    const promise = drawingRestore(ctx, 'data:image/png;base64,snapshot')
    instance.onload?.()
    await promise

    const { offsetX, offsetY, drawWidth, drawHeight } = drawImageCalls[0]
    expect(drawWidth).toBeCloseTo(CANVAS_SIZE, 1)
    expect(drawHeight).toBeCloseTo(CANVAS_SIZE, 1)
    expect(offsetX).toBeCloseTo(0, 1)
    expect(offsetY).toBeCloseTo(0, 1)
  })

  it('snapshot-restore cycle is stable: second restore of canvas-sized snapshot is unchanged', async () => {
    // Step 1: load 64×99 stickman into 304×304 canvas → produces a 304×304 snapshot
    const { ctx: ctx1, drawImageCalls: calls1 } = makeContext(CANVAS_SIZE, CANVAS_SIZE)
    const { ImageStub: Stub1, instance: img1 } = makeFakeImage(64, 99)
    vi.stubGlobal('Image', Stub1)
    const p1 = drawingRestore(ctx1, 'data:image/webp;base64,stickman')
    img1.onload?.()
    await p1

    // Step 2: restore the resulting 304×304 snapshot (copy-to-editor)
    const { ctx: ctx2, drawImageCalls: calls2 } = makeContext(CANVAS_SIZE, CANVAS_SIZE)
    const { ImageStub: Stub2, instance: img2 } = makeFakeImage(CANVAS_SIZE, CANVAS_SIZE)
    vi.stubGlobal('Image', Stub2)
    const p2 = drawingRestore(ctx2, 'data:image/png;base64,snapshot')
    img2.onload?.()
    await p2

    // First restore: small image scaled to cover canvas (fills width, overflows height)
    const scale = Math.max(CANVAS_SIZE / 64, CANVAS_SIZE / 99)
    expect(calls1[0].drawWidth).toBeCloseTo(64 * scale, 1)
    expect(calls1[0].drawHeight).toBeCloseTo(99 * scale, 1)
    // Second restore: dimensions unchanged (1:1, no extra downscale)
    expect(calls2[0].drawWidth).toBeCloseTo(CANVAS_SIZE, 1)
    expect(calls2[0].drawHeight).toBeCloseTo(CANVAS_SIZE, 1)
    expect(calls2[0].offsetX).toBeCloseTo(0, 1)
    expect(calls2[0].offsetY).toBeCloseTo(0, 1)
  })

  it('clears the canvas before drawing', async () => {
    const { ctx } = makeContext()
    const { ImageStub, instance } = makeFakeImage(64, 99)
    vi.stubGlobal('Image', ImageStub)

    const promise = drawingRestore(ctx, 'data:image/webp;base64,stickman')
    instance.onload?.()
    await promise

    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, CANVAS_SIZE, CANVAS_SIZE)
  })
})
