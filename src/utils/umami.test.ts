import { afterEach, describe, expect, it } from 'vitest'
import { useUmami } from './umami'

const umamiScript = (): HTMLScriptElement | null =>
  document.getElementById('umami-script') as HTMLScriptElement | null

describe('useUmami loadUmami', () => {
  afterEach(() => {
    umamiScript()?.remove()
  })

  it.each([undefined, ''])('adds no script for the unconfigured website id %j', (websiteId) => {
    useUmami().loadUmami({ websiteId })

    expect(umamiScript()).toBeNull()
  })

  it('adds the tracking script carrying the website id', () => {
    useUmami().loadUmami({ websiteId: 'site-id' })

    expect(umamiScript()?.getAttribute('data-website-id')).toBe('site-id')
  })

  it('limits tracking to the configured domains', () => {
    useUmami().loadUmami({ websiteId: 'site-id', domains: 'cnotv.xyz' })

    expect(umamiScript()?.getAttribute('data-domains')).toBe('cnotv.xyz')
  })
})
