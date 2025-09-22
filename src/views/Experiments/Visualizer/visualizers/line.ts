import * as THREE from "three";
import { getAudioData } from "../audio";
import type { VisualizerSetup } from "../visualizer";

const config = {
  barCount: 30,
  width: 40,
  height: 20,
  lineWidth: 2,
};

export const lineSpectrumVisualizer: VisualizerSetup = {
  name: "Line Spectrum",
  song: 0,
  camera: {
    position: [0, 0, 25],
  },

  setup: (scene: THREE.Scene) => {
    // Create line geometry for spectrum
    const points: THREE.Vector3[] = [];
    for (let i = 0; i < config.barCount; i++) {
      const x = (i / (config.barCount - 1)) * config.width - config.width / 2;
      points.push(new THREE.Vector3(x, 0, 0));
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      linewidth: config.lineWidth,
    });

    const line = new THREE.Line(geometry, material);
    scene.add(line);

    return { line, points };
  },

  animate: (objects: Record<string, any>) => {
    const { line, points } = objects;
    if (!line || !points) return;

    const audioData = getAudioData();
    
    // Update line points based on audio data
    for (let i = 0; i < config.barCount && i < audioData.length; i++) {
      const x = (i / (config.barCount - 1)) * config.width - config.width / 2;
      const y = audioData[i] * config.height - config.height / 2;
      points[i].set(x, y, 0);
    }

    // Update geometry
    line.geometry.setFromPoints(points);
    line.geometry.attributes.position.needsUpdate = true;
  },
};
