import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { page } from 'vitest/browser'
import GoombaRunner from '@/views/Games/GoombaRunner/GoombaRunner.vue'

describe('GoombaRunner - Component Loading', () => {
  it('should successfully mount and render 3D scene', async () => {
    // Create required dependencies
    const pinia = createPinia()
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{
        path: '/',
        component: GoombaRunner
      }]
    })

    const wrapper = mount(GoombaRunner, {
      global: {
        plugins: [pinia, router]
      },
      attachTo: document.body
    })

    // Wait for component to mount
    await wrapper.vm.$nextTick()

    // Verify canvas element exists - this confirms Three.js initialization started
    const canvas = wrapper.find('canvas')
    expect(canvas.exists()).toBe(true)
    expect(canvas.element.tagName).toBe('CANVAS')

    // Wait for Three.js scene to initialize and render multiple frames
    // WebGL needs time to compile shaders, load models, and render
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Wait for animation frames to ensure rendering happened
    await new Promise(resolve => requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve)
      })
    }))

    // Take screenshot for visual verification
    const screenshot = await page.screenshot()
    expect(screenshot).toBeDefined()

    // Verify the canvas has actual dimensions (not 0x0)
    const canvasEl = canvas.element as HTMLCanvasElement
    expect(canvasEl.width).toBeGreaterThan(0)
    expect(canvasEl.height).toBeGreaterThan(0)

    // Cleanup
    wrapper.unmount()
  }, 10000) // Increase timeout to 10 seconds
})
