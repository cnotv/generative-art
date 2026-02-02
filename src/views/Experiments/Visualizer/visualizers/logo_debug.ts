import * as THREE from "three";
import { getAudioData } from "../audio";
import type { VisualizerSetup } from "../visualizer";
import { getModel } from "@webgamekit/threejs";
import type RAPIER from "@dimforge/rapier3d-compat";
import streetBg from '@/assets/images/generic/street2_blur.jpg';

const scale = 3;

const barsConfig = {
  barCount: 32,
  barWidth: 1,
  barSpacing: 1.2,
  maxHeight: 20,
};

const barsActiveState: boolean[] = Array(barsConfig.barCount).fill(true);

// Function to toggle bar active state
const toggleBarActive = (index: number) => {
  if (index >= 0 && index < barsActiveState.length) {
    barsActiveState[index] = !barsActiveState[index];
  }
};

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
        color: 0x0099ff, // Default blue for active
      });
      const bar = new THREE.Mesh(barGeometry, barMaterial);

      // Position bars next to the logo (offset to the right)
      const offset = -15;
      const x = (i - barsConfig.barCount / 2) * barsConfig.barSpacing + offset;
      bar.position.set(x, 0.5, 0);

      // Store the bar index for click handling
      bar.userData = { index: i };

      scene.add(bar);
      return bar;
    }
  );

  return bars;
};

const animateLogo = (logo: any, audioData: number[]) => {
  if (!logo) return;
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

const animateBars = (bars: THREE.Mesh[], audioData: number[]) => {
  if (!bars) return;

  bars.forEach((bar: THREE.Mesh, index: number) => {
    // Update bar color based on active state
    const isActive = barsActiveState[index];
    const material = bar.material as THREE.MeshLambertMaterial;
    material.color.setHex(isActive ? 0x0099ff : 0xff0000); // Blue if active, red if inactive
    
    // Only animate active bars
    if (isActive && audioData[index] !== undefined) {
      const height = 1 + audioData[index] * barsConfig.maxHeight;
      bar.scale.y = height;
      bar.position.y = height / 2;
    } else {
      // Keep inactive bars at minimum height
      bar.scale.y = 1;
      bar.position.y = 0.5;
    }
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

    const logo = await setupLogo(scene, world);
    const bars = setupBars(scene);

    return { logo, bars };
  },

  getTimeline: (getObjects: () => Record<string, any>) => [{
    action: () => {
      const objects = getObjects();
      const { logo, bars } = objects;
      // Get audio data once and pass it to both animation functions
      const audioData = getAudioData();
      
      // Get filtered audio data from only active bars for logo animation
      const activeAudioData = audioData.filter((_, index) => barsActiveState[index] || false);
      
      animateLogo(logo, activeAudioData);
      animateBars(bars, audioData);
    }
  }],

  handleClick: (event: MouseEvent, camera: THREE.Camera, canvas: HTMLCanvasElement, { bars }: Record<string, any>) => {
    if (!camera || !canvas || bars.length === 0) return;
    
    // Get mouse position in normalized device coordinates (-1 to +1)
    const rect = canvas.getBoundingClientRect();
    const mouse = new THREE.Vector2();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    // Create raycaster
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    
    // Check for intersections with bars
    const intersects = raycaster.intersectObjects(bars);
    
    if (intersects.length > 0) {
      // Get the clicked bar
      const clickedBar = intersects[0].object as THREE.Mesh;
      const barIndex = clickedBar.userData.index;
      
      if (typeof barIndex === 'number') {
        // Toggle the bar's active state
        toggleBarActive(barIndex);
      }
    }
  }
};
