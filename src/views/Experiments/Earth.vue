<script setup lang="ts">
import * as THREE from 'three';
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { video } from '@/utils/video';
import { controls } from '@/utils/control';
import { stats } from '@/utils/stats';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import earthDay from '@/assets/earth_day.jpg';
import earthNight from '@/assets/earth_night.jpg';

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
    background: [0, 0, 0],
    light: [255, 255, 255],
  }
  stats.init(route, statsEl);
  controls.create(config, route, {
    size: {  },
    speed: {  },
  }, () => {
    setup()
  });

  let time = 0;

  const setup = () => {
    const renderer = new THREE.WebGLRenderer({ canvas: canvas });
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.setClearColor(new THREE.Color(`rgb(${config.background.map(Math.round).join(',')})`),); // Set background color to black

    // Load the texture
    // https://www.solarsystemscope.com/textures/
    const textureLoader = new THREE.TextureLoader();
    const texture1 = textureLoader.load(earthDay);
    const texture2 = textureLoader.load(earthNight);

    // Create a shader material
    const material = new THREE.ShaderMaterial({
      uniforms: {
        texture1: { value: texture1 },
        texture2: { value: texture2 },
        opacity: { value: 0}, // Initial opacity
      },
      vertexShader: `
        varying vec2 vUv;

        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D texture1;
        uniform sampler2D texture2;
        uniform float opacity;
        varying vec2 vUv;

        void main() {
          vec4 color1 = texture2D(texture1, vUv);
          vec4 color2 = texture2D(texture2, vUv);
          gl_FragColor = mix(color1, color2, opacity); // Blend the two colors
        }
      `,
    });

    const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
    const scene = new THREE.Scene();
    const geometry = new THREE.DodecahedronGeometry(config.size, config.details);
    const mesh = new THREE.Mesh(geometry, material);
    const orbit = new OrbitControls(camera, renderer.domElement);
    // Set the target to the position of the mesh
    orbit.target.copy(mesh.position);
    mesh.rotation.x = 0.4;

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

      mesh.rotation.y += (0.001 * config.speed);

  // Update time
  time += 0.005;

  // Update the opacity based on time
  const opacity = (Math.sin(time) + 1.2) / 2; // oscillates between 0 and 1

  // Update the opacity uniform
      material.uniforms.opacity.value = opacity;

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

