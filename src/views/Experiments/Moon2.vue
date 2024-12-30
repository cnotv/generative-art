<script setup lang="ts">
import * as THREE from 'three';
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { video } from '@/utils/video';
import { controls } from '@/utils/control';
import { stats } from '@/utils/stats';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import moonImage from '@/assets/moon.jpg';
import spaceImage from '@/assets/space.png';

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
    size: 20,
    speed: 1,
    details: 10,
    wireframe: false,
    background: [0, 0, 0],
    texture: true,
    opacity: 1,
    reflectivity: 0.2,
    offsetX: 1,
    offsetY: 1,
    repeatX: 1,
    repeatY: 1,
    color: false,
    fill: [0, 0, 255],
    light: [255, 255, 255],
    cameraDistance: 100,
  }
  stats.init(route, statsEl);
  controls.create(config, route, {
    size: {  },
    speed: {  },
    details: {},
    opacity: {},
    reflectivity: {},
    texture: {},
    offsetX: {},
    offsetY: {},
    repeatX: {},
    repeatY: {},
    wireframe: {},
    color: {},
  }, () => {
    setup()
  });

  const setup = () => {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.setClearColor(new THREE.Color(`rgb(${config.background.map(Math.round).join(',')})`),); // Set background color to black
    renderer.shadowMap.enabled = true; // Enable shadow maps
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Use soft shadows

    // Load the texture
    const textureLoader = new THREE.TextureLoader();

    const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
    const scene = new THREE.Scene();

    const moon = loadMoon(scene, textureLoader, config);
    loadSky(scene, textureLoader, config, spaceImage);
    
    const orbit = new OrbitControls(camera, renderer.domElement);
    // Set the target to the position of the moon
    orbit.target.copy(moon.position);

    camera.position.set( 0, 0, config.cameraDistance );
    camera.lookAt(0, 0, 0);

    const directionalLight = loadLight(scene, config);

    let count = 0;
    setInterval(() => {
      count += 0.01;
    }, 50);

    // Create a sphere to represent the light position
    const sunGeometry = new THREE.SphereGeometry(0.5, 100, 32);
    const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const sun = new THREE.Mesh(sunGeometry, sunMaterial);
    scene.add(sun);

    video.record(canvas, route);

    function animate() {
      stats.start(route);
      const frame = requestAnimationFrame(animate);

      // mesh.rotation.x += (0.001 * config.speed);
      moon.rotation.y += (0.001 * config.speed);
      directionalLight.position.set(Math.sin(count) * 2, 0, Math.cos(count) * 2);
      sun.position.copy(directionalLight.position);
      camera.position.set(Math.sin(count) * 2, 0, Math.cos(count) * 2 - config.cameraDistance / 2);

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

const loadLight = (scene: THREE.Scene, config: any) => {
  // Ambient light
  const ambientLight = new THREE.AmbientLight(
    new THREE.Color(`rgb(${config.light.map(Math.round).join(',')})`),
    0.01
  );
  scene.add(ambientLight);

  // Add a point light behind the moon
  const directionalLight = new THREE.DirectionalLight(0xffddcc, 2);
  scene.add(directionalLight);
  
  return directionalLight;
}

const loadSky = (
  scene: THREE.Scene,
  loader: THREE.TextureLoader,
  config: any,
  path: string
) => {
  const skyTexture = loader.load(new URL(path, import.meta.url) as unknown as string)
  const skyGeometry = new THREE.SphereGeometry(500, 32, 32)
  const skyMaterial = new THREE.MeshBasicMaterial({
    map: skyTexture,
    side: THREE.BackSide
  })
  const sky = new THREE.Mesh(skyGeometry, skyMaterial)
  scene.add(sky)
}

const loadMoon = (
  scene: THREE.Scene,
  textureLoader: THREE.TextureLoader,
  config: any
) => {
  // https://www.solarsystemscope.com/textures/
  const moonTexture = textureLoader.load(moonImage);
  // Adjust the texture offset and repeat
  moonTexture.wrapS = THREE.RepeatWrapping;
  moonTexture.wrapT = THREE.RepeatWrapping;
  moonTexture.offset.set(config.offsetX, config.offsetY); // Offset the texture by 50%
  moonTexture.repeat.set(config.repeatX, config.repeatY); // Repeat the texture 0.5 times in both directions

  const moonGeometry = new THREE.DodecahedronGeometry(config.size, config.details);
  const moonMaterial = new THREE.MeshStandardMaterial({
    map: config.texture ? moonTexture : null,
    wireframe: config.wireframe,
    opacity: config.opacity,
    transparent: true,
    color: config.color ? new THREE.Color(`rgb(${config.fill.map(Math.round).join(',')})`) : undefined,
  });
  const moon = new THREE.Mesh(moonGeometry, moonMaterial);
  moon.castShadow = true;
  moon.receiveShadow = true;
  scene.add(moon);

  return moon;
}
</script>

<template>
  <div ref="statsEl"></div>
  <canvas ref="canvas"></canvas>
</template>

