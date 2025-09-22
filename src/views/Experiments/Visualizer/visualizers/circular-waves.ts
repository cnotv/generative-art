import * as THREE from "three";
import { getAudioData } from "../audio";
import type { VisualizerSetup } from "../visualizer";

const config = {
  barCount: 30,
  radius: 15,
  barWidth: 1.2,
  maxHeight: 8,
};

export const circularSpectrumVisualizer: VisualizerSetup = {
  name: "Circular waves",
  song: 0,
  camera: {
    position: [0, 40, 0],
  },

  setup: (scene: THREE.Scene) => {
    const bars: THREE.Mesh[] = [];

    for (let i = 0; i < config.barCount; i++) {
      const barGeometry = new THREE.BoxGeometry(
        config.barWidth,
        1,
        config.barWidth
      );
      const barMaterial = new THREE.MeshBasicMaterial();
      const bar = new THREE.Mesh(barGeometry, barMaterial);

      // Position bars in a circle
      const angle = (i / config.barCount) * Math.PI * 2;
      const x = Math.cos(angle) * config.radius;
      const z = Math.sin(angle) * config.radius;
      
      bar.position.set(x, 0, z);
      bar.lookAt(0, 0, 0); // Face inward

      scene.add(bar);
      bars.push(bar);
    }

    return { bars };
  },

  animate: (objects: Record<string, any>) => {
    const { bars } = objects;
    if (!bars) return;

    const audioData = getAudioData();

    bars.forEach((bar: THREE.Mesh, index: number) => {
      const height = 1 + (audioData[index] || 0) * config.maxHeight;
      bar.scale.y = height;
      bar.position.y = height / 2;
    });

    // Rotate the whole visualization
    bars.forEach((bar: THREE.Mesh, index: number) => {
      const angle = (index / config.barCount) * Math.PI * 2 + Date.now() * 0.0002;
      const x = Math.cos(angle) * config.radius;
      const z = Math.sin(angle) * config.radius;
      bar.position.x = x;
      bar.position.z = z;
      bar.lookAt(0, bar.position.y, 0);
    });
  },
};
