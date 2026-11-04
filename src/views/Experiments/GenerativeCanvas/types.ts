export type CanvasStateValue = string | number | boolean

export type CanvasState = Record<string, CanvasStateValue>

export type HostToFrameMessage =
  | { type: 'mount'; code: string; css: string; state: CanvasState }
  | { type: 'state'; state: CanvasState }

export type FrameToHostMessage =
  | { type: 'ready' }
  | { type: 'mounted' }
  | { type: 'error'; message: string }
  | { type: 'update'; patch: CanvasState }

export type CompiledComponent =
  | { ok: true; code: string; css: string }
  | { ok: false; error: string }

export type FrameStatus = 'loading' | 'ready' | 'mounting' | 'mounted' | 'error'
