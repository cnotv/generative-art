<script setup lang="ts">
import * as THREE from 'three';
import { ref, onMounted, onUnmounted } from 'vue';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { createWaterMaterial } from './waterShader';
import { registerCameraProperties } from '@/utils/cameraProperties';
import { registerLightProperties } from '@/utils/lightProperties';
import { useElementPropertiesStore } from '@/stores/elementProperties';

const canvas = ref<HTMLCanvasElement | null>(null);

let animationId = 0;
let renderer: THREE.WebGLRenderer | null = null;

const CAMERA_Z = 14;
const CAMERA_Y = 2;
const CAMERA_FOV = 50;
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 200;
const WATER_SIZE = 80;
const WATER_SEGMENTS = 64;
const BACKGROUND_COLOR = 0x0a0a0a;
const WHITE = 0xffffff;
const AMBIENT_INTENSITY = 0.3;
const DIR_LIGHT_INTENSITY = 1.5;
const DIR_LIGHT_POS = 5;
const TARGET_WIDTH = 8;
const TEXT_DEPTH = 0.8;
const GAP = 1.4;

onMounted(async () => {
  const canvasElement = canvas.value!;
  renderer = new THREE.WebGLRenderer({ canvas: canvasElement, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(BACKGROUND_COLOR, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const camera = new THREE.PerspectiveCamera(
    CAMERA_FOV,
    window.innerWidth / window.innerHeight,
    CAMERA_NEAR,
    CAMERA_FAR,
  );
  camera.position.set(0, CAMERA_Y, CAMERA_Z);
  camera.lookAt(0, CAMERA_Y, 0);

  const scene = new THREE.Scene();

  const ambientLight = new THREE.AmbientLight(WHITE, AMBIENT_INTENSITY);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(WHITE, DIR_LIGHT_INTENSITY);
  dirLight.position.set(DIR_LIGHT_POS, DIR_LIGHT_POS * 2, DIR_LIGHT_POS);
  dirLight.castShadow = true;
  scene.add(dirLight);

  // Register panel properties
  registerCameraProperties({ camera, skipOrbitSync: true });
  registerLightProperties({ light: ambientLight, name: 'ambient-light', title: 'Ambient Light' });
  registerLightProperties({ light: dirLight, name: 'directional-light', title: 'Directional Light' });

  // Water background
  const { material: waterMaterial, update: updateWater } = createWaterMaterial();
  const waterGeometry = new THREE.PlaneGeometry(WATER_SIZE, WATER_SIZE, WATER_SEGMENTS, WATER_SEGMENTS);
  const waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
  waterMesh.renderOrder = -1;
  scene.add(waterMesh);

  // Shared greyscale material
  const contentMaterial = new THREE.MeshStandardMaterial({
    color: 0xdddddd,
    roughness: 0.3,
    metalness: 0.6,
  });

  // GLB logo — scale to TARGET_WIDTH, place above text
  const gltfLoader = new GLTFLoader();
  gltfLoader.load('/cnotv.glb', (gltf) => {
    const model = gltf.scene;

    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    model.scale.setScalar(TARGET_WIDTH / size.x);

    box.setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const scaledSize = box.getSize(new THREE.Vector3());
    // centre horizontally, sit bottom of logo at y=0 + GAP above text
    model.position.set(-center.x, -center.y + scaledSize.y / 2 + GAP, -center.z);

    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.material = contentMaterial;
        mesh.castShadow = true;
      }
    });

    scene.add(model);
  });

  // 3D text — create at size 1, then scale to TARGET_WIDTH
  const fontLoader = new FontLoader();
  fontLoader.load(
    '/node_modules/three/examples/fonts/helvetiker_bold.typeface.json',
    (font) => {
      const textGeometry = new TextGeometry('CNOTV', {
        font,
        size: 1,
        depth: TEXT_DEPTH,
        curveSegments: 8,
        bevelEnabled: true,
        bevelThickness: 0.08,
        bevelSize: 0.05,
        bevelSegments: 6,
      });

      textGeometry.computeBoundingBox();
      const textBox = textGeometry.boundingBox!;
      const textWidth = textBox.max.x - textBox.min.x;
      const textHeight = textBox.max.y - textBox.min.y;

      const textScale = TARGET_WIDTH / textWidth;
      const textMesh = new THREE.Mesh(textGeometry, contentMaterial);
      textMesh.scale.setScalar(textScale);
      // centre horizontally, sit top of text at y=0 (logo sits above)
      textMesh.position.set(
        (-textWidth / 2) * textScale,
        (-textHeight / 2) * textScale,
        0,
      );
      textMesh.castShadow = true;
      scene.add(textMesh);
    },
  );

  // Resize
  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer!.setSize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener('resize', onResize);

  // Animation loop
  const clock = new THREE.Clock();
  const animate = () => {
    animationId = requestAnimationFrame(animate);
    updateWater(clock.getElapsedTime());
    renderer!.render(scene, camera);
  };
  animate();

  (canvasElement as unknown as { _cleanup: () => void })._cleanup = () => {
    window.removeEventListener('resize', onResize);
    waterGeometry.dispose();
    waterMaterial.dispose();
    contentMaterial.dispose();
    renderer!.dispose();
  };
});

onUnmounted(() => {
  cancelAnimationFrame(animationId);
  useElementPropertiesStore().clearAllElementProperties();
  const canvasElement = canvas.value as unknown as { _cleanup?: () => void } | null;
  canvasElement?._cleanup?.();
  renderer = null;
});
</script>

<template>
  <canvas ref="canvas" class="landing-page__canvas" />
</template>

<style scoped>
.landing-page__canvas {
  display: block;
  width: 100%;
  height: 100%;
  position: fixed;
  inset: 0;
}
</style>
