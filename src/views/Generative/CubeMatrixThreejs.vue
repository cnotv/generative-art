<script setup lang="ts">
import * as THREE from 'three';
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { video } from '@/utils/video';
import { controls } from '@/utils/control';
import { stats } from '@/utils/stats';

const statsEl = ref(null)
const canvas = ref(null)
const route = useRoute();
    let amountX = 3
    let amountY = 3

onMounted(() => {
  init(
    canvas.value as unknown as HTMLCanvasElement,
    statsEl.value as unknown as HTMLElement,
  ), statsEl.value!;
})

const init = (canvas: HTMLCanvasElement, statsEl: HTMLElement, ) => {
  const config = {
    size: 10,
    gap: 2,
    amplitude: 8,
    speed: 10,
  }
  stats.init(route, statsEl);
  controls.create(config, route, {
    size: { min: 1, max: 100 },
    gap: { min: 1, max: 10 },
    amplitude: { min: 1, max: 20 },
    speed: { min: 1, max: 100 },
    // details: {},
    // wireframe: {},
    // background: { addColor: []},
    // fill: { addColor: []},
    // light: { addColor: []},
  }, () => {
    setup()
  });

  const setup = () => {
    const renderer = new THREE.WebGLRenderer({ canvas: canvas });
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.setClearColor(0x000000); // Set background color to black

    const canvasWidth = renderer.domElement.width;
    const canvasHeight = renderer.domElement.height;
    const size = config.size / 10;
    const gap = config.gap / 10;
    amountX = Math.floor(canvasWidth / (config.size * config.gap * 2));
    amountY = Math.floor(canvasHeight / (config.size * config.gap * 2));

    const aspectRatio = canvasWidth / canvasHeight;
    const cameraHeight = 10; // Adjust this value to zoom in or out
    const cameraWidth = cameraHeight * aspectRatio;
    const camera = new THREE.OrthographicCamera(
      cameraWidth / -2, // left
      cameraWidth / 2, // right
      cameraHeight / 2, // top
      cameraHeight / -2, // bottom
      1, // near
      1000 // far
    );

    const scene = new THREE.Scene();
    
    camera.position.z = 10;
    camera.position.set(amountX, amountY, 10);
    
    const cubes: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial, THREE.Object3DEventMap>[] = []; // Array to hold the cubes
    for (let i = 0; i < amountX; i++) {
      for (let j = 0; j < amountY; j++) {
        // Create a cube
        const geometry = new THREE.BoxGeometry(size, size, size);
        const material = new THREE.MeshBasicMaterial({ color: 0x333333 });
        const cube = new THREE.Mesh(geometry, material);
        cube.position.x = i * (size + gap * 2);
        cube.position.y = j * (size + gap * 2);
        scene.add(cube);
        cubes.push(cube);
      }
    }

    video.record(canvas, route);

    function animate() {
      stats.start(route);
      requestAnimationFrame(animate);
      const time = Date.now() * 0.0001 * config.speed; // Adjust speed of the wave

      for (let i = 0; i < amountX; i++) {
        for (let j = 0; j < amountY; j++) {
          const cube = cubes[i * amountY + j];
          const horizontal = amountX / 2 > i ? i : -i;
          const vertical = amountY / 2 > j ? j : -j;
          const pos = Math.sin(vertical) + Math.sin(horizontal) + Math.sin(time) * (config.amplitude / 10);
          cube.scale.set(pos, pos, pos);
        }
      }

      renderer.render(scene, camera);
      video.stop(renderer.info.render.frame ,route);
      stats.end(route);
    }
    animate();
  }
  setup();
}
</script>

<template>
  <div ref="statsEl"></div>
  <canvas ref="canvas"></canvas>
</template>

