import { describe, it, expect } from 'vitest'
import { generatedRoutes, deriveRouteName } from '@/config/router'
import { VIEW_META } from '@/config/viewsMeta'
import { toRouteName } from '../../scripts/routes.mjs'

describe('route name and viewsMeta parity', () => {
  it('has a viewsMeta entry for every generated route name', () => {
    const missing = generatedRoutes
      .filter((route) => route !== null)
      .map((route) => route!.name)
      .filter((name) => !(name in VIEW_META))

    expect(missing).toEqual([])
  })

  it('has no viewsMeta entry that is unreachable from a generated route', () => {
    const routeNames = new Set(
      generatedRoutes.filter((route) => route !== null).map((route) => route!.name)
    )
    const dead = Object.keys(VIEW_META).filter((key) => !routeNames.has(key))

    expect(dead).toEqual([])
  })

  it('derives the same name as the build-time route script', () => {
    const baseNames = generatedRoutes
      .filter((route) => route !== null)
      .map((route) => route!.path.split('/').pop()!)

    const mismatched = baseNames.filter(
      (baseName) => deriveRouteName(baseName) !== toRouteName(baseName)
    )

    expect(mismatched).toEqual([])
  })

  it('splits digits and keeps acronyms together', () => {
    expect(deriveRouteName('CubeMatrix2')).toBe('Cube Matrix 2')
    expect(deriveRouteName('LobbyUIShowcase')).toBe('Lobby UI Showcase')
  })
})
