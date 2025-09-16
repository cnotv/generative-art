import * as THREE from "three";
import { getAudioData } from "../audio";
import type { VisualizerSetup } from "../visualizer";
import { getModel } from "@/utils/threeJs";
import type RAPIER from "@dimforge/rapier3d";

const scale = 3
export const boxVisualizer: VisualizerSetup = {
  name: "Logo",
  song: 1,

  setup: async (scene: THREE.Scene, world?: RAPIER.World) => {
    if (!world) return {};
    // Create dark ambient environment
    // scene.background = new THREE.Color(0x111111);

    const logo = await getModel(scene, world, "cnotv.glb", {
      scale: [scale, scale, scale],
      rotation: [Math.PI / 6, 0, 0],
      hasGravity: false,
      castShadow: true,
      color: 0x333333,
      material: true,
      transmission: 0.7,
      roughness: 0.5,
      opacity: 0.5,
      metalness: 0.5,
      reflectivity: 0.9,
    });
    return { logo };
  },

  animate: ({ logo }: Record<string, any>) => {
    if (!logo) return;
    const audioData = getAudioData();
    const sum = audioData.reduce((a: number, b: number) => a + b, 0);
    const average = (sum / audioData.length) * 3; // Amplify audio data by 3x
    const side = average + 1 * scale;
    
    // Scale based on audio
    logo.mesh.scale.x = side;
    logo.mesh.scale.y = side;
    logo.mesh.scale.z = side;
    
    // Headbanging effect - tilt forward/backward based on audio intensity
    const headbangIntensity = 0.2;
    const headbangSpeed = 0.000001 + (average * 0.000000000005); // Base speed + audio-reactive speed
    const headbangTilt = Math.sin(Date.now() * headbangSpeed) * average * headbangIntensity;
    logo.mesh.rotation.x = Math.PI / 6 + headbangTilt;
    
    // Side rotation - subtle left/right rotation based on audio frequencies
    const rotationIntensity = 3 * 0.01;
    const sideRotationSpeed = (0.000008 + (average * 0.003)) * 0.0000000000001; // Base speed + audio-reactive speed
    const lowFreq = (audioData.slice(0, audioData.length / 3).reduce((a: number, b: number) => a + b, 0) / (audioData.length / 3)) * 3; // Amplify low freq
    const highFreq = (audioData.slice(audioData.length * 2 / 3).reduce((a: number, b: number) => a + b, 0) / (audioData.length / 3)) * 3; // Amplify high freq
    const rotationBalance = (highFreq - lowFreq) * rotationIntensity;
    const sideRotation = Math.sin(Date.now() * sideRotationSpeed) * rotationBalance;
    logo.mesh.rotation.z = sideRotation;
    
    // Optional: Add slight Y-axis rotation for more dynamic movement
    // logo.mesh.rotation.y += average * 0.01;
  }
};
