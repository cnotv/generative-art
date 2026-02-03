import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { page } from 'vitest/browser'

// Direct imports - this is the key difference from router lazy loading
import type { Component } from 'vue'

/**
 * Dynamically import all Vue components using Vite's glob import
 * This resolves the lazy-loaded components immediately
 */
const componentModules = import.meta.glob('./**/*.vue', { eager: true })

/**
 * Extract test cases from the imported components
 * Filter to match the routing pattern (component name in path)
 */
const testCases: Array<{ name: string; category: string; path: string; component: Component }> = []

for (const [path, module] of Object.entries(componentModules)) {
  // Extract category and component name from path
  // Pattern: ./{Category}/{ComponentName}/{ComponentName}.vue or ./{Category}/{ComponentName}.vue
  const match = path.match(/^\.\/([^/]+)\/([^/]+)(?:\/\2)?\.vue$/)

  if (match) {
    const [, category, componentName] = match
    // Skip if category is Templates or Stages (not in router)
    if (category === 'Templates' || category === 'Stages') continue

    // Convert to readable name (e.g., "GoombaRunner" -> "Goomba Runner")
    const name = componentName.replace(/([A-Z])/g, ' $1').trim()

    testCases.push({
      name,
      category,
      path: `/${category.toLowerCase()}/${componentName}`,
      component: (module as any).default
    })
  }
}

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
          component
        }]
      })

      // Navigate to the route
      await router.push(path)
      await router.isReady()

      // Mount component
      wrapper = mount(component, {
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
      const canvasElement = canvas.element as HTMLCanvasElement
      expect(canvasElement.width, `${name}: Canvas width should be > 0`).toBeGreaterThan(0)
      expect(canvasElement.height, `${name}: Canvas height should be > 0`).toBeGreaterThan(0)
    } finally {
      // Cleanup
      if (wrapper) {
        wrapper.unmount()
      }
    }
  }, 30_000) // Increased timeout to 30 seconds per test
})
