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

/**
 * Routes clicks and touches on the canvas to the current visualiser, replacing any previous
 * handlers.
 * @param visualizer The visualiser to receive input, or null for none
 * @param camera The camera clicks are projected through
 * @param canvas The canvas to listen on
 * @param visualizerObjects The objects the visualiser can hit
 */
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

/**
 * Removes the click and touch handlers `setupVisualizerClickHandlers` added.
 */
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

/**
 * Names of every registered visualiser, for the picker.
 * @returns The visualiser names
 */
export const getVisualizerNames = (): string[] => {
  return Object.keys(visualizers)
}

/**
 * Looks up a visualiser by name.
 * @param name A name from `getVisualizerNames`
 * @returns The visualiser's setup
 */
export const getVisualizer = (name: string): VisualizerSetup => {
  return visualizers[name]
}
