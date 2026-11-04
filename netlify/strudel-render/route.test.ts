// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const functionSource = readFileSync(
  new URL('../functions/strudel-render.ts', import.meta.url),
  'utf8'
)

describe('strudel-render function route', () => {
  it('declares its path as a literal that Netlify can read without running the code', () => {
    expect(functionSource).toMatch(/path:\s*'\/api\/strudel\/render'/)
  })

  it('declares its rate limit as literals', () => {
    expect(functionSource).toMatch(/rateLimit:\s*{[^}]*windowLimit:\s*\d+[^}]*}/)
  })
})
