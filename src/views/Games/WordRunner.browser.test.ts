import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import WordRunner from '@/views/Games/WordRunner/WordRunner.vue'

// The whole forest course is built before the start screen shows, which takes a while.
const SCENE_READY_TIMEOUT = 90_000

const mountWordRunner = () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', name: 'WordRunner', component: WordRunner }]
  })
  return mount(WordRunner, {
    global: { plugins: [createPinia(), router] },
    attachTo: document.body
  })
}

describe('WordRunner - a race from the start screen', () => {
  beforeEach(() => localStorage.clear())

  it(
    'loads the course, opens only A1 in German, and starts its race',
    async () => {
      const wrapper = mountWordRunner()

      await vi.waitFor(() => expect(wrapper.find('.word-runner-start').exists()).toBe(true), {
        timeout: SCENE_READY_TIMEOUT,
        interval: 500
      })
      const levelButtons = wrapper.findAll('.word-runner-start__levels button')
      expect(wrapper.find('.lui-toggle__btn--active').text()).toBe('German')
      expect(levelButtons).toHaveLength(6)
      expect(levelButtons.map((button) => button.attributes('disabled') !== undefined)).toEqual([
        false,
        true,
        true,
        true,
        true,
        true
      ])

      await levelButtons[0].trigger('click')

      await vi.waitFor(() => expect(wrapper.find('.word-runner-hud').exists()).toBe(true), {
        timeout: 10_000
      })
      expect(wrapper.find('.word-runner-hud__status').text()).toContain('A1 · Im Café')
      expect(wrapper.find('.word-runner-hud__translation').text()).toBe('Good morning!')
      const canvas = wrapper.find('canvas').element as HTMLCanvasElement
      expect(canvas.width).toBeGreaterThan(0)

      wrapper.unmount()
    },
    SCENE_READY_TIMEOUT + 30_000
  )
})
