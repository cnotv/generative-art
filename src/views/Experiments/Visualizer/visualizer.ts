import * as THREE from "three";
import type RAPIER from '@dimforge/rapier3d';

export interface VisualizerSetup {
  setup: (scene: THREE.Scene, world?: RAPIER.World) => Promise<Record<string, any>> | Record<string, any>;
  animate: (objects: Record<string, any>) => void;
  song?: number;
  name: string;
}

// Dynamically import all visualizer modules
const visualizerModules = import.meta.glob('./visualizers/*.ts', { eager: true });

// Build visualizers object from imported modules
export const visualizers: Record<string, VisualizerSetup> = {};

Object.entries(visualizerModules).forEach(([path, module]) => {
  // Extract filename without extension (e.g., './bars.ts' -> 'bars')
  const fileName = path.replace('./visualizers/', '').replace('.ts', '');
  
  // Look for exported visualizer (usually named like 'barsVisualizer')
  const moduleExports = module as Record<string, any>;
  const visualizerExport = Object.values(moduleExports).find(
    (exp: any) => exp && typeof exp === 'object' && exp.name && exp.setup && exp.animate
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
