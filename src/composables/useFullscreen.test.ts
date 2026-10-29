import { afterEach, describe, expect, it, vi } from 'vitest'
import { useFullscreen } from './useFullscreen'

const setFullscreenElement = (element: Element | null): void => {
  Object.defineProperty(document, 'fullscreenElement', { value: element, configurable: true })
}

const installFullscreenApi = () => {
  const requestFullscreen = vi.fn(() => Promise.resolve())
  const exitFullscreen = vi.fn(() => Promise.resolve())
  Object.defineProperty(document.documentElement, 'requestFullscreen', {
    value: requestFullscreen,
    configurable: true
  })
  Object.defineProperty(document, 'exitFullscreen', { value: exitFullscreen, configurable: true })
  Object.defineProperty(document, 'fullscreenEnabled', { value: true, configurable: true })
  return { requestFullscreen, exitFullscreen }
}

describe('useFullscreen', () => {
  afterEach(() => {
    setFullscreenElement(null)
    Reflect.deleteProperty(document, 'fullscreenEnabled')
    Reflect.deleteProperty(document.documentElement, 'requestFullscreen')
    Reflect.deleteProperty(document, 'exitFullscreen')
  })

  it('reports no support where the browser has no Fullscreen API', () => {
    // Arrange, Act
    const { isSupported } = useFullscreen()

    // Assert
    expect(isSupported.value).toBe(false)
  })

  it('reports support when the browser allows fullscreen', () => {
    // Arrange
    installFullscreenApi()

    // Act
    const { isSupported } = useFullscreen()

    // Assert
    expect(isSupported.value).toBe(true)
  })

  it('enters fullscreen on the page when it is not fullscreen', async () => {
    // Arrange
    const { requestFullscreen, exitFullscreen } = installFullscreenApi()
    const { toggleFullscreen } = useFullscreen()

    // Act
    await toggleFullscreen()

    // Assert
    expect(requestFullscreen).toHaveBeenCalledOnce()
    expect(exitFullscreen).not.toHaveBeenCalled()
  })

  it('leaves fullscreen when it is already fullscreen', async () => {
    // Arrange
    const { requestFullscreen, exitFullscreen } = installFullscreenApi()
    setFullscreenElement(document.documentElement)
    const { toggleFullscreen } = useFullscreen()

    // Act
    await toggleFullscreen()

    // Assert
    expect(exitFullscreen).toHaveBeenCalledOnce()
    expect(requestFullscreen).not.toHaveBeenCalled()
  })

  it('follows the browser when fullscreen changes outside the button', () => {
    // Arrange
    installFullscreenApi()
    const { isFullscreen } = useFullscreen()

    // Act
    setFullscreenElement(document.documentElement)
    document.dispatchEvent(new Event('fullscreenchange'))

    // Assert
    expect(isFullscreen.value).toBe(true)
  })

  it('enters fullscreen on the given element instead of the page', async () => {
    // Arrange
    const { requestFullscreen: pageRequest } = installFullscreenApi()
    const target = document.createElement('div')
    const targetRequest = vi.fn(() => Promise.resolve())
    Object.defineProperty(target, 'requestFullscreen', { value: targetRequest })
    const { toggleFullscreen } = useFullscreen(() => target)

    // Act
    await toggleFullscreen()

    // Assert
    expect(targetRequest).toHaveBeenCalledOnce()
    expect(pageRequest).not.toHaveBeenCalled()
  })

  it('is not fullscreen when another element is the fullscreen one', () => {
    // Arrange
    installFullscreenApi()
    const target = document.createElement('div')
    setFullscreenElement(document.documentElement)

    // Act
    const { isFullscreen } = useFullscreen(() => target)

    // Assert
    expect(isFullscreen.value).toBe(false)
  })

  it('does nothing when asked to toggle without support', async () => {
    // Arrange
    const { toggleFullscreen, isFullscreen } = useFullscreen()

    // Act
    await toggleFullscreen()

    // Assert
    expect(isFullscreen.value).toBe(false)
  })
})
