import {
  STRUDEL_CODE_MAX_BYTES,
  STRUDEL_CORS_HEADERS,
  STRUDEL_HTTP_STATUS,
  STRUDEL_REQUEST_OVERHEAD_BYTES
} from './config'
import { parseStrudelRenderRequest } from './request'
import type { StrudelRenderFunction } from './types'

const jsonHeaders = {
  ...STRUDEL_CORS_HEADERS,
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store'
} as const

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders })

const audioResponse = (file: {
  bytes: Uint8Array
  contentType: string
  fileName: string
}): Response =>
  new Response(file.bytes, {
    status: STRUDEL_HTTP_STATUS.ok,
    headers: {
      ...STRUDEL_CORS_HEADERS,
      'Content-Type': file.contentType,
      'Content-Disposition': `attachment; filename="${file.fileName}"`,
      'Cache-Control': 'no-store',
      'X-Strudel-Source': 'https://github.com/cnotv/generative-art'
    }
  })

/**
 * Builds the HTTP handler around a render function, so the browser work can be faked in tests.
 * @param render - renders a validated request to a WAV or MIDI file
 * @returns a Netlify-compatible request handler
 */
export const createStrudelRenderHandler =
  (render: StrudelRenderFunction) =>
  async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: STRUDEL_HTTP_STATUS.noContent,
        headers: STRUDEL_CORS_HEADERS
      })
    }
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Use POST' }), {
        status: STRUDEL_HTTP_STATUS.methodNotAllowed,
        headers: { ...jsonHeaders, Allow: 'POST, OPTIONS' }
      })
    }

    const declaredLength = Number(request.headers.get('content-length') ?? Number.NaN)
    if (
      Number.isFinite(declaredLength) &&
      declaredLength > STRUDEL_CODE_MAX_BYTES + STRUDEL_REQUEST_OVERHEAD_BYTES
    ) {
      return jsonResponse(STRUDEL_HTTP_STATUS.payloadTooLarge, {
        error: 'The request body is too large'
      })
    }

    const body = await request.json().catch(() => undefined)
    if (body === undefined) {
      return jsonResponse(STRUDEL_HTTP_STATUS.badRequest, { error: 'body must be JSON' })
    }

    const parsed = parseStrudelRenderRequest(body)
    if (!parsed.ok) return jsonResponse(parsed.status, { error: parsed.message })

    const result = await render(parsed.request).catch((error: unknown) => {
      console.error('[strudel-render]', error)
      return {
        ok: false as const,
        status: STRUDEL_HTTP_STATUS.unprocessableEntity,
        message: 'The render failed'
      }
    })
    if (!result.ok) return jsonResponse(result.status, { error: result.message })

    return audioResponse(result.file)
  }
