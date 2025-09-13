import * as THREE from "three";
import { getAudioData } from "../audio";
import type { VisualizerSetup } from "../visualizer";
import { getModel, getSky } from "@/utils/threeJs";
import type RAPIER from '@dimforge/rapier3d';
import livingRoomImage from "@/assets/livingroom2.jpg";

export const boxVisualizer: VisualizerSetup = {
  name: "Radio",
  song: 2,

  setup: async (scene: THREE.Scene, world?: RAPIER.World) => {
    if (!world) return {};
    getSky(scene, {texture: livingRoomImage, color: 0xaaaaaa,});
    const model = await getModel(scene, world, "cubik_radio.glb", {
      scale: [3, 3, 3],
      hasGravity: false,
      receiveShadow: true,
      castShadow: true,
    });
    await getModel(scene, world, "round_table.glb", {
      hasGravity: false,
      scale: [0.4, 0.4, 0.4],
      castShadow: true,
      receiveShadow: true,
      position: [-93, -30, 50],
    });
    
    return { model };
  },

  animate: ({ model }: Record<string, AnimatedComplexModel>) => {
    if (!model) return;
    const audioData = getAudioData();
    const sum = audioData.reduce((a: number, b: number) => a + b, 0);
    const average = sum / audioData.length;
    const side = average * 2 + 3;
    model.mesh.scale.x = side;
    model.mesh.scale.y = side;
    model.mesh.scale.z = side;
  }
};
