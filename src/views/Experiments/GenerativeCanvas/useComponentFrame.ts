import { onMounted, onUnmounted, ref, shallowRef, watch, type Ref } from 'vue'
import vueRuntimeSource from 'vue/dist/vue.runtime.esm-browser.prod.js?raw'
import { compileComponent } from './compileComponent'
import { createFrameDocument } from './componentFrameDocument'
import { applyStatePatch, parseFrameMessage } from './componentFrameProtocol'
import type { CanvasState, FrameStatus, HostToFrameMessage } from './types'

type CompiledModule = { code: string; css: string }

const COMPONENT_ID_LENGTH = 8

const createComponentId = (): string => crypto.randomUUID().slice(0, COMPONENT_ID_LENGTH)

/**
 * Drives a sandboxed iframe that mounts compiled Vue components. The host owns the state: the
 * frame receives it after every mount and on every change, and sends patches back.
 * @param frameElement - The iframe, rendered with `srcdoc` set to the returned `frameDocument`.
 * @param initialState - The host state the mounted components read as props.
 * @returns The host state, frame status, last error, the frame's document, and `mount`.
 */
export const useComponentFrame = (
  frameElement: Ref<HTMLIFrameElement | null>,
  initialState: CanvasState
) => {
  const state = ref<CanvasState>({ ...initialState })
  const status = ref<FrameStatus>('loading')
  const lastError = ref('')
  const pendingModule = shallowRef<CompiledModule | null>(null)
  const frameDocument = createFrameDocument(vueRuntimeSource)

  // The frame has an opaque origin, so there is no origin to target; it only ever receives
  // compiled code and state, nothing secret.
  const postToFrame = (message: HostToFrameMessage): void =>
    frameElement.value?.contentWindow?.postMessage(message, '*')

  const sendPendingModule = (): void => {
    if (!pendingModule.value) return
    status.value = 'mounting'
    postToFrame({ type: 'mount', ...pendingModule.value, state: { ...state.value } })
  }

  const mount = (source: string): void => {
    const compiled = compileComponent(source, createComponentId())
    if (!compiled.ok) {
      lastError.value = compiled.error
      status.value = 'error'
      return
    }
    pendingModule.value = { code: compiled.code, css: compiled.css }
    if (status.value !== 'loading') sendPendingModule()
  }

  const handleFrameMessage = (event: MessageEvent): void => {
    if (!frameElement.value || event.source !== frameElement.value.contentWindow) return
    const message = parseFrameMessage(event.data)
    if (!message) return
    if (message.type === 'ready') {
      status.value = 'ready'
      sendPendingModule()
    } else if (message.type === 'mounted') {
      status.value = 'mounted'
      lastError.value = ''
    } else if (message.type === 'error') {
      status.value = 'error'
      lastError.value = message.message
    } else {
      state.value = applyStatePatch(state.value, message.patch)
    }
  }

  watch(state, (nextState) => postToFrame({ type: 'state', state: { ...nextState } }), {
    deep: true
  })

  onMounted(() => window.addEventListener('message', handleFrameMessage))
  onUnmounted(() => window.removeEventListener('message', handleFrameMessage))

  return { state, status, lastError, frameDocument, mount }
}
