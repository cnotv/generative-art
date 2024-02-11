<script setup lang="ts">
import * as THREE from 'three';
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { video } from '@/utils/video';
import { controls } from '@/utils/control';
import { stats } from '@/utils/stats';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const statsEl = ref(null)
const canvas = ref(null)
const route = useRoute();

onMounted(() => {
  init(
    canvas.value as unknown as HTMLCanvasElement,
    statsEl.value as unknown as HTMLElement,
  ), statsEl.value!;
})

const init = (canvas: HTMLCanvasElement, statsEl: HTMLElement, ) => {
  const config = {
    size: 50,
  }
  stats.init(route, statsEl);
  controls.create(config, route, {
    size: {  },
    details: {},
    wireframe: {},
    background: { addColor: []},
    fill: { addColor: []},
    light: { addColor: []},
  }, () => {
    setup()
  });

  const setup = () => {
    const renderer = new THREE.WebGLRenderer({ canvas: canvas });
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.setClearColor(0x000000); // Set background color to black
    
    const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
    const scene = new THREE.Scene();
    const orbit = new OrbitControls(camera, renderer.domElement);
    
    camera.position.z = 5;

    const geometry = new THREE.BoxGeometry( 1, 1, 1 );
    const material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
    const cube = new THREE.Mesh( geometry, material );
    orbit.target.copy(cube.position);
    scene.add(cube);
    
    video.record(canvas, route);

    function animate() {
      stats.start(route);
      requestAnimationFrame(animate);

      cube.rotation.x += 0.01;
      cube.rotation.y += 0.01;
      orbit.update();

      renderer.render( scene, camera );
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

