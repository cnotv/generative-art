import {
  STRUDEL_CODE_MAX_BYTES,
  STRUDEL_CYCLES_MAX,
  STRUDEL_DEFAULT_SAMPLE_RATE,
  STRUDEL_HTTP_STATUS,
  STRUDEL_SAMPLE_RATES,
  STRUDEL_START_CYCLE_MAX
} from './config'
import type { StrudelRenderFormat, StrudelRenderParseResult, StrudelRenderRequest } from './types'

type ParseError = { ok: false; status: number; message: string }

type ReadResult<Value> = { ok: true; value: Value } | ParseError

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const invalid = (message: string, status: number = STRUDEL_HTTP_STATUS.badRequest): ParseError => ({
  ok: false,
  status,
  message
})

const readNumber = (value: unknown, fallback: number): number | null => {
  if (value === undefined) return fallback
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

const codeByteLength = (code: string): number => new TextEncoder().encode(code).byteLength

const readCode = (value: unknown): ReadResult<string> => {
  if (typeof value !== 'string') return invalid('code must be a string')
  if (value.trim().length === 0) return invalid('code must not be empty')
  if (codeByteLength(value) > STRUDEL_CODE_MAX_BYTES) {
    return invalid(
      `code must be at most ${STRUDEL_CODE_MAX_BYTES} bytes`,
      STRUDEL_HTTP_STATUS.payloadTooLarge
    )
  }
  return { ok: true, value }
}

const readFormat = (value: unknown): ReadResult<StrudelRenderFormat> => {
  if (value === undefined) return { ok: true, value: 'wav' }
  return value === 'wav' || value === 'midi'
    ? { ok: true, value }
    : invalid('format must be wav or midi')
}

const readCycles = (value: unknown): ReadResult<number> => {
  const cycles = readNumber(value, 1)
  if (cycles === null || cycles <= 0 || cycles > STRUDEL_CYCLES_MAX) {
    return invalid(`cycles must be greater than 0 and at most ${STRUDEL_CYCLES_MAX}`)
  }
  return { ok: true, value: cycles }
}

const readStartCycle = (value: unknown): ReadResult<number> => {
  const startCycle = readNumber(value, 0)
  if (startCycle === null || startCycle < 0 || startCycle > STRUDEL_START_CYCLE_MAX) {
    return invalid(`startCycle must be between 0 and ${STRUDEL_START_CYCLE_MAX}`)
  }
  return { ok: true, value: startCycle }
}

const readSampleRate = (value: unknown): ReadResult<number> => {
  if (value === undefined) return { ok: true, value: STRUDEL_DEFAULT_SAMPLE_RATE }
  const sampleRate = STRUDEL_SAMPLE_RATES.find((candidate) => candidate === value)
  if (sampleRate === undefined) {
    return invalid(`sampleRate must be one of ${STRUDEL_SAMPLE_RATES.join(', ')}`)
  }
  return { ok: true, value: sampleRate }
}

/**
 * Validates the JSON body of a render request and fills in the endpoint's defaults.
 * @param body - the parsed JSON body, of any shape
 * @returns the normalized render request, or the status and message to send back
 */
export const parseStrudelRenderRequest = (body: unknown): StrudelRenderParseResult => {
  if (!isRecord(body)) return invalid('body must be a JSON object')

  const code = readCode(body.code)
  if (!code.ok) return code

  const format = readFormat(body.format)
  if (!format.ok) return format

  const cycles = readCycles(body.cycles)
  if (!cycles.ok) return cycles

  const startCycle = readStartCycle(body.startCycle)
  if (!startCycle.ok) return startCycle

  const sampleRate = readSampleRate(body.sampleRate)
  if (!sampleRate.ok) return sampleRate

  const request: StrudelRenderRequest = {
    code: code.value,
    format: format.value,
    cycles: cycles.value,
    startCycle: startCycle.value,
    sampleRate: sampleRate.value
  }
  return { ok: true, request }
}
