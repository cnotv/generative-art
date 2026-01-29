import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { page } from 'vitest/browser'
import { generatedRoutes } from '@/config/router'

/**
 * Extract test cases from router configuration
 * This ensures we test exactly the pages defined in the routing
 */
const testCases = generatedRoutes
  .filter((route): route is NonNullable<typeof route> => {
    return route !== null && route !== undefined &&
           typeof route.component === 'function' &&
           typeof route.name === 'string' &&
           typeof route.group === 'string'
  })
  .map(route => ({
    name: route.name as string,
    category: route.group as string,
    path: route.path,
    component: route.component
  }))

/**
 * Visual Regression Tests
 *
 * These tests verify that Vue components with 3D scenes load and render correctly.
 * Each test:
 * 1. Mounts the component with required dependencies (Pinia, Vue Router)
 * 2. Waits for the Three.js scene to initialize (5 seconds + animation frames)
 * 3. Captures a screenshot for visual verification
 * 4. Verifies the canvas element exists and has non-zero dimensions
 *
 * Use these tests to catch visual regressions when making changes to:
 * - Three.js scene setup
 * - Component rendering logic
 * - Animation systems
 * - Material/texture loading
 *
 * Screenshots are stored in the format:
 * src/views/__screenshots__/visual-regression.browser.test.ts/Visual-Regression-----{category}-----{name}--should-render-{name}-correctly-1.png
 */
describe.each(testCases)('Visual Regression -- $category - $name', ({ component, name, path }) => {
  it(`should render ${name} correctly`, async () => {
    let wrapper: any

    try {
      // Create required dependencies
      const pinia = createPinia()
      const router = createRouter({
        history: createMemoryHistory(),
        routes: [{
          path: path,
          component: component as any
        }]
      })

      // Navigate to the route
      await router.push(path)
      await router.isReady()

      // Mount component
      wrapper = mount(component as any, {
        global: {
          plugins: [pinia, router]
        },
        attachTo: document.body
      })

      // Wait for component to mount
      await wrapper.vm.$nextTick()

      // Verify canvas element exists
      const canvas = wrapper.find('canvas')
      expect(canvas.exists(), `${name}: Canvas should exist`).toBe(true)

      // Wait for Three.js scene to initialize and render
      // Increased wait time to ensure WebGL compiles shaders, loads models, and renders
      // Also allows time for animations to start (like pop-up animations in ForestGame)
      await new Promise(resolve => setTimeout(resolve, 5000))

      // Wait for multiple animation frames to ensure rendering happened
      await new Promise(resolve => requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              requestAnimationFrame(resolve)
            })
          })
        })
      }))

      // Take screenshot for visual verification
      const screenshot = await page.screenshot()
      expect(screenshot, `${name}: Screenshot should be captured`).toBeDefined()

      // Verify canvas dimensions
      const canvasEl = canvas.element as HTMLCanvasElement
      expect(canvasEl.width, `${name}: Canvas width should be > 0`).toBeGreaterThan(0)
      expect(canvasEl.height, `${name}: Canvas height should be > 0`).toBeGreaterThan(0)
    } finally {
      // Cleanup
      if (wrapper) {
        wrapper.unmount()
      }
    }
  }, 30000) // Increased timeout to 30 seconds per test
})
