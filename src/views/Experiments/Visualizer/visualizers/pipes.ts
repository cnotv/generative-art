import * as THREE from "three";
import { getAudioData } from "../audio";
import type { VisualizerSetup } from "../visualizer";

export const boxVisualizer: VisualizerSetup = {
  name: "Glass Pipes",
  song: 0,
  camera: {
    position: [0, 40, 80]
  },

  setup: (scene: THREE.Scene) => {
    // Create dark ambient environment
    scene.background = new THREE.Color(0x111111);
    scene.fog = new THREE.Fog(0x111111, 50, 200);

    // Create a dark starfield background
    const backgroundGeometry = new THREE.SphereGeometry(100, 32, 32);
    const backgroundMaterial = new THREE.MeshBasicMaterial({
      color: 0x111122,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.5
    });
    const backgroundSphere = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
    scene.add(backgroundSphere);
    
    // Function to create a complete pipe with end caps
    const createPipe = (position: CoordinateTuple, rotation: CoordinateTuple) => {
    const size = 8;
      const tubeRadius = size * 0.8;
      
    // Create glass material for the cube
    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      // transparent: true,
      // opacity: 0.1,        // Increased from 0.1 to make it more visible
      transmission: 0.7,   // Reduced from 0.9 to balance transparency and visibility
      roughness: 0.05,     // Slightly reduced for more reflection
      metalness: 0.0,      // Reduced to 0 for pure glass effect
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      ior: 1.5,
      thickness: 0.5,      // Reduced thickness for better transmission
      envMapIntensity: 2.0, // Increased for better reflections
      reflectivity: 0.9,   // Added reflectivity
      side: THREE.DoubleSide // Ensure both sides are rendered
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
      // For rotation.y = Math.PI / 2, the openings are at ±Z relative to the pipe center
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
      
      scene.add(pipe);
      
      return { pipe, halfTorus, endCap1, endCap2 };
    };
    
    // Create the main pipe
    const mainPipe = createPipe([-10, 0, 0], [0, Math.PI / 2, 0]);
    
    // Example: Create additional pipes (uncomment to use)
    // const pipe2 = createPipe([10, 0, 0], [0, -Math.PI / 2, 0]);  // Right side pipe
    // const pipe3 = createPipe([0, 10, 0], [Math.PI / 2, 0, 0]);   // Top pipe
    // const pipe4 = createPipe([0, -10, 0], [-Math.PI / 2, 0, 0]); // Bottom pipe

    // Add subtle ambient light
    const ambientLight = new THREE.AmbientLight(0x222244, 0.2);
    scene.add(ambientLight);
    
    return { 
      pipe: mainPipe.pipe,
      backgroundSphere, 
      ambientLight
    };
  },

  animate: (objects: Record<string, any>) => {
    const { pipe, backgroundSphere } = objects;
    
    const audioData = getAudioData();
    const sum = audioData.reduce((a: number, b: number) => a + b, 0);
    const average = sum / audioData.length;
    
    // Scale the pipe based on audio with more dramatic effect
    const scale = 1 + (average * 3);
    if (pipe) {
      pipe.scale.setScalar(scale);
      // No rotation - pipe remains stationary
    }
    
    // Animate background rotation
    if (backgroundSphere) {
      backgroundSphere.rotation.y += 0.0005;
    }
  }
};
