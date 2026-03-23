<script setup lang="ts">
import * as THREE from 'three';
import { ref, onMounted, onUnmounted } from 'vue';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { createWaterMaterial } from './waterShader';
import { createBorderCorners } from './borderCorners';
import { registerCameraProperties } from '@/utils/cameraProperties';
import { registerLightProperties } from '@/utils/lightProperties';
import { useElementPropertiesStore } from '@/stores/elementProperties';

const canvas = ref<HTMLCanvasElement | null>(null);
const showMessage = ref(false);

let animationId = 0;
let renderer: THREE.WebGLRenderer | null = null;

const CAMERA_Z_DEFAULT = 14;
const CAMERA_Z_ZOOM = 4;
const CAMERA_Y = 2;
const CAMERA_FOV = 50;
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 200;
const WATER_SIZE = 80;
const WATER_SEGMENTS = 64;
const VIEWPORT_HALF_W = 7.5;
const VIEWPORT_HALF_H = 5.5;
const BACKGROUND_COLOR = 0x0a0a0a;
const WHITE = 0xffffff;
const AMBIENT_INTENSITY = 0.3;
const DIR_LIGHT_INTENSITY = 1.5;
const DIR_LIGHT_X = 5;
const DIR_LIGHT_Y = 10;
const CAMERA_LERP_SPEED = 3;
const TEXT_SIZE = 1.2;
const TEXT_HEIGHT = 0.3;
const FLIP_SPEED = 2.5;
const FLIP_TARGET = -Math.PI / 2;

