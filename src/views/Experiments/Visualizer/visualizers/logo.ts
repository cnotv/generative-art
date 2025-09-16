import * as THREE from "three";
import { getAudioData } from "../audio";
import type { VisualizerSetup } from "../visualizer";
import { getModel } from "@/utils/threeJs";
import type RAPIER from "@dimforge/rapier3d";
import streetBg from '@/assets/street2_blur.jpg';

const scale = 3
export const boxVisualizer: VisualizerSetup = {
  name: "Logo",
  song: 1,

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
      hasGravity: false,
      castShadow: true,
      color: 0x333333,
      material: true,
      transmission: 0.7,
      roughness: 0.5,
      opacity: 1,
      metalness: 0.5,
      reflectivity: 1,
    });

    return { logo };
  },

  animate: ({ logo }: Record<string, any>) => {
    if (!logo) return;
    const audioData = getAudioData();
    const sum = audioData.reduce((a: number, b: number) => a + b, 0);
    const average = (sum / audioData.length) * 3; // Amplify audio data by 3x
    const side = average + 1 * scale;
    const tiltAmplitude = 3;
    
    // Scale based on audio
    logo.mesh.scale.x = side;
    logo.mesh.scale.y = side;
    logo.mesh.scale.z = side;
    
    // Headbanging effect - tilt forward/backward based on audio intensity
    const headbangIntensity = 0.3;
    const headbangSpeed = 0.000001 + (average * 0.000000000005); // Base speed + audio-reactive speed
    const headbangTilt = Math.sin(Date.now() * headbangSpeed) * average * headbangIntensity;
    logo.mesh.rotation.x = Math.PI / 6 + headbangTilt;
    
    // Side rotation - subtle left/right rotation based on audio frequencies
    const rotationIntensity = 3 * 0.01;
    const sideRotationSpeed = (0.00001 + (average * 0.003)) * 0.0000000000001; // Base speed + audio-reactive speed
    const lowFreq = (audioData.slice(0, audioData.length / tiltAmplitude).reduce((a: number, b: number) => a + b, 0) / (audioData.length / tiltAmplitude)) * tiltAmplitude; // Amplify low freq
    const highFreq = (audioData.slice(audioData.length * 2 / tiltAmplitude).reduce((a: number, b: number) => a + b, 0) / (audioData.length / tiltAmplitude)) * tiltAmplitude; // Amplify high freq
    const rotationBalance = (highFreq - lowFreq) * rotationIntensity;
    const sideRotation = Math.sin(Date.now() * sideRotationSpeed) * rotationBalance;
    logo.mesh.rotation.z = sideRotation;
    
    // Optional: Add slight Y-axis rotation for more dynamic movement
    // logo.mesh.rotation.y += average * 0.01;
  }
};
