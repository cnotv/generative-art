import type { Config } from '@netlify/functions'
import { renderStrudelFile } from '../strudel-render/browser'
import { createStrudelRenderHandler } from '../strudel-render/handler'

// Netlify reads this object by static analysis at build time, so every value must be a literal.
// An imported constant leaves the function with no route and /api/strudel/render answers 404.
export const config: Config = {
  path: '/api/strudel/render',
  rateLimit: { action: 'rate_limit', aggregateBy: 'ip', windowSize: 60, windowLimit: 3 }
}

export default createStrudelRenderHandler(renderStrudelFile)
