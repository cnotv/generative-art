import * as THREE from "three";
import { getAudioData } from "../audio";
import type { VisualizerSetup } from "../visualizer";

// Configuration for frequency ranges
const FREQUENCY_CONFIG = [
  { name: 'bass', color: 0xff0000, position: -10 },
  { name: 'mid', color: 0x00ff00, position: 0 },
  { name: 'treble', color: 0x0000ff, position: 10 }
] as const;

const CIRCLES_PER_RANGE = 8;

export const frequencyCirclesVisualizer: VisualizerSetup = {
  name: "Frequency Circles",
  
  setup: (scene: THREE.Scene) => {
    const frequencyCircles: THREE.Mesh[][] = [];

    // Create circles for each frequency range
    FREQUENCY_CONFIG.forEach((config) => {
      const circles: THREE.Mesh[] = [];
      for (let i = 0; i < CIRCLES_PER_RANGE; i++) {
        const circleGeometry = new THREE.RingGeometry(2 + i * 0.5, 2.2 + i * 0.5, 16);
        const circleMaterial = new THREE.MeshBasicMaterial({ 
          color: config.color,
          transparent: true,
          opacity: 0.3,
          side: THREE.DoubleSide
        });
        const circle = new THREE.Mesh(circleGeometry, circleMaterial);
        circle.position.set(config.position, 0, -5);
        circle.rotation.x = -Math.PI / 2;
        scene.add(circle);
        circles.push(circle);
      }
      frequencyCircles.push(circles);
    });

    return { frequencyCircles };
  },

  animate: ({ frequencyCircles }: Record<string, any>) => {
    if (!frequencyCircles) return;
    
    const audioData = getAudioData();

    // Animate circles for each frequency range
    FREQUENCY_CONFIG.forEach((config, rangeIndex) => {
      const circles = frequencyCircles[rangeIndex];

      // Animate circles with frequency data
      const startIndex = rangeIndex * CIRCLES_PER_RANGE;
      const endIndex = startIndex + CIRCLES_PER_RANGE;
      const rangeData = audioData.slice(startIndex, endIndex);

      circles.forEach((circle: THREE.Mesh, circleIndex: number) => {
        const circleFrequency = rangeData[circleIndex] || 0;
        const scale = 1 + circleFrequency * 2;
        circle.scale.set(scale, scale, 1);
        
        (circle.material as THREE.MeshBasicMaterial).opacity = 0.2 + circleFrequency * 0.5;
        
        // Different rotation patterns for variety
        const rotationSpeed = 0.01 + circleFrequency * 0.05;
        circle.rotation.z += rangeIndex === 1 ? rotationSpeed : -rotationSpeed;
      });
    });
  }
};