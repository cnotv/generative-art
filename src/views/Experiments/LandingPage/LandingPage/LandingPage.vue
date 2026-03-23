<script setup lang="ts">
import * as THREE from 'three';
import { ref, onMounted, onUnmounted } from 'vue';
import logoUrl from '@/assets/images/svg/logobw.svg';
import { createWaterMaterial } from './waterShader';
import { createLogoPanel } from './logoPanel';
import { createBorderCorners } from './borderCorners';

const canvas = ref<HTMLCanvasElement | null>(null);
const showMessage = ref(false);

let animationId = 0;
let renderer: THREE.WebGLRenderer | null = null;

const CAMERA_Z_DEFAULT = 14;
const CAMERA_Z_ZOOM = 4;
const CAMERA_Y = 4;
const CAMERA_FOV = 50;
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 200;
const WATER_SIZE = 80;
const WATER_SEGMENTS = 64;
const VIEWPORT_HALF_W = 7.5;
const VIEWPORT_HALF_H = 5.5;
const BACKGROUND_COLOR = 0x0a0a0a;
const WHITE = 0xffffff;
const AMBIENT_INTENSITY = 0.15;
const DIR_LIGHT_INTENSITY = 1.2;
const DIR_LIGHT_X = 5;
const DIR_LIGHT_Y = 10;
const CAMERA_LERP_SPEED = 3;

onMounted(() => {
  const canvasElement = canvas.value!;
  renderer = new THREE.WebGLRenderer({ canvas: canvasElement, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(BACKGROUND_COLOR);
  renderer.shadowMap.enabled = true;

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

  // Water background
  const { material: waterMaterial, update: updateWater } = createWaterMaterial();
  const waterGeometry = new THREE.PlaneGeometry(WATER_SIZE, WATER_SIZE, WATER_SEGMENTS, WATER_SEGMENTS);
  const waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
  waterMesh.renderOrder = -1;
  scene.add(waterMesh);

  // Logo panel
  const panel = createLogoPanel(logoUrl, 'Generative Art');
  panel.group.position.set(0, 0, 0);
  scene.add(panel.group);

  // Border corners
  const corners = createBorderCorners(VIEWPORT_HALF_W, VIEWPORT_HALF_H);
  corners.position.set(0, CAMERA_Y, 0);
  scene.add(corners);

  // Click / tap interaction
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  const onPointerDown = (event: PointerEvent) => {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(panel.group.children, true);
    if (hits.length > 0) {
      panel.flip();
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
    panel.update(delta);

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

  // Cleanup refs for onUnmounted
  (canvasElement as unknown as { _cleanup: () => void })._cleanup = () => {
    canvasElement.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('resize', onResize);
    waterGeometry.dispose();
    waterMaterial.dispose();
    renderer!.dispose();
  };
});

onUnmounted(() => {
  cancelAnimationFrame(animationId);
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
