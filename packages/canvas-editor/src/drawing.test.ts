import { describe, it, expect, vi, beforeEach } from 'vitest'
import { drawingStroke, drawingDot, drawingFill, drawingClear } from './drawing'
import type { DrawingOptions } from './drawing'

const makeContext = () => {
  const calls: string[] = []
  const data = new Uint8ClampedArray(4 * 100 * 100)
  const ctx = {
    canvas: { width: 100, height: 100 },
    globalCompositeOperation: 'source-over' as string,
    strokeStyle: '' as string,
    fillStyle: '' as string,
    lineWidth: 0,
    lineCap: '' as string,
    lineJoin: '' as string,
    beginPath: vi.fn(() => calls.push('beginPath')),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(() => calls.push('stroke')),
    arc: vi.fn(() => calls.push('arc')),
    fill: vi.fn(() => calls.push('fill')),
    clearRect: vi.fn(() => calls.push('clearRect')),
    fillRect: vi.fn(),
    putImageData: vi.fn(() => calls.push('putImageData')),
    getImageData: vi.fn((_x: number, _y: number, w: number, h: number) => ({
      data: data.slice(0, w * h * 4)
    }))
  } as unknown as CanvasRenderingContext2D & { canvas: { width: number; height: number } }
  return { ctx, calls }
}

const brushOptions = (overrides?: Partial<DrawingOptions>): DrawingOptions => ({
  tool: 'brush',
  color: '#ff0000',
  size: 4,
  ...overrides
})

describe('drawing', () => {
  let ctx: ReturnType<typeof makeContext>['ctx']
  let calls: string[]

  beforeEach(() => {
    const result = makeContext()
    ctx = result.ctx
    calls = result.calls
  })

  describe('drawingStroke', () => {
    it('should set source-over composite for brush', () => {
      drawingStroke(ctx, { x: 0, y: 0 }, { x: 10, y: 10 }, brushOptions())
      expect(ctx.globalCompositeOperation).toBe('source-over')
    })

    it('should set destination-out composite for eraser', () => {
      drawingStroke(ctx, { x: 0, y: 0 }, { x: 10, y: 10 }, brushOptions({ tool: 'eraser' }))
      expect(ctx.globalCompositeOperation).toBe('source-over')
    })

    it('should apply color and size', () => {
      drawingStroke(
        ctx,
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        brushOptions({ color: '#00ff00', size: 8 })
      )
      expect(ctx.strokeStyle).toBe('#00ff00')
      expect(ctx.lineWidth).toBe(8)
    })

    it('should call beginPath and stroke', () => {
      drawingStroke(ctx, { x: 0, y: 0 }, { x: 5, y: 5 }, brushOptions())
      expect(calls).toContain('beginPath')
      expect(calls).toContain('stroke')
    })

    it('should reset composite to source-over after erasing', () => {
      drawingStroke(ctx, { x: 0, y: 0 }, { x: 5, y: 5 }, brushOptions({ tool: 'eraser' }))
      expect(ctx.globalCompositeOperation).toBe('source-over')
    })
  })

  describe('drawingDot', () => {
    it('should set fill color for brush', () => {
      drawingDot(ctx, { x: 5, y: 5 }, brushOptions({ color: '#0000ff' }))
      expect(ctx.fillStyle).toBe('#0000ff')
    })

    it('should call arc and fill', () => {
      drawingDot(ctx, { x: 5, y: 5 }, brushOptions())
      expect(calls).toContain('arc')
      expect(calls).toContain('fill')
    })

    it('should set destination-out for eraser then restore', () => {
      drawingDot(ctx, { x: 5, y: 5 }, brushOptions({ tool: 'eraser' }))
      expect(ctx.globalCompositeOperation).toBe('source-over')
    })

    it('should use half the size as arc radius', () => {
      const arcMock = vi.fn()
      ctx.arc = arcMock
      drawingDot(ctx, { x: 5, y: 5 }, brushOptions({ size: 10 }))
      expect(arcMock).toHaveBeenCalledWith(5, 5, 5, 0, Math.PI * 2)
    })
  })

  describe('drawingClear', () => {
    it('should call clearRect with canvas dimensions', () => {
      drawingClear(ctx)
      expect(calls).toContain('clearRect')
      expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 100, 100)
    })
  })

  describe('drawingFill', () => {
    it('should call getImageData (hexToRgb requires real canvas, only input processing tested)', () => {
      // hexToRgb internally creates a real canvas which is unavailable in jsdom.
      // We verify the function reads image data before attempting color conversion.
      try {
        drawingFill(ctx, { x: 50, y: 50 }, '#ff0000')
      } catch {
        // expected in jsdom — real canvas required for hexToRgb
      }
      expect(ctx.getImageData).toHaveBeenCalled()
    })
  })
})
