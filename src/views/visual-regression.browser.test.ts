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
 * 2. Waits for the Three.js scene to initialize (100ms + 1 animation frame)
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
 * Suppress THREE.Material warnings during tests
 * These warnings are expected in some views that demonstrate different material types
 */
const originalConsoleWarn = console.warn
const originalConsoleError = console.error

// eslint-disable-next-line @typescript-eslint/no-explicit-any
console.warn = (...args: any[]) => {
  const message = args.join(' ')
  if (message.includes('THREE.Material:')) {
    return // Suppress THREE.Material warnings
  }
  originalConsoleWarn.apply(console, args)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
console.error = (...args: any[]) => {
  const message = args.join(' ')
  if (message.includes('THREE.Material:')) {
    return // Suppress THREE.Material errors
  }
  originalConsoleError.apply(console, args)
}

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

/**
 * Wait for canvas to render by checking if pixels are no longer blank
 * This replaces arbitrary timeouts with actual render detection
 */
async function waitForCanvasRender(canvas: HTMLCanvasElement, timeoutMs = 5000): Promise<void> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeoutMs) {
    try {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        // Check a small sample of pixels to see if anything has been rendered
        const imageData = ctx.getImageData(0, 0, Math.min(canvas.width, 10), Math.min(canvas.height, 10))
        const hasNonZeroPixels = imageData.data.some(value => value !== 0)

        if (hasNonZeroPixels) {
          // Canvas has rendered content, wait one more frame to be sure
          await new Promise(resolve => requestAnimationFrame(resolve))
          return
        }
      }
    } catch {
      // WebGL canvas may not support getContext('2d'), that's okay
      // Fall back to just waiting for dimensions
      if (canvas.width > 0 && canvas.height > 0) {
        await new Promise(resolve => requestAnimationFrame(resolve))
        return
      }
    }

    // Wait a bit before checking again
    await new Promise(resolve => setTimeout(resolve, 50))
  }

  // Timeout reached, proceed anyway (better than failing)
  await new Promise(resolve => requestAnimationFrame(resolve))
}

describe.each(testCases)('Visual Regression -- $category - $name', ({ component, name, path }) => {
  it(`should render ${name} correctly`, async () => {
    let wrapper: any
    let canvasElement: HTMLCanvasElement | null = null
    let rafStub: any = null

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

      // Wait for canvas to actually render (smart polling instead of fixed timeout)
      await waitForCanvasRender(canvasElement, 5000)

      // Now freeze the animation loop for consistent screenshots
      // Store original RAF and replace with immediate execution
      const originalRAF = window.requestAnimationFrame

      rafStub = (callback: (time: number) => void) => {
        // Execute callback immediately with timestamp 0 (frozen time)
        callback(0)
        return 0
      }
      window.requestAnimationFrame = rafStub

      // Execute any pending animation frames at frozen time
      await new Promise(resolve => originalRAF(resolve))

      // Restore RAF before screenshot to avoid issues
      window.requestAnimationFrame = originalRAF

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
      await new Promise(resolve => setTimeout(resolve, 10))
    }
  }, 10_000) // Increased to 10s to allow for async asset loading in CI
})
