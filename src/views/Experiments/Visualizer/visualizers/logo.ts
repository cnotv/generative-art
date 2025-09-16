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
    scene.background = new THREE.Color(0x111111);

    const logo = await getModel(scene, world, "cnotv.glb", {
      scale: [scale, scale, scale],
      rotation: [Math.PI / 6, 0, 0],
      hasGravity: false,
      castShadow: true,
      color: 0xff3333,
      transmission: 0.7,
      roughness: 0.05,
      opacity: 0.3,
      metalness: 1,
      reflectivity: 0.9,
    });
    return { logo };
  },

  animate: ({ logo }: Record<string, any>) => {
    if (!logo) return;
    const audioData = getAudioData();
    const sum = audioData.reduce((a: number, b: number) => a + b, 0);
    const average = sum / audioData.length;
    const side = average + 1 * scale;
    logo.mesh.scale.x = side;
    logo.mesh.scale.y = side;
    logo.mesh.scale.z = side;
  }
};
