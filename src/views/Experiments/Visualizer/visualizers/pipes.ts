import * as THREE from "three";
import { getAudioData } from "../audio";
import type { VisualizerSetup } from "../visualizer";

export const boxVisualizer: VisualizerSetup = {
  name: "Glass Pipes",
  song: 2,
  camera: {
    position: [0, 80, 160]
  },

  setup: (scene: THREE.Scene) => {
    // Create dark ambient environment
    scene.background = new THREE.Color(0x111111);
    
    // Function to create a complete pipe with end caps
    const createPipe = (position: CoordinateTuple, rotation: CoordinateTuple) => {
      const size = 8; // Reduced size for the grid
      const tubeRadius = size * 0.8;
      
      // Create glass material for the pipes
      const glassMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transmission: 0.7,
        roughness: 0.05,
        metalness: 0.0,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
        ior: 1.5,
        thickness: 0.5,
        envMapIntensity: 2.0,
        reflectivity: 0.9,
        side: THREE.DoubleSide
      });
      
      // Create the curved half-torus
      const halfTorus = new THREE.Mesh(
        new THREE.TorusGeometry(size, tubeRadius, 2 * size, 4 * size, Math.PI),
        glassMaterial
      );
      halfTorus.position.set(...position);
      halfTorus.rotation.set(...rotation);
      
      // Create half spheres for pipe ends (bottom half only)
      const sphereGeometry = new THREE.SphereGeometry(tubeRadius, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
      
      // Calculate end positions based on pipe position and rotation
      const endCap1 = new THREE.Mesh(sphereGeometry, glassMaterial);
      endCap1.position.set(position[0], position[1], position[2] + size);
      endCap1.rotation.set(rotation[0] + Math.PI * 2, rotation[1], rotation[2]);
      
      const endCap2 = new THREE.Mesh(sphereGeometry, glassMaterial);
      endCap2.position.set(position[0], position[1], position[2] - size);
      endCap2.rotation.set(rotation[0] - Math.PI * 2, rotation[1], rotation[2]);
      
      // Group all pipe components together
      const pipe = new THREE.Group();
      pipe.add(halfTorus);
      pipe.add(endCap1);
      pipe.add(endCap2);

      pipe.rotateOnAxis(new THREE.Vector3(0, 1, 0), Math.PI / 2); // Face camera
      
      scene.add(pipe);
      
      return { pipe, halfTorus, endCap1, endCap2 };
    };
    
    // Create 10x10 grid of pipes
    const pipes: THREE.Group[] = [];
    const gridSize = 20;
    const spacingY = 22; // Distance between pipes
    const spacingZ = 30; // Distance between pipes
    // const startX = -(gridSize - 1) * spacing / 2;
    const startZ = -(gridSize - 1) * spacingZ / 2;
    const startY = -(gridSize - 1) * spacingY / 2;
    
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const x = 0;
        // const x = startX + col * spacing;
        const z = startZ + row * spacingZ;
        const y = startY + col * spacingY;
        // const y = 0;
        
        // Alternate orientations in a checkerboard pattern
        const isEven = (row + col) % 2 === 0;
        const rotation: CoordinateTuple = isEven 
          ? [0, Math.PI / 2, 0]     // Horizontal orientation
          : [Math.PI, Math.PI / 2, 0];    // Vertical orientation

        const pipeInstance = createPipe([x, isEven ? y - 8 : y, z], rotation);
        pipes.push(pipeInstance.pipe);
      }
    }
    
    // Add subtle ambient light
    const ambientLight = new THREE.AmbientLight(0x222244, 0.2);
    scene.add(ambientLight);
    
    return { 
      pipes,
      ambientLight
    };
  },

  animate: (objects: Record<string, any>) => {
    const { pipes, backgroundSphere } = objects;
    
    const audioData = getAudioData();
    const sum = audioData.reduce((a: number, b: number) => a + b, 0);
    const average = sum / audioData.length;

    // Animate background rotation
    if (backgroundSphere) {
      backgroundSphere.rotation.y += 0.0005;
    }
  }
};
