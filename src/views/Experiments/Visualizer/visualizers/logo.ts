import * as THREE from "three";
import { getAudioData } from "../audio";
import type { VisualizerSetup } from "../visualizer";
import { getModel } from "@webgamekit/threejs";
import type RAPIER from "@dimforge/rapier3d-compat";
import streetBg from '@/assets/images/generic/street2_blur.jpg';

const scale = 3
export const boxVisualizer: VisualizerSetup = {
  name: "Logo",
  song: 1,
  camera: {
    position: [-30, 15, 32],
  },

  setup: async (scene: THREE.Scene, world?: RAPIER.World) => {
    if (!world) return {};
    
    const textureLoader = new THREE.TextureLoader();
    const bgTexture = textureLoader.load(streetBg);
    bgTexture.mapping = THREE.EquirectangularReflectionMapping;
    
    scene.background = bgTexture;
    
    const textureLoader2 = new THREE.TextureLoader();
    const bgTexture2 = textureLoader2.load(streetBg);
    bgTexture2.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = bgTexture2;

    const logo = await getModel(scene, world, "cnotv.glb", {
      scale: [scale, scale, scale],
      rotation: [Math.PI / 6, 0, 0],
      position: [-2, -5, 0],
      hasGravity: false,
      castShadow: true,
      color: 0x33_33_33,
      material: true,
      transmission: 0.7,
      roughness: 0.5,
      opacity: 1,
      metalness: 0.5,
      reflectivity: 1,
    });

    return { logo };
  },

  getTimeline: (getObjects: () => Record<string, any>) => [{
    action: () => {
      const objects = getObjects();
      const { logo } = objects;
      if (!logo) return;
      const audioData = getAudioData();
      const sensibility = 50;
      const sum = audioData.reduce((a: number, b: number) => a + b, 0);
      const audioMap = 0.000_000_002;
      const average = sum / audioData.length * audioMap;
      const speed = 0.005;
      // const speed = 0.005 + Math.abs(average);
      const amplitude = 0.4;
      const offset = 0.3;
      const tilt = Math.sin(Date.now() * speed * average) * amplitude + offset; // Create oscillation with sine wave
      const rotation = Math.PI / 3 +  Math.floor(tilt * sensibility) / sensibility
      
      logo.mesh.rotation.x = rotation;
    }
  }],

  // animate: ({ logo }: Record<string, any>) => {
  //   if (!logo) return;
  //   const audioData = getAudioData();
  //   const sensibility = 20;
  //   const sum = audioData.reduce((a: number, b: number) => a + b, 0);
  //   const average = (sum / audioData.length) * 3;
  //   const speed = (average * 0.000000000002);
  //   const amplitude = 0.7;
  //   const tilt = Math.sin(Date.now() * speed) * amplitude;
  //   const rotation = Math.PI / 3 +  Math.floor(Math.PI / 6 + tilt * sensibility) / sensibility
    
  //   logo.mesh.rotation.x = rotation;
  // }
};
