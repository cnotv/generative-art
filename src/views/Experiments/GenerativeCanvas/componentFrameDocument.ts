const DATA_URL_PREFIX = 'data:text/javascript,'

// The sandbox keeps agent code away from the page; this keeps fetch, sockets and images off the
// network. A meta policy holds even if the code later removes the element. Navigating the frame
// itself is not covered by any policy, so the state sent in must never hold a secret.
const FRAME_CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "script-src 'unsafe-inline' data:",
  "style-src 'unsafe-inline'",
  'img-src data:',
  'font-src data:'
].join('; ')

// Runs inside the sandboxed frame. It imports each compiled component from a data URL, swaps
// it in for the previous one, and falls back to the previous one if the new one fails to
// mount. State arrives from the host and changes go back to it; the frame keeps none of its own.
const FRAME_BOOTSTRAP = `
import { createApp, h, reactive } from 'vue'

const state = reactive({})
const styleElement = document.getElementById('component-style')
const sendToHost = (message) => parent.postMessage(message, '*')
const current = { app: null, component: null, css: '' }

const mountComponent = (component, css) => {
  const mountErrors = []
  const app = createApp({
    render: () => h(component, {
      ...state,
      onUpdate: (patch) => sendToHost({ type: 'update', patch: JSON.parse(JSON.stringify(patch)) })
    })
  })
  app.config.errorHandler = (error) => {
    mountErrors.push(error)
    sendToHost({ type: 'error', message: String(error) })
  }
  styleElement.textContent = css
  app.mount('#root')
  if (mountErrors.length > 0) {
    app.unmount()
    throw mountErrors[0]
  }
  return app
}

const swapComponent = async ({ code, css }) => {
  const module = await import('${DATA_URL_PREFIX}' + encodeURIComponent(code))
  current.app?.unmount()
  try {
    current.app = mountComponent(module.default, css)
    current.component = module.default
    current.css = css
    sendToHost({ type: 'mounted' })
  } catch (error) {
    current.app = current.component ? mountComponent(current.component, current.css) : null
    throw error
  }
}

window.addEventListener('message', (event) => {
  if (event.source !== parent) return
  const message = event.data
  if (message?.state) Object.assign(state, message.state)
  if (message?.type === 'mount') {
    swapComponent(message).catch((error) => sendToHost({ type: 'error', message: String(error) }))
  }
})

sendToHost({ type: 'ready' })
`

/**
 * Builds the `srcdoc` of the sandboxed component frame. Vue is mapped to a data URL so the
 * frame needs nothing from any origin: an opaque-origin frame cannot load module scripts from
 * the host without CORS headers.
 * @param vueRuntimeSource - The source of Vue's browser ESM runtime build.
 * @returns The frame's HTML document.
 */
export const createFrameDocument = (vueRuntimeSource: string): string => {
  const importMap = JSON.stringify({
    imports: { vue: `${DATA_URL_PREFIX}${encodeURIComponent(vueRuntimeSource)}` }
  })
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${FRAME_CONTENT_SECURITY_POLICY}">
<script type="importmap">${importMap}</script>
<style id="component-style"></style>
</head>
<body>
<div id="root"></div>
<script type="module">${FRAME_BOOTSTRAP}</script>
</body>
</html>`
}
