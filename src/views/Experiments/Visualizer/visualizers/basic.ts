import * as THREE from "three";
import { getAudioData } from "../audio";
import type { VisualizerSetup } from "../visualizer";

export const boxVisualizer: VisualizerSetup = {
  name: "Basic",
  song: 0,

  setup: (scene: THREE.Scene) => {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(20, 20, 20),
      new THREE.MeshLambertMaterial({ color: 0xff4444 })
    );
    scene.add(box);
    
    return { box };
  },

  animate: (objects: Record<string, any>) => {
    const { box } = objects;
    if (!box) return;
    const audioData = getAudioData();
    const sum = audioData.reduce((a: number, b: number) => a + b, 0);
    const average = sum / audioData.length;
    const side = average;
    box.scale.x = side;
    box.scale.y = side;
    box.scale.z = side;
  }
};
