import * as THREE from "three";
import { getAudioData } from "../audio";
import type { VisualizerSetup } from "../visualizer";

const config = {
  barCount: 32,
  radius: 12,
  maxRadius: 8,
  lineWidth: 2,
};

export const lineSpectrumVisualizer: VisualizerSetup = {
  name: "Circle",
  song: 0,
  camera: {
    position: [0, 0, 25],
  },

  setup: (scene: THREE.Scene) => {
    // Create line geometry for circular spectrum
    const points: THREE.Vector3[] = [];
    for (let i = 0; i < config.barCount; i++) {
      // Arrange points in a circle
      const angle = (i / config.barCount) * Math.PI * 2;
      const x = Math.cos(angle) * config.radius;
      const y = Math.sin(angle) * config.radius;
      points.push(new THREE.Vector3(x, y, 0));
    }

    // Close the circle by adding the first point again
    points.push(points[0].clone());

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
    
    // Update circular points based on audio data
    for (let i = 0; i < config.barCount && i < audioData.length; i++) {
      const angle = (i / config.barCount) * Math.PI * 2;
      // Base radius plus audio-reactive extension
      const radius = config.radius + (audioData[i] * config.maxRadius);
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      points[i].set(x, y, 0);
    }

    // Update the closing point to match the first point
    if (points.length > config.barCount) {
      points[config.barCount].copy(points[0]);
    }

    // Update geometry
    line.geometry.setFromPoints(points);
    line.geometry.attributes.position.needsUpdate = true;
  },
};
