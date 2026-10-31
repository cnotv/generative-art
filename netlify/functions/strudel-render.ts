import type { Config } from '@netlify/functions'
import { renderStrudelFile } from '../strudel-render/browser'
import { STRUDEL_RENDER_PATH, STRUDEL_RENDER_RATE_LIMIT } from '../strudel-render/config'
import { createStrudelRenderHandler } from '../strudel-render/handler'

export const config: Config = {
  path: STRUDEL_RENDER_PATH,
  rateLimit: STRUDEL_RENDER_RATE_LIMIT
}

export default createStrudelRenderHandler(renderStrudelFile)
