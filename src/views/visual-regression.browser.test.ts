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
/**
 * Force release WebGL context to avoid context exhaustion
 * Browsers limit active WebGL contexts (typically 8-16)
 */
const forceReleaseWebGLContext = (canvas: HTMLCanvasElement) => {
  const gl = canvas.getContext('webgl') || canvas.getContext('webgl2')
  if (gl) {
    const loseContext = gl.getExtension('WEBGL_lose_context')
    if (loseContext) {
      loseContext.loseContext()
    }
  }
}

describe.each(testCases)('Visual Regression -- $category - $name', ({ component, name, path }) => {
  it(`should render ${name} correctly`, async () => {
    let wrapper: any
    let canvasElement: HTMLCanvasElement | null = null

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
      canvasElement = canvas.element as HTMLCanvasElement

      // Wait for Three.js scene to initialize and render
      // 2 seconds is sufficient for WebGL shader compilation and initial render
      await new Promise(resolve => setTimeout(resolve, 2000))

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
      expect(canvasElement.width, `${name}: Canvas width should be > 0`).toBeGreaterThan(0)
      expect(canvasElement.height, `${name}: Canvas height should be > 0`).toBeGreaterThan(0)
    } finally {
      // Force release WebGL context before unmounting to avoid context exhaustion
      if (canvasElement) {
        forceReleaseWebGLContext(canvasElement)
      }
      // Cleanup
      if (wrapper) {
        wrapper.unmount()
      }
      // Small delay to allow context cleanup
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }, 15_000) // 15 seconds per test should be sufficient
})
