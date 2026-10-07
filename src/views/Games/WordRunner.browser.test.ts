import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import WordRunner from '@/views/Games/WordRunner/WordRunner.vue'

// The whole forest course is built before the race begins, which takes a while.
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

describe('WordRunner - a race from the lobby', () => {
  beforeEach(() => localStorage.clear())

  it(
    'offers German A1 alone in the lobby, loads the course, and races it on any key',
    async () => {
      const wrapper = mountWordRunner()

      const startButton = () =>
        wrapper.findAll('button').find((button) => button.text().trim() === 'Start')
      await vi.waitFor(() => expect(startButton()).toBeDefined(), {
        timeout: 10_000,
        interval: 250
      })
      const selects = wrapper.findAll('select')
      expect((selects[0].element as HTMLSelectElement).value).toBe('de')
      expect(selects[1].findAll('option').map((option) => option.text())).toEqual(['A1 · Im Café'])

      await startButton()?.trigger('click')

      await vi.waitFor(() => expect(wrapper.find('.word-runner-hud').exists()).toBe(true), {
        timeout: SCENE_READY_TIMEOUT,
        interval: 500
      })
      expect(wrapper.find('.word-runner-hud__translation').text()).toBe('Good morning!')
      const canvas = wrapper.find('canvas').element as HTMLCanvasElement
      expect(canvas.width).toBeGreaterThan(0)

      // The first race waits behind its intro until any key, then the intro gives way.
      await vi.waitFor(
        () =>
          expect(wrapper.find('.word-runner-intro__prompt').text()).toBe('Press any key to start'),
        { timeout: SCENE_READY_TIMEOUT, interval: 500 }
      )
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
      await vi.waitFor(() => expect(wrapper.find('.word-runner-intro').exists()).toBe(false), {
        timeout: 5000,
        interval: 100
      })

      wrapper.unmount()
    },
    SCENE_READY_TIMEOUT + 30_000
  )
})
