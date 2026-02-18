import * as THREE from "three";
import type RAPIER from '@dimforge/rapier3d-compat';
import type { Timeline } from '@webgamekit/animation';

export interface VisualizerSetup {
  setup: (scene: THREE.Scene, world?: RAPIER.World) => Promise<Record<string, any>> | Record<string, any>;
  getTimeline: (getObjects: () => Record<string, any>) => Timeline[];
  handleClick?: (event: MouseEvent, camera: THREE.Camera, canvas: HTMLCanvasElement, visualizerObjects: Record<string, any>) => void;
  song?: number;
  name: string;
  camera?: {
    position?: [number, number, number];
    rotation?: [number, number, number];
  };
}

// Click handler management
let currentClickHandler: ((event: MouseEvent | TouchEvent) => void) | null = null;
let currentCanvas: HTMLCanvasElement | null = null;

// Setup click and touch handlers for the current visualizer
export const setupVisualizerClickHandlers = (
  visualizer: VisualizerSetup | null,
  camera: THREE.Camera,
  canvas: HTMLCanvasElement,
  visualizerObjects: Record<string, any>
) => {
  // Clear existing handlers first
  clearVisualizerClickHandlers();

  // Store canvas reference
  currentCanvas = canvas;

  // Setup new handler if visualizer supports it
  if (visualizer && visualizer.handleClick) {
    currentClickHandler = (event: MouseEvent | TouchEvent) => {
      // Prevent default touch behavior
      if (event.type === 'touchstart') {
        event.preventDefault();
        // Use the first touch point for touch events
        const touchEvent = event as TouchEvent;
        if (touchEvent.touches.length > 0) {
          const touch = touchEvent.touches[0];
          // Create a synthetic mouse event from touch
          const mouseEvent = {
            clientX: touch.clientX,
            clientY: touch.clientY,
            type: 'click'
          } as MouseEvent;
          visualizer.handleClick!(mouseEvent, camera, canvas, visualizerObjects);
        }
      } else {
        // Handle regular mouse click
        visualizer.handleClick!(event as MouseEvent, camera, canvas, visualizerObjects);
      }
    };

    // Add event listeners
    canvas.addEventListener("click", currentClickHandler);
    canvas.addEventListener("touchstart", currentClickHandler, { passive: false });
  }
};

// Clear click and touch handlers
export const clearVisualizerClickHandlers = () => {
  if (currentClickHandler && currentCanvas) {
    currentCanvas.removeEventListener("click", currentClickHandler);
    currentCanvas.removeEventListener("touchstart", currentClickHandler);
  }
  currentClickHandler = null;
  currentCanvas = null;
};

// Dynamically import all visualizer modules
const visualizerModules = import.meta.glob('./visualizers/*.ts', { eager: true });

// Build visualizers object from imported modules
export const visualizers: Record<string, VisualizerSetup> = {};

/**
 * Export visualizers
 */
Object.entries(visualizerModules).forEach(([path, module]) => {
  const fileName = path.replace('./visualizers/', '').replace('.ts', '');
  const moduleExports = module as Record<string, any>;
  const visualizerExport = Object.values(moduleExports).find(
    (exp: any) => exp && typeof exp === 'object' && exp.name && exp.setup && exp.getTimeline
  );
  
  if (visualizerExport) {
    visualizers[fileName] = visualizerExport as VisualizerSetup;
  }
});

export const getVisualizerNames = (): string[] => {
  return Object.keys(visualizers);
};

export const getVisualizer = (name: string): VisualizerSetup => {
  return visualizers[name];
};