onMounted(async () => {
  const canvasElement = canvas.value!;
  renderer = new THREE.WebGLRenderer({ canvas: canvasElement, antialias: true, alpha: true });
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
  camera.position.set(0, CAMERA_Y, CAMERA_Z_DEFAULT);
  camera.lookAt(0, CAMERA_Y, 0);

  const scene = new THREE.Scene();

  // Lights
  const ambientLight = new THREE.AmbientLight(WHITE, AMBIENT_INTENSITY);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(WHITE, DIR_LIGHT_INTENSITY);
  dirLight.position.set(DIR_LIGHT_X, DIR_LIGHT_Y, DIR_LIGHT_X);
  dirLight.castShadow = true;
  scene.add(dirLight);

  const rimLight = new THREE.DirectionalLight(WHITE, 0.4);
  rimLight.position.set(-DIR_LIGHT_X, -2, -DIR_LIGHT_X);
  scene.add(rimLight);

  // Register panel properties
  registerCameraProperties({ camera, skipOrbitSync: true });
  registerLightProperties({ light: ambientLight, name: 'ambient-light', title: 'Ambient Light' });
  registerLightProperties({ light: dirLight, name: 'directional-light', title: 'Directional Light' });
  registerLightProperties({ light: rimLight, name: 'rim-light', title: 'Rim Light' });

  // Water background
  const { material: waterMaterial, update: updateWater } = createWaterMaterial();
  const waterGeometry = new THREE.PlaneGeometry(WATER_SIZE, WATER_SIZE, WATER_SEGMENTS, WATER_SEGMENTS);
  const waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
  waterMesh.renderOrder = -1;
  scene.add(waterMesh);

  // Shared greyscale material for 3D content
  const contentMaterial = new THREE.MeshStandardMaterial({
    color: 0xdddddd,
    roughness: 0.3,
    metalness: 0.6,
  });

  // Flip group — pivot at y=0, content offset upward
  const flipGroup = new THREE.Group();
  scene.add(flipGroup);

  // Load GLB logo
  const gltfLoader = new GLTFLoader();
  gltfLoader.load('/cnotv.glb', (gltf) => {
    const model = gltf.scene;

    // Centre and scale the model
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const targetSize = 3;
    model.scale.setScalar(targetSize / maxDim);

    // Recompute after scale
    box.setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const newSize = box.getSize(new THREE.Vector3());

    // Place logo above text: offset so bottom is at y=0 inside the group
    model.position.set(-center.x, -center.y + newSize.y / 2 + 1.5, -center.z);

    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.material = contentMaterial;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });

    flipGroup.add(model);
  });

  // Load font and create 3D text
  const fontLoader = new FontLoader();
  fontLoader.load(
    '/node_modules/three/examples/fonts/helvetiker_bold.typeface.json',
    (font) => {
      const textGeometry = new TextGeometry('CNOTV', {
        font,
        size: TEXT_SIZE,
        depth: TEXT_HEIGHT,
        curveSegments: 6,
        bevelEnabled: true,
        bevelThickness: 0.03,
        bevelSize: 0.02,
        bevelSegments: 3,
      });

      textGeometry.computeBoundingBox();
      const textBox = textGeometry.boundingBox!;
      const textWidth = textBox.max.x - textBox.min.x;
      const textHeight = textBox.max.y - textBox.min.y;

      const textMesh = new THREE.Mesh(textGeometry, contentMaterial);
      // Centre horizontally, place bottom at y=0 inside group
      textMesh.position.set(-textWidth / 2, textHeight / 2, 0);
      textMesh.castShadow = true;
      flipGroup.add(textMesh);
    },
  );

  // Position the flip group so its pivot (y=0) sits at screen centre height
  flipGroup.position.set(0, 0, 0);

  // Border corners
  const corners = createBorderCorners(VIEWPORT_HALF_W, VIEWPORT_HALF_H);
  corners.position.set(0, CAMERA_Y, 0);
  scene.add(corners);

  // Flip animation state
  let targetRotationX = 0;
  const clickables: THREE.Object3D[] = [flipGroup];

  // Click / tap interaction
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  const onPointerDown = (event: PointerEvent) => {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(clickables, true);
    if (hits.length > 0) {
      targetRotationX = FLIP_TARGET;
    }
  };

  canvasElement.addEventListener('pointerdown', onPointerDown);

  // Resize
  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer!.setSize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener('resize', onResize);

  // Animation loop
  const clock = new THREE.Clock();
  let cameraTargetZ = CAMERA_Z_DEFAULT;

  const animate = () => {
    animationId = requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const elapsed = clock.getElapsedTime();

    updateWater(elapsed);

    // Flip animation
    const diff = targetRotationX - flipGroup.rotation.x;
    if (Math.abs(diff) > 0.001) {
      flipGroup.rotation.x += diff * Math.min(1, FLIP_SPEED * delta);
    } else {
      flipGroup.rotation.x = targetRotationX;
    }

    // Camera zoom for message
    camera.position.z += (cameraTargetZ - camera.position.z) * Math.min(1, delta * CAMERA_LERP_SPEED);

    renderer!.render(scene, camera);
  };
  animate();

  // Message click zoom
  const messageElement = document.querySelector<HTMLElement>('.landing-page__message');
  messageElement?.addEventListener('click', () => {
    cameraTargetZ = CAMERA_Z_ZOOM;
    showMessage.value = true;
  });

  // Cleanup
  (canvasElement as unknown as { _cleanup: () => void })._cleanup = () => {
    canvasElement.removeEventListener('pointerdown', onPointerDown);
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
  <div class="landing-page__message" :class="{ 'landing-page__message--fullscreen': showMessage }">
    Hello, world.
  </div>
</template>

<style scoped>
.landing-page__canvas {
  display: block;
  width: 100%;
  height: 100%;
  position: fixed;
  inset: 0;
}

.landing-page__message {
  position: fixed;
  bottom: var(--spacing-6);
  left: 50%;
  transform: translateX(-50%);
  color: var(--color-muted-foreground);
  font-family: monospace;
  font-size: 0.85rem;
  letter-spacing: 0.15em;
  cursor: pointer;
  opacity: 0.6;
  transition:
    opacity var(--transition-normal),
    font-size var(--transition-normal),
    inset var(--transition-normal);
}

.landing-page__message--fullscreen {
  inset: 0;
  transform: none;
  left: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  opacity: 1;
  background-color: var(--color-background);
}
</style>
