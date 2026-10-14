/**
 * Enable zoom prevention on mobile devices
 * @returns The viewport tag and the style element added, to restore later.
 */
const enableZoomPrevention = () => {
  // Store original viewport and modify it
  const originalViewport = document.querySelector('meta[name="viewport"]')
  if (originalViewport) {
    originalViewport.setAttribute(
      'content',
      'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'
    )
  }

  // Add CSS for zoom prevention
  const preventZoomStyleElement = document.createElement('style')
  preventZoomStyleElement.id = 'zoom-prevention'
  preventZoomStyleElement.textContent = `
    html, body {
      touch-action: manipulation;
      -ms-touch-action: manipulation;
      -webkit-touch-callout: none;
      overscroll-behavior: none;
    }
    button, input, select, textarea, a {
      touch-action: manipulation;
    }
    input, textarea, select {
      font-size: max(16px, inherit);
    }
  `
  document.head.appendChild(preventZoomStyleElement)

  return { originalViewport, preventZoomStyleElement }
}

/**
 * Restore normal zoom functionality
 * @param originalViewport The viewport tag to restore.
 * @param preventZoomStyleElement The style element to remove.
 */
const disableZoomPrevention = (
  originalViewport: Element | null,
  preventZoomStyleElement: HTMLStyleElement | null
) => {
  // Restore original viewport
  if (originalViewport) {
    originalViewport.setAttribute('content', 'width=device-width, initial-scale=1.0')
  }

  // Remove zoom prevention CSS
  if (preventZoomStyleElement) {
    document.head.removeChild(preventZoomStyleElement)
    preventZoomStyleElement = null
  }
}

/**
 * Load Google Fonts for this route only
 * @param url The stylesheet URL.
 * @param id The id to give the link, to remove it later.
 */
const loadGoogleFont = (url: string, id: string) => {
  const link = document.createElement('link')
  link.href = url
  link.rel = 'stylesheet'
  link.id = id
  document.head.appendChild(link)
}

/**
 * Remove Google Font from the document
 * @param id The id the link was given.
 */
const removeGoogleFont = (id: string) => {
  const existingLink = document.getElementById(id)
  if (existingLink) {
    document.head.removeChild(existingLink)
  }
}

export { enableZoomPrevention, disableZoomPrevention, loadGoogleFont, removeGoogleFont }
