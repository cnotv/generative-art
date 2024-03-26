<script setup lang="ts">
import * as THREE from 'three';
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { video } from '@/utils/video';
import { controls } from '@/utils/control';
import { stats } from '@/utils/stats';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import moonTextureAsset from '@/assets/moon.jpg';
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
    moonSize: 200,
    earthSize: 20,
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
    moonSize: {  },
    earthSize: {  },
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
  let time = 0;

  const getTextures = (img: string) => {
    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load(img);

    // Adjust the texture offset and repeat
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.offset.set(config.offsetX, config.offsetY); // Offset the texture by 50%
    texture.repeat.set(config.repeatX, config.repeatY); // Repeat the texture 0.5 times in both directions

    return texture;
  }

  const setup = () => {
    const renderer = new THREE.WebGLRenderer({ canvas: canvas });
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.setClearColor(new THREE.Color(`rgb(${config.background.map(Math.round).join(',')})`),); // Set background color to black

    // Load the texture
    // https://www.solarsystemscope.com/textures/
    const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
    const scene = new THREE.Scene();

    // Earth
    const earthGeometry = new THREE.SphereGeometry(config.earthSize, 32, 32);
    const textureLoader = new THREE.TextureLoader();
    const earthDayTexture = textureLoader.load(earthDay);
    const earthNightTexture = textureLoader.load(earthNight);
    // Create a shader material
    const earthMaterial = new THREE.ShaderMaterial({
      uniforms: {
        earthDayTexture: { value: earthDayTexture },
        earthNightTexture: { value: earthNightTexture },
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
        uniform sampler2D earthDayTexture;
        uniform sampler2D earthNightTexture;
        uniform float opacity;
        varying vec2 vUv;

        void main() {
          vec4 color1 = texture2D(earthDayTexture, vUv);
          vec4 color2 = texture2D(earthNightTexture, vUv);
          gl_FragColor = mix(color1, color2, opacity); // Blend the two colors
        }
      `,
    });
    const earth = new THREE.Mesh(earthGeometry, earthMaterial);
    scene.add( earth );


    // Moon
    const moonGeometry = new THREE.SphereGeometry(config.moonSize, 32, 32);

    const moonTexture = getTextures(moonTextureAsset);
    const moonMaterial = new THREE.MeshBasicMaterial({
      map: config.texture ? moonTexture : null,
      wireframe: config.wireframe,
      opacity: config.opacity,
      transparent: true,
      color: config.color ? new THREE.Color(`rgb(${config.fill.map(Math.round).join(',')})`) : undefined,
    });
    const moon = new THREE.Mesh(moonGeometry, moonMaterial);

    const orbit = new OrbitControls(camera, renderer.domElement);
    // Set the target to the position of the mesh
    orbit.target.copy(moon.position);

    camera.position.set(100, 0, 0);
    camera.lookAt(0, 0, 0);

    moon.position.y = -200;
    scene.add(moon);

    earth.position.y = 35;
    earth.rotation.z = -0.6;
    // earth.rotation.y = -20;
    
    const light = new THREE.AmbientLight(
      new THREE.Color(`rgb(${config.light.map(Math.round).join(',')})`)
    ); // soft white light
    scene.add(light);

    video.record(canvas, route);

    function animate() {
      stats.start(route);
      requestAnimationFrame(animate);

      moon.rotation.z += (-0.0001 * config.speed);
      earth.rotation.y += (0.0005 * config.speed);
      earth.rotation.x += (0.000001 * config.speed);

      time += 0.005;
      const opacity = (Math.sin(time) + 1.2) / 2;
      earthMaterial.uniforms.opacity.value = opacity;

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

