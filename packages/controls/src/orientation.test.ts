import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { lockScreenOrientation, unlockScreenOrientation } from './orientation'

const stubOrientation = (value: unknown): void => {
  Object.defineProperty(window.screen, 'orientation', { configurable: true, value })
}

describe('lockScreenOrientation', () => {
  beforeEach(() => {
    stubOrientation({ type: 'portrait-primary', lock: vi.fn().mockResolvedValue(undefined) })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('pins the screen to the orientation it is currently in', async () => {
    await lockScreenOrientation()

    expect(window.screen.orientation.lock).toHaveBeenCalledWith('portrait-primary')
  })

  it('locks the orientation asked for when one is given', async () => {
    await lockScreenOrientation('landscape')

    expect(window.screen.orientation.lock).toHaveBeenCalledWith('landscape')
  })

  /**
   * Every one of these is a platform that simply will not lock — iOS has never implemented it,
   * and Android refuses outside fullscreen. A caller has no better fallback than the layout it
   * already does on resize, so a refusal must not surface as a rejection it has to catch.
   */
  it.each([
    ['the platform defines no lock at all', { type: 'portrait-primary' }],
    ['there is no orientation object', undefined]
  ])('resolves without throwing when %s', async (_case, orientation) => {
    stubOrientation(orientation)

    await expect(lockScreenOrientation()).resolves.toBeUndefined()
  })

  it('resolves without throwing when the platform rejects the lock', async () => {
    stubOrientation({
      type: 'portrait-primary',
      lock: vi.fn().mockRejectedValue(new Error('fullscreen required'))
    })

    await expect(lockScreenOrientation()).resolves.toBeUndefined()
  })
})

describe('unlockScreenOrientation', () => {
  it('releases the lock, so leaving does not leave the page pinned', () => {
    const unlock = vi.fn()
    stubOrientation({ type: 'portrait-primary', unlock })

    unlockScreenOrientation()

    expect(unlock).toHaveBeenCalledTimes(1)
  })

  it('does nothing where the platform defines no unlock', () => {
    stubOrientation({ type: 'portrait-primary' })

    expect(() => unlockScreenOrientation()).not.toThrow()
  })
})
