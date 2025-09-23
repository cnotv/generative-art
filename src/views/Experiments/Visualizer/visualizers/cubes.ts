import * as THREE from "three";
import { getAudioData, getFrequencyRanges } from "../audio";
import type { VisualizerSetup } from "../visualizer";

const config = {
  cubeCount: 50,
  cubeSize: 2,
  spawnRadius: 30,
  maxSpeed: 5,
  rotationSpeed: 0.02,
};

export const cubesVisualizer: VisualizerSetup = {
  name: "Cubes",
  song: 0,

  setup: (scene: THREE.Scene) => {
    const cubes: THREE.Mesh[] = [];
    const velocities: THREE.Vector3[] = [];
    
    // Create cubes with random positions and velocities
    for (let i = 0; i < config.cubeCount; i++) {
      const cubeGeometry = new THREE.BoxGeometry(
        config.cubeSize,
        config.cubeSize,
        config.cubeSize
      );
      
      const cubeMaterial = new THREE.MeshLambertMaterial({
        color: new THREE.Color().setHSL(Math.random(), 1, 0.5)
      });
      
      const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
      
      // Random position within spawn radius
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const radius = Math.random() * config.spawnRadius;
      
      cube.position.set(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta)
      );
      
      // Random rotation
      cube.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      );
      
      // Random velocity
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * config.maxSpeed,
        (Math.random() - 0.5) * config.maxSpeed,
        (Math.random() - 0.5) * config.maxSpeed
      );
      
      cubes.push(cube);
      velocities.push(velocity);
      scene.add(cube);
    }
    
    return { cubes, velocities };
  },

  getTimeline: (getObjects: () => Record<string, any>) => [{
    action: () => {
      const objects = getObjects();
      const { cubes, velocities } = objects;
      if (!cubes || !velocities) return;
      
      const audioData = getAudioData();
      const frequencyRanges = getFrequencyRanges();
      const time = Date.now() * 0.001;
      
      // Calculate audio intensity
      const audioLevel = audioData.reduce((sum, val) => sum + val, 0) / audioData.length;
      const bassBoost = frequencyRanges.bass * 5;
      const midBoost = frequencyRanges.mid * 3;
      
      // Hide all cubes if there's no audio activity
      const hasAudio = audioLevel > 0.01; // Threshold for detecting audio
      
      cubes.forEach((cube: THREE.Mesh, index: number) => {
        // Hide cube if no audio
        cube.visible = hasAudio;
        
        if (!hasAudio) {
          return; // Skip animation if no audio
        }
        
        const velocity = velocities[index];
        
        // Apply movement based on velocity
        cube.position.add(velocity.clone().multiplyScalar(0.1));
        
        // Add audio-reactive movement
        const audioInfluence = audioLevel * 2;
        const direction = cube.position.clone().normalize();
        cube.position.add(direction.multiplyScalar(audioInfluence));
        
        // Continuous rotation
        cube.rotation.x += config.rotationSpeed + bassBoost * 0.05;
        cube.rotation.y += config.rotationSpeed + midBoost * 0.03;
        cube.rotation.z += config.rotationSpeed + audioLevel * 0.02;
        
        // Audio-reactive scaling
        const scale = 1 + audioLevel * 0.5 + bassBoost * 0.3;
        cube.scale.setScalar(scale);
        
        // Update color based on audio
        const material = cube.material as THREE.MeshLambertMaterial;
        const hue = (time * 0.1 + index * 0.1) % 1;
        const lightness = 0.3 + audioLevel * 0.7;
        material.color.setHSL(hue, 1, lightness);
        
        // Boundary checking - respawn cubes that go too far
        const maxDistance = config.spawnRadius * 2;
        if (cube.position.length() > maxDistance) {
          // Reset position to origin area
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.random() * Math.PI;
          const radius = Math.random() * config.spawnRadius * 0.5;
          
          cube.position.set(
            radius * Math.sin(phi) * Math.cos(theta),
            radius * Math.cos(phi),
            radius * Math.sin(phi) * Math.sin(theta)
          );
          
          // Reset velocity
          velocity.set(
            (Math.random() - 0.5) * config.maxSpeed,
            (Math.random() - 0.5) * config.maxSpeed,
            (Math.random() - 0.5) * config.maxSpeed
          );
        }
        
        // Add some gravitational pull towards center when audio is low
        if (audioLevel < 0.1) {
          const centerPull = cube.position.clone().normalize().multiplyScalar(-0.02);
          velocity.add(centerPull);
        }
        
        // Damping to prevent infinite acceleration
        velocity.multiplyScalar(0.99);
      });
    }
  }],
};
