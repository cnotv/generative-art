<script setup lang="ts">
import * as THREE from 'three';
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { video } from '@/utils/video';
import { controls } from '@/utils/control';
import { stats } from '@/utils/stats';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import moon from '@/assets/images/textures/moon.jpg';

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
    size: 40,
    speed: 2,
    details: 10,
    wireframe: false,
    background: [0, 0, 0],
    texture: true,
    opacity: 1,
    offsetX: 1,
    offsetY: 1,
    repeatX: 1,
    repeatY: 1,
    color: false,
    fill: [0, 0, 255],
    light: [255, 255, 255],
  }
  stats.init(route, statsEl);
  controls.create(config, route, {
    size: {  },
    speed: {  },
    details: {},
    opacity: {},
    texture: {},
    offsetX: {},
    offsetY: {},
    repeatX: {},
    repeatY: {},
    wireframe: {},
    color: {},
    fill: { addColor: []},
    background: { addColor: []},
    light: { addColor: []},
  }, () => {
    setup()
  });

  const setup = () => {
    const renderer = new THREE.WebGLRenderer({ canvas: canvas });
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.setClearColor(new THREE.Color(`rgb(${config.background.map(Math.round).join(',')})`),); // Set background color to black

    // Load the texture
    // https://www.solarsystemscope.com/textures/
    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load(moon);

    // Adjust the texture offset and repeat
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.offset.set(config.offsetX, config.offsetY); // Offset the texture by 50%
    texture.repeat.set(config.repeatX, config.repeatY); // Repeat the texture 0.5 times in both directions

    const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
    const scene = new THREE.Scene();
    const geometry = new THREE.DodecahedronGeometry(config.size, config.details);

    const material = new THREE.MeshBasicMaterial({
      map: config.texture ? texture : null,
      wireframe: config.wireframe,
      opacity: config.opacity,
      transparent: true,
      color: config.color ? new THREE.Color(`rgb(${config.fill.map(Math.round).join(',')})`) : undefined,
    });

    const mesh = new THREE.Mesh(geometry, material);
    
    const orbit = new OrbitControls(camera, renderer.domElement);
    // Set the target to the position of the mesh
    orbit.target.copy(mesh.position);


    camera.position.set( 0, 0, 100 );
    camera.lookAt(0, 0, 0);
    const light = new THREE.AmbientLight(
      new THREE.Color(`rgb(${config.light.map(Math.round).join(',')})`)
    ); // soft white light
    scene.add(light);
    scene.add( mesh );

    video.record(canvas, route);

    function animate() {
      stats.start(route);
      requestAnimationFrame(animate);

      // mesh.rotation.x += (0.001 * config.speed);
      mesh.rotation.y += (0.001 * config.speed);

      // Update the controls
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

