import * as THREE from "three";
import { barsVisualizer } from "./bars";
import { particlesVisualizer } from "./particles";
import { cubesVisualizer } from "./cubes";
import { terrainVisualizer } from "./terrain";

export interface VisualizerSetup {
  setup: (scene: THREE.Scene) => Record<string, any>;
  animate: (objects: Record<string, any>) => void;
  song: number;
  name: string;
}

export const visualizers: Record<string, VisualizerSetup> = {
  bars: barsVisualizer,
  particles: particlesVisualizer,
  cubes: cubesVisualizer,
  terrain: terrainVisualizer
};

export const getVisualizerNames = (): string[] => {
  return Object.keys(visualizers);
};

export const getVisualizer = (name: string): VisualizerSetup | null => {
  return visualizers[name] || null;
};
