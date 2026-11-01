// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { createStrudelRenderHandler } from './handler'
import type { StrudelRenderFunction } from './types'

const handlerUrl = 'http://localhost/api/strudel/render'

const successfulRender = (): StrudelRenderFunction =>
  vi.fn(async () => ({
    ok: true as const,
    file: {
      bytes: new Uint8Array([82, 73, 70, 70]),
      contentType: 'audio/wav',
      fileName: 'strudel-render.wav'
    }
  }))

const postRequest = (body: unknown): Request =>
  new Request(handlerUrl, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' }
  })

describe('createStrudelRenderHandler', () => {
  it('answers the CORS preflight', async () => {
    const handler = createStrudelRenderHandler(successfulRender())

    const response = await handler(new Request(handlerUrl, { method: 'OPTIONS' }))

    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('rejects methods other than POST', async () => {
    const handler = createStrudelRenderHandler(successfulRender())

    const response = await handler(new Request(handlerUrl, { method: 'GET' }))

    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('POST, OPTIONS')
  })

  it('rejects a body that is not JSON', async () => {
    const handler = createStrudelRenderHandler(successfulRender())
    const request = new Request(handlerUrl, {
      method: 'POST',
      body: '{',
      headers: { 'content-type': 'application/json' }
    })

    const response = await handler(request)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'body must be JSON' })
  })

  it('rejects an invalid render request', async () => {
    const handler = createStrudelRenderHandler(successfulRender())

    const response = await handler(postRequest({ code: '' }))

    expect(response.status).toBe(400)
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('rejects a body over the size limit without parsing it', async () => {
    const render = successfulRender()
    const handler = createStrudelRenderHandler(render)

    const response = await handler(postRequest({ code: 'a'.repeat(20_000) }))

    expect(response.status).toBe(413)
    expect(render).not.toHaveBeenCalled()
  })

  it('passes the normalized request to the renderer', async () => {
    const render = successfulRender()
    const handler = createStrudelRenderHandler(render)

    await handler(postRequest({ code: 's("bd")' }))

    expect(render).toHaveBeenCalledWith({
      code: 's("bd")',
      format: 'wav',
      cycles: 1,
      startCycle: 0,
      sampleRate: 48_000
    })
  })

  it('returns the rendered file with download headers', async () => {
    const handler = createStrudelRenderHandler(successfulRender())

    const response = await handler(postRequest({ code: 's("bd")' }))
    const bytes = new Uint8Array(await response.arrayBuffer())

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('audio/wav')
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="strudel-render.wav"'
    )
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(bytes).toEqual(new Uint8Array([82, 73, 70, 70]))
  })

  it('returns the renderer error status and message', async () => {
    const render: StrudelRenderFunction = vi.fn(async () => ({
      ok: false as const,
      status: 422,
      message: 'The pattern failed'
    }))
    const handler = createStrudelRenderHandler(render)

    const response = await handler(postRequest({ code: 's("bd")' }))

    expect(response.status).toBe(422)
    expect(await response.json()).toEqual({ error: 'The pattern failed' })
  })

  it('turns an unexpected renderer error into 422', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const render: StrudelRenderFunction = vi.fn(async () => {
      throw new Error('boom')
    })
    const handler = createStrudelRenderHandler(render)

    const response = await handler(postRequest({ code: 's("bd")' }))

    expect(response.status).toBe(422)
    expect(await response.json()).toEqual({ error: 'The render failed' })
    consoleError.mockRestore()
  })
})
