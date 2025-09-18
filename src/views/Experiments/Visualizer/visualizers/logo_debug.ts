import * as THREE from "three";
import { getAudioData } from "../audio";
import type { VisualizerSetup } from "../visualizer";
import { getModel } from "@/utils/threeJs";
import type RAPIER from "@dimforge/rapier3d";
import streetBg from '@/assets/street2_blur.jpg';

const scale = 3;

// Bars configuration
const barsConfig = {
  barCount: 32,
  barWidth: 1,
  barSpacing: 1.2,
  maxHeight: 20,
};

// Logo setup function
const setupLogo = async (scene: THREE.Scene, world: RAPIER.World) => {
  const logo = await getModel(scene, world, "cnotv.glb", {
    scale: [scale, scale, scale],
    rotation: [Math.PI / 6, 0, 0],
    position: [30, -5, 0],
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
  return logo;
};

// Bars setup function
const setupBars = (scene: THREE.Scene) => {
  const bars = Array.from(
    { length: barsConfig.barCount },
    (_, i) => {
      const barGeometry = new THREE.BoxGeometry(
        barsConfig.barWidth,
        1,
        barsConfig.barWidth
      );
      const barMaterial = new THREE.MeshLambertMaterial({
        color: 0x0099ff,
      });
      const bar = new THREE.Mesh(barGeometry, barMaterial);

      // Position bars next to the logo (offset to the right)
      const offset = -15;
      const x = (i - barsConfig.barCount / 2) * barsConfig.barSpacing + offset;
      bar.position.set(x, 0.5, 0);

      scene.add(bar);
      return bar;
    }
  );
  return bars;
};

// Logo animation function
const animateLogo = (logo: any) => {
  if (!logo) return;
  const audioData = getAudioData();
  const sensibility = 50;
  const sum = audioData.reduce((a: number, b: number) => a + b, 0);
  const audioMap = 0.000000002;
  const average = sum / audioData.length * audioMap;
  const speed = 0.005;
  const amplitude = 0.4;
  const offset = 0.3;
  const tilt = Math.sin(Date.now() * speed * average) * amplitude + offset;
  const rotation = Math.PI / 3 + Math.floor(tilt * sensibility) / sensibility;
  
  logo.mesh.rotation.x = rotation;
};

// Bars animation function
const animateBars = (bars: THREE.Mesh[]) => {
  if (!bars) return;
  
  const audioData = getAudioData();

  bars.forEach((bar: THREE.Mesh, index: number) => {
    const height = 1 + audioData[index] * barsConfig.maxHeight;
    bar.scale.y = height;
    bar.position.y = height / 2;
  });
};
export const boxVisualizer: VisualizerSetup = {
  name: "Logo + Bars",
  song: 1,
  camera: {
    position: [-30, 15, 32],
  },

  setup: async (scene: THREE.Scene, world?: RAPIER.World) => {
    if (!world) return {};
    
    // Setup background environment
    const textureLoader = new THREE.TextureLoader();
    const bgTexture = textureLoader.load(streetBg);
    bgTexture.mapping = THREE.EquirectangularReflectionMapping;
    
    scene.background = bgTexture;
    
    const textureLoader2 = new THREE.TextureLoader();
    const bgTexture2 = textureLoader2.load(streetBg);
    bgTexture2.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = bgTexture2;

    // Setup logo using separated function
    const logo = await setupLogo(scene, world);
    
    // Setup bars using separated function
    const bars = setupBars(scene);

    return { logo, bars };
  },

  animate: ({ logo, bars }: Record<string, any>) => {
    // Animate logo using separated function
    animateLogo(logo);
    
    // Animate bars using separated function
    animateBars(bars);
  },
};
