export type StrudelRenderFormat = 'wav' | 'midi'

export type StrudelRenderRequest = {
  code: string
  format: StrudelRenderFormat
  cycles: number
  startCycle: number
  sampleRate: number
}

export type StrudelRenderFile = {
  bytes: Uint8Array
  contentType: string
  fileName: string
}

export type StrudelRenderResult =
  | { ok: true; file: StrudelRenderFile }
  | { ok: false; status: number; message: string }

export type StrudelRenderFunction = (request: StrudelRenderRequest) => Promise<StrudelRenderResult>

export type StrudelRenderParseResult =
  | { ok: true; request: StrudelRenderRequest }
  | { ok: false; status: number; message: string }
