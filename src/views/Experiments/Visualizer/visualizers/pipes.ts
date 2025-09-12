import * as THREE from "three";
import { getAudioData } from "../audio";
import type { VisualizerSetup } from "../visualizer";

export const boxVisualizer: VisualizerSetup = {
  name: "Glass Pipes",
  song: 0,

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

    // Create glass material for the cube
    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.1,        // Increased from 0.1 to make it more visible
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

    const tubeRadius = 6;
    // Create the curved pipes
    const pipe1 = new THREE.Mesh(
      new THREE.TorusGeometry(8, tubeRadius, 16, 32, Math.PI),
      glassMaterial
    );
    pipe1.position.set(-10, 0, 0);
    pipe1.rotation.y = Math.PI / 2; // Opening faces towards positive Z (right side opening towards center)
    scene.add(pipe1);

    const pipe2 = new THREE.Mesh(
      new THREE.TorusGeometry(8, tubeRadius, 16, 32, Math.PI),
      glassMaterial
    );
    pipe2.position.set(10, 0, 0);
    pipe2.position.set(-10, -2, 0);
    pipe2.rotation.y = -Math.PI; // Opening faces towards negative Z (left side opening towards center)
    pipe2.rotation.z = -Math.PI; // Opening faces towards negative Z (left side opening towards center)
    scene.add(pipe2);

    // Create array of rotating spotlights around the pipes
    const radius = 50;
    const colors = [0xffffff, 0xff4444, 0x44ff44, 0x4444ff, 0xffff44, 0xff44ff];
    const spotLights = colors.map((color, i) => {
      const angle = (i / colors.length) * Math.PI * 2;
      const height = Math.sin(i) * 20 + 30; // Vary height for each light
      
      const spotLight = new THREE.SpotLight(color, 60);
      spotLight.position.set(
        Math.cos(angle) * radius,
        height,
        Math.sin(angle) * radius
      );
      // Target the center point between the two pipes
      spotLight.target.position.set(0, 0, 0);
      spotLight.angle = Math.PI / 5;
      spotLight.penumbra = 0.3;
      spotLight.decay = 2;
      spotLight.distance = 150;
      spotLight.castShadow = true;
      
      scene.add(spotLight);
      scene.add(spotLight.target); // Add the target to the scene
      return spotLight; // Return the spotLight object
    });

    // Add subtle ambient light
    const ambientLight = new THREE.AmbientLight(0x222244, 0.2);
    scene.add(ambientLight);
    
    return { 
      pipe1,
      pipe2,
      backgroundSphere, 
      spotLights,
      ambientLight
    };
  },

  animate: (objects: Record<string, any>) => {
    const { pipe1, pipe2, backgroundSphere, spotLights } = objects;
    
    const audioData = getAudioData();
    const sum = audioData.reduce((a: number, b: number) => a + b, 0);
    const average = sum / audioData.length;
    
    // Scale the pipes based on audio with more dramatic effect
    const scale = 1 + (average * 3);
    if (pipe1) {
      pipe1.scale.setScalar(scale);
      // No rotation - pipes remain stationary
    }
    
    if (pipe2) {
      pipe2.scale.setScalar(scale);
      // No rotation - pipes remain stationary
    }
    
    // Animate background rotation
    if (backgroundSphere) {
      backgroundSphere.rotation.y += 0.0005;
    }
    
    // Animate rotating spotlights
    if (spotLights && Array.isArray(spotLights)) {
      const time = Date.now() * 0.001;
      const radius = 50;
      
      spotLights.forEach((light: THREE.SpotLight, index: number) => {
        if (!light || !light.position) return; // Safety check
        
        // Rotate lights around the pipes
        const rotationSpeed = 0.5 + (index * 0.1); // Different speeds for each light
        const angle = (index / spotLights.length) * Math.PI * 2 + (time * rotationSpeed);
        const heightOffset = Math.sin(time + index) * 10;
        
        light.position.set(
          Math.cos(angle) * radius,
          30 + heightOffset,
          Math.sin(angle) * radius
        );
        
        // Animate light intensity based on audio
        light.intensity = 40 + (average * 80) + Math.sin(time * 2 + index) * 20;
        
        // Keep lights pointing at the center between pipes
        light.target.position.set(0, 0, 0);
      });
    }
    
    // Animate material properties of both pipes based on audio
    if (pipe1 && pipe1.material) {
      const material1 = pipe1.material as THREE.MeshPhysicalMaterial;
      material1.transmission = 0.6 + (average * 0.3);
      material1.opacity = 0.2 + (average * 0.4);
      material1.roughness = 0.02 + (average * 0.08);
    }
    
    if (pipe2 && pipe2.material) {
      const material2 = pipe2.material as THREE.MeshPhysicalMaterial;
      material2.transmission = 0.6 + (average * 0.3);
      material2.opacity = 0.2 + (average * 0.4);
      material2.roughness = 0.02 + (average * 0.08);
    }
  }
};
