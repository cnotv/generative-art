import { vi } from 'vitest'

const resizeObserverMethods = {
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}

function ResizeObserverStub(this: Record<string, unknown>) {
  Object.assign(this, resizeObserverMethods)
}

vi.stubGlobal('ResizeObserver', ResizeObserverStub)
