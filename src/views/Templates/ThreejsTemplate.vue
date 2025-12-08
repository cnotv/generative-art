<script setup lang="ts">
import * as THREE from 'three';
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import { video } from '@/utils/video';
import { controls } from '@/utils/control';
import { stats } from '@/utils/stats';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const statsEl = ref(null)
const canvas = ref(null)
const route = useRoute();
const animationId = ref(0);

onMounted(() => {
  init(
    canvas.value as unknown as HTMLCanvasElement,
    statsEl.value as unknown as HTMLElement,
  ), statsEl.value!;
})

onBeforeUnmount(() => {
  if (animationId.value) {
    cancelAnimationFrame(animationId.value);
  }
});

const init = (canvas: HTMLCanvasElement, statsEl: HTMLElement, ) => {
  const config = {
    size: 50,
  }
  // Set stats
  stats.init(route, statsEl);

  // Set configuration and start setup
  controls.create(config, route, {
    size: {  },
  }, () => {
    if (animationId.value) {
      cancelAnimationFrame(animationId.value);
    }
    setup()
  });

  const setup = () => {
    // Init canvas
    const renderer = new THREE.WebGLRenderer({ canvas: canvas });
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.setClearColor(0x000000); // Set background color to black
    
    const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
    const scene = new THREE.Scene();
    const orbit = new OrbitControls(camera, renderer.domElement);
    
    camera.position.z = 5;

    // Create and add model
    const cube = getCube(scene);
    orbit.target.copy(cube.position); // Copy position of the model as camera target

    // Start recording video if URL has query string ?video=true
    video.record(canvas, route);

    function animate() {
      stats.start(route); // Stats counter start if URL has query string ?stats=true
      requestAnimationFrame(animate);

      // Example of animation
      cube.rotation.x += 0.01;
      cube.rotation.y += 0.01;

      // Update ca,era
      orbit.update();

      renderer.render(scene, camera);

      // Stop recording after X frames
      video.stop(renderer.info.render.frame, route);
      
      stats.end(route); // Stats counter finish
    }
    animate();
  }
  setup();
}

const getCube = (scene: THREE.Scene) => {
    const geometry = new THREE.BoxGeometry( 1, 1, 1 );
    const material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    return cube;
  }
</script>

<template>
  <div ref="statsEl"></div>
  <canvas ref="canvas"></canvas>
</template>

