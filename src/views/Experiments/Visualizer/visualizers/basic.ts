import * as THREE from "three";
import { getAudioData } from "../audio";
import type { VisualizerSetup } from "../visualizer";

export const boxVisualizer: VisualizerSetup = {
  name: "Basic",
  song: 2,

  setup: (scene: THREE.Scene) => {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(20, 20, 20),
      new THREE.MeshLambertMaterial({ color: 0xff_44_44 })
    );
    scene.add(box);
    
    return { box };
  },

  getTimeline: (getObjects: () => Record<string, any>) => [{
    action: () => {
      const objects = getObjects();
      const { box } = objects;
      const audioData = getAudioData();
      const sum = audioData.reduce((a: number, b: number) => a + b, 0);
      const average = sum / audioData.length;
      const side = average;
      box.scale.x = side;
      box.scale.y = side;
      box.scale.z = side;
    }
  }]
};
