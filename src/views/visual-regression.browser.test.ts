import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { page } from 'vitest/browser'

// Tools
import GrassGenerator from '@/views/Tools/GrassGenerator.vue'
import MixamoPlayground from '@/views/Tools/MixamoPlayground.vue'
import ModelLoader from '@/views/Tools/ModelLoader.vue'
import ToolsTest from '@/views/Tools/ToolsTest.vue'

// Generative
import CubeMatrix from '@/views/Generative/CubeMatrix.vue'
import CubeMatrix2 from '@/views/Generative/CubeMatrix2.vue'
import CubeMatrixThreejs from '@/views/Generative/CubeMatrixThreejs.vue'
import CubeSequences from '@/views/Generative/CubeSequences.vue'
import CubeShift from '@/views/Generative/CubeShift.vue'
import FallingView from '@/views/Generative/FallingView.vue'
import LineMatrixMouse from '@/views/Generative/LineMatrixMouse.vue'
import MetalCubes from '@/views/Generative/MetalCubes.vue'
import MetalCubes2 from '@/views/Generative/MetalCubes2.vue'
import SimplexCached from '@/views/Generative/SimplexCached/SimplexCached.vue'
import SimplexWorker from '@/views/Generative/SimplexWorker/SimplexWorker.vue'

// Games
import ChickRun from '@/views/Games/ChickRun.vue'
import ForestGame from '@/views/Games/ForestGame/ForestGame.vue'
import GoombaRunner from '@/views/Games/GoombaRunner/GoombaRunner.vue'

// Experiments
import CameraPresets from '@/views/Experiments/CameraPresets.vue'
import ComplexAnimation from '@/views/Experiments/ComplexAnimation.vue'
import EarthGazer from '@/views/Experiments/EarthGazer.vue'
import EarthView from '@/views/Experiments/EarthView.vue'
import MaterialsList from '@/views/Experiments/MaterialsList.vue'
import ModelAnimation from '@/views/Experiments/ModelAnimation.vue'
import MoonTwo from '@/views/Experiments/MoonTwo.vue'
import MoonView from '@/views/Experiments/MoonView.vue'
import PhysicBall from '@/views/Experiments/PhysicBall.vue'
import PhysicBasic from '@/views/Experiments/PhysicBasic.vue'
import PhysicExamples from '@/views/Experiments/PhysicExamples.vue'
import PhysicFluid from '@/views/Experiments/PhysicFluid.vue'
import ThreejsExampleController from '@/views/Experiments/ThreejsExampleController.vue'
import ThreejsExampleControllerTools from '@/views/Experiments/ThreejsExampleControllerTools.vue'
import TimelineGame from '@/views/Experiments/TimelineGame.vue'

/**
 * Test cases organized by category
 */
const testCases = [
  // Tools
  { component: GrassGenerator, name: 'GrassGenerator', category: 'Tools' },
  { component: MixamoPlayground, name: 'MixamoPlayground', category: 'Tools' },
  { component: ModelLoader, name: 'ModelLoader', category: 'Tools' },
  { component: ToolsTest, name: 'ToolsTest', category: 'Tools' },

  // Generative
  { component: CubeMatrix, name: 'CubeMatrix', category: 'Generative' },
  { component: CubeMatrix2, name: 'CubeMatrix2', category: 'Generative' },
  { component: CubeMatrixThreejs, name: 'CubeMatrixThreejs', category: 'Generative' },
  { component: CubeSequences, name: 'CubeSequences', category: 'Generative' },
  { component: CubeShift, name: 'CubeShift', category: 'Generative' },
  { component: FallingView, name: 'FallingView', category: 'Generative' },
  { component: LineMatrixMouse, name: 'LineMatrixMouse', category: 'Generative' },
  { component: MetalCubes, name: 'MetalCubes', category: 'Generative' },
  { component: MetalCubes2, name: 'MetalCubes2', category: 'Generative' },
  { component: SimplexCached, name: 'SimplexCached', category: 'Generative' },
  { component: SimplexWorker, name: 'SimplexWorker', category: 'Generative' },

  // Games
  { component: ChickRun, name: 'ChickRun', category: 'Games' },
  { component: ForestGame, name: 'ForestGame', category: 'Games' },
  { component: GoombaRunner, name: 'GoombaRunner', category: 'Games' },

  // Experiments
  { component: CameraPresets, name: 'CameraPresets', category: 'Experiments' },
  { component: ComplexAnimation, name: 'ComplexAnimation', category: 'Experiments' },
  { component: EarthGazer, name: 'EarthGazer', category: 'Experiments' },
  { component: EarthView, name: 'EarthView', category: 'Experiments' },
  { component: MaterialsList, name: 'MaterialsList', category: 'Experiments' },
  { component: ModelAnimation, name: 'ModelAnimation', category: 'Experiments' },
  { component: MoonTwo, name: 'MoonTwo', category: 'Experiments' },
  { component: MoonView, name: 'MoonView', category: 'Experiments' },
  { component: PhysicBall, name: 'PhysicBall', category: 'Experiments' },
  { component: PhysicBasic, name: 'PhysicBasic', category: 'Experiments' },
  { component: PhysicExamples, name: 'PhysicExamples', category: 'Experiments' },
  { component: PhysicFluid, name: 'PhysicFluid', category: 'Experiments' },
  { component: ThreejsExampleController, name: 'ThreejsExampleController', category: 'Experiments' },
  { component: ThreejsExampleControllerTools, name: 'ThreejsExampleControllerTools', category: 'Experiments' },
  { component: TimelineGame, name: 'TimelineGame', category: 'Experiments' },
]

/**
 * Visual Regression Tests
 *
 * These tests verify that Vue components with 3D scenes load and render correctly.
 * Each test:
 * 1. Mounts the component with required dependencies (Pinia, Vue Router)
 * 2. Waits for the Three.js scene to initialize (3 seconds + animation frames)
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
 * src/views/__screenshots__/visual-regression.browser.test.ts/Visual-Regression----{category}---{name}--should-render-{name}-correctly-1.png
 */
describe.each(testCases)('Visual Regression -- $category - $name', ({ component, name }) => {
  it(`should render ${name} correctly`, async () => {
    let wrapper: any

    try {
      // Create required dependencies
      const pinia = createPinia()
      const router = createRouter({
        history: createMemoryHistory(),
        routes: [{
          path: '/',
          component
        }]
      })

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
  }, 15000) // Increased timeout to 15 seconds per test
})
