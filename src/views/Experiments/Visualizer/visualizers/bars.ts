import * as THREE from "three";
import { getAudioData } from "../audio";
import type { VisualizerSetup } from "../visualizer";

const config = {
  barCount: 32,
  barWidth: 2,
  barSpacing: 3,
  maxHeight: 20,
};

export const barsVisualizer: VisualizerSetup = {
  name: "Bars",
  song: 0,

  setup: (scene: THREE.Scene) => {
    // Create visualizer bars and return them
    const bars = Array.from(
      { length: config.barCount },
      (_, i) => {
        const barGeometry = new THREE.BoxGeometry(
          config.barWidth,
          1,
          config.barWidth
        );
        const barMaterial = new THREE.MeshLambertMaterial();
        const bar = new THREE.Mesh(barGeometry, barMaterial);

        // Position bars in a line
        const x = (i - config.barCount / 2) * config.barSpacing;
        bar.position.set(x, 0.5, 0);

        scene.add(bar);
        return bar;
      }
    );
    
    return { bars };
  },

  getTimeline: (getObjects: () => Record<string, any>) => [{
    action: () => {
      const objects = getObjects();
      const { bars } = objects;
      if (!bars) return;
      
      const audioData = getAudioData();

      // Update bar heights based on audio data
      bars.forEach((bar: THREE.Mesh, index: number) => {
        const height = 1 + audioData[index] * config.maxHeight;
        bar.scale.y = height;
        bar.position.y = height / 2;
      });
    }
  }],
};
