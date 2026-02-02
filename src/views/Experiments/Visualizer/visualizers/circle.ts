import * as THREE from "three";
import { getAudioData } from "../audio";
import type { VisualizerSetup } from "../visualizer";

const config = {
  barCount: 32,
  radius: 6,
  maxRadius: 8,
  lineWidth: 0.1, // Tube radius
};

export const lineSpectrumVisualizer: VisualizerSetup = {
  name: "Circle",
  song: 0,
  camera: {
    position: [0, 0, 25],
  },

  setup: (scene: THREE.Scene) => {
    // Create points for the circular spectrum
    const points: THREE.Vector3[] = [];
    for (let i = 0; i < config.barCount; i++) {
      const angle = (i / config.barCount) * Math.PI * 2;
      const x = Math.cos(angle) * config.radius;
      const y = Math.sin(angle) * config.radius;
      points.push(new THREE.Vector3(x, y, 0));
    }
    // Close the circle by adding the first point again
    points.push(points[0].clone());

    // Create curve from points
    const curve = new THREE.CatmullRomCurve3(points, true); // closed curve
    // Create tube geometry for thick line
    const geometry = new THREE.TubeGeometry(curve, config.barCount, config.lineWidth, 8, true);
    const material = new THREE.MeshBasicMaterial({ 
      color: 0xffffff,
      wireframe: false 
    });

    const line = new THREE.Mesh(geometry, material);
    scene.add(line);

    return { line, points, curve };
  },

  getTimeline: (getObjects: () => Record<string, any>) => [{
    action: () => {
      const objects = getObjects();
      const { line, points, curve } = objects;
      if (!line || !points || !curve) return;

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

      // Update curve with new points
      curve.points = points;
      // Recreate tube geometry with updated curve
      const newGeometry = new THREE.TubeGeometry(curve, config.barCount, config.lineWidth, 8, true);
      line.geometry.dispose();
      line.geometry = newGeometry;
    }
  }],
};
