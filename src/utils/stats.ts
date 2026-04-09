import type { RouteLocationNormalizedLoaded } from 'vue-router'
import Stats from 'stats.js'

const panel = new Stats()
const state = { enabled: false }

const init = (route: RouteLocationNormalizedLoaded, statsElement: HTMLElement) => {
  state.enabled = route.query.stats === 'true'
  if (state.enabled) {
    panel.showPanel(0) // 0: fps, 1: ms, 2: mb, 3+: custom
    statsElement.appendChild(panel.dom)
  }
}

const start = (_routeName: string) => {
  if (state.enabled) panel.begin()
}

const end = (_routeName: string) => {
  if (state.enabled) panel.end()
}

export const stats = {
  init,
  start,
  end
}
