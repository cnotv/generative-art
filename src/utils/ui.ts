/**
 * Enable zoom prevention on mobile devices
 */
export const enableZoomPrevention = () => {
  // Store original viewport and modify it
  const originalViewport = document.querySelector('meta[name="viewport"]');
  if (originalViewport) {
    originalViewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
  }

  // Add CSS for zoom prevention
  const preventZoomStyleElement = document.createElement('style');
  preventZoomStyleElement.id = 'zoom-prevention';
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
      font-size: 16px !important;
    }
  `;
  document.head.appendChild(preventZoomStyleElement);

  return {originalViewport, preventZoomStyleElement}
};

/**
 * Restore normal zoom functionality
 */
export const disableZoomPrevention = (originalViewport: Element | null, preventZoomStyleElement: HTMLStyleElement | null) => {
  // Restore original viewport
  if (originalViewport) {
    originalViewport.setAttribute('content', 'width=device-width, initial-scale=1.0');
  }

  // Remove zoom prevention CSS
  if (preventZoomStyleElement) {
    document.head.removeChild(preventZoomStyleElement);
    preventZoomStyleElement = null;
  }
};

/**
 * Load Google Fonts for this route only
 */
export const loadGoogleFont = (url: string, id: string) => {
  const link = document.createElement("link");
  link.href = url;
  link.rel = "stylesheet";
  link.id = id;
  document.head.appendChild(link);
};

/**
 * Remove Google Font from the document
 */
export const removeGoogleFont = (id: string) => {
  const existingLink = document.getElementById(id);
  if (existingLink) {
    document.head.removeChild(existingLink);
  }
};
