import { beforeEach, describe, expect, it, vi } from 'vitest'

const STORAGE_KEY = 'top-navigation-enabled'

const loadComposable = async (search: string) => {
  vi.resetModules()
  window.history.replaceState({}, '', `/${search}`)
  const module = await import('./useTopNavigation')
  return module.useTopNavigation()
}

describe('useTopNavigation', () => {
  beforeEach(() => localStorage.clear())

  it('is disabled by default', async () => {
    const { isNavigationEnabled } = await loadComposable('')
    expect(isNavigationEnabled.value).toBe(false)
  })

  it('nav=true enables it and persists', async () => {
    const { isNavigationEnabled } = await loadComposable('?nav=true')
    expect(isNavigationEnabled.value).toBe(true)
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true')
  })

  it('stays enabled on a later load without the query', async () => {
    localStorage.setItem(STORAGE_KEY, 'true')
    const { isNavigationEnabled } = await loadComposable('')
    expect(isNavigationEnabled.value).toBe(true)
  })

  it('disable turns it off for good', async () => {
    const { isNavigationEnabled, disableNavigation } = await loadComposable('?nav=true')
    disableNavigation()
    expect(isNavigationEnabled.value).toBe(false)
    expect(localStorage.getItem(STORAGE_KEY)).toBe('false')
    expect(window.location.search).not.toContain('nav=')
  })

  it('adds nav=true to the URL when enabled from storage', async () => {
    localStorage.setItem(STORAGE_KEY, 'true')
    await loadComposable('')
    expect(window.location.search).toContain('nav=true')
  })
})
