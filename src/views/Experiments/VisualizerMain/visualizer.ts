import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import type { Timeline } from '@webgamekit/animation'

export type VisualizerObjects = Record<string, unknown>

export interface VisualizerSetup {
  setup: (
    scene: THREE.Scene,
    world?: RAPIER.World
  ) => Promise<VisualizerObjects> | VisualizerObjects
  getTimeline: (getObjects: () => VisualizerObjects) => Timeline[]
  handleClick?: (
    event: MouseEvent,
    camera: THREE.Camera,
    canvas: HTMLCanvasElement,
    visualizerObjects: VisualizerObjects
  ) => void
  song?: number
  name: string
  camera?: {
    position?: [number, number, number]
    rotation?: [number, number, number]
  }
}

// Click handler management
const clickHandlerState = {
  currentClickHandler: null as ((event: MouseEvent | TouchEvent) => void) | null,
  currentCanvas: null as HTMLCanvasElement | null
}

// Setup click and touch handlers for the current visualizer
export const setupVisualizerClickHandlers = (
  visualizer: VisualizerSetup | null,
  camera: THREE.Camera,
  canvas: HTMLCanvasElement,
  visualizerObjects: VisualizerObjects
) => {
  clearVisualizerClickHandlers()

  clickHandlerState.currentCanvas = canvas

  if (visualizer && visualizer.handleClick) {
    clickHandlerState.currentClickHandler = (event: MouseEvent | TouchEvent) => {
      if (event.type === 'touchstart') {
        event.preventDefault()
        const touchEvent = event as TouchEvent
        if (touchEvent.touches.length > 0) {
          const touch = touchEvent.touches[0]
          const mouseEvent = {
            clientX: touch.clientX,
            clientY: touch.clientY,
            type: 'click'
          } as MouseEvent
          visualizer.handleClick!(mouseEvent, camera, canvas, visualizerObjects)
        }
      } else {
        visualizer.handleClick!(event as MouseEvent, camera, canvas, visualizerObjects)
      }
    }

    canvas.addEventListener('click', clickHandlerState.currentClickHandler)
    canvas.addEventListener('touchstart', clickHandlerState.currentClickHandler, { passive: false })
  }
}

// Clear click and touch handlers
export const clearVisualizerClickHandlers = () => {
  if (clickHandlerState.currentClickHandler && clickHandlerState.currentCanvas) {
    clickHandlerState.currentCanvas.removeEventListener(
      'click',
      clickHandlerState.currentClickHandler
    )
    clickHandlerState.currentCanvas.removeEventListener(
      'touchstart',
      clickHandlerState.currentClickHandler
    )
  }
  clickHandlerState.currentClickHandler = null
  clickHandlerState.currentCanvas = null
}

// Dynamically import all visualizer modules
const visualizerModules = import.meta.glob('./visualizers/*.ts', { eager: true })

// Build visualizers object from imported modules
export const visualizers: Record<string, VisualizerSetup> = {}

/**
 * Export visualizers
 */
Object.entries(visualizerModules).forEach(([path, module]) => {
  const fileName = path.replace('./visualizers/', '').replace('.ts', '')
  const moduleExports = module as Record<string, unknown>
  const visualizerExport = Object.values(moduleExports).find(
    (exp) =>
      exp &&
      typeof exp === 'object' &&
      (exp as VisualizerSetup).name &&
      (exp as VisualizerSetup).setup &&
      (exp as VisualizerSetup).getTimeline
  )

  if (visualizerExport) {
    visualizers[fileName] = visualizerExport as VisualizerSetup
  }
})

export const getVisualizerNames = (): string[] => {
  return Object.keys(visualizers)
}

export const getVisualizer = (name: string): VisualizerSetup => {
  return visualizers[name]
}
