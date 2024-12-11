<script setup lang="ts">
import * as THREE from 'three';
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { video } from '@/utils/video';
import { controls } from '@/utils/control';
import { stats } from '@/utils/stats';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

type ProjectConfig = any;

const statsEl = ref(null)
const canvas = ref(null)
const route = useRoute();
const cubes = [] as THREE.Mesh<any>[];

/**
 * Reflection
 * https://github.com/mrdoob/three.js/blob/master/examples/webgl_materials_cubemap.html
 * https://threejs.org/examples/#webgl_animation_skinning_ik
 * https://paulbourke.net/panorama/cubemaps/
 */
const cubeFaces = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
const urls = cubeFaces.map(code => new URL(`../../assets/cubemaps/stairs/${code}.jpg`, import.meta.url).href);
const reflection = new THREE.CubeTextureLoader().load( urls );

// Define different mesh types
const meshTypes = [
  'MeshBasicMaterial',
  'MeshLambertMaterial',
  'MeshPhongMaterial',
  'MeshStandardMaterial',
  'MeshPhysicalMaterial',
  'MeshToonMaterial',
  'MeshNormalMaterial',
  'MeshDepthMaterial',
  // 'MeshDistanceMaterial',
  // 'MeshMatcapMaterial',
];

onMounted(() => {
  init(
    canvas.value as unknown as HTMLCanvasElement,
    statsEl.value as unknown as HTMLElement,
  ), statsEl.value!;
})

const init = (canvas: HTMLCanvasElement, statsEl: HTMLElement, ) => {
  const config = {
    size: 1,
    exposure: 5,
    directionalLight: 5,
    hemisphereLight: 1,
    wireframe: false,
    reflection: true,
    reflectivity: .2,
    roughness: 0.3,
    metalness: 0.8,
    transmission: 1,
  };
  stats.init(route, statsEl);
  controls.create(config, route, {
    size: {},
    exposure: {},
    directionalLight: {},
    hemisphereLight: {},
    wireframe: {},
    reflection: {},
    reflectivity: {},
    roughness: {},
    metalness: {},
    transmission: {},
  }, () => {
    setup()
  });

  const setup = () => {
    const groundSize = [100.0, 0.1, 100.0] as CoordinateTuple;
    const cubeSize = [config.size, config.size, config.size] as CoordinateTuple;
    const groundPosition = [meshTypes.length/2 * 1, 0, 1] as CoordinateTuple;

    const renderer = new THREE.WebGLRenderer({ canvas: canvas });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x111111); // Set background color to black
    renderer.shadowMap.enabled = true; // Enable shadow maps
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Use soft shadows

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const scene = new THREE.Scene();
    const orbit = new OrbitControls(camera, renderer.domElement);
    scene.background = reflection;

    camera.position.z = -10;
    camera.position.y = 4;

    // Add directional light with shadows
    const directionalLight = new THREE.DirectionalLight(0xffffff, config.directionalLight);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.bias = -0.0001;
    scene.add(directionalLight);

    let count = 0;
    setInterval(() => {
      count += 0.1;
    }, 100);

    // Add hemisphere light
    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, config.hemisphereLight);
    scene.add(hemisphereLight);

    createGround(groundSize, groundPosition, scene, orbit);

    // Create a cube for each mesh type
    meshTypes.forEach((meshType, index) => {
      const gap = index * config.size * 3;
      const position = [config.size + gap, config.size, config.size] as CoordinateTuple;
      cubes.push(createCube(cubeSize, position, scene, meshType, config));
      createText(meshType, position, scene, config);
    });

    video.record(canvas, route);

    function animate() {
      stats.start(route);
      requestAnimationFrame(animate);

      orbit.update();

      directionalLight.position.set(Math.sin(count) * 2, 5, Math.cos(count) * 2);
      hemisphereLight.position.set(Math.sin(count) * 2, 5, Math.cos(count) * 2);
      renderer.render( scene, camera );
      video.stop(renderer.info.render.frame ,route);
      stats.end(route);
    }
    animate();
  }
  setup();
}

const createGround = (
  size: CoordinateTuple,
  position: CoordinateTuple,
  scene: THREE.Scene,
  orbit: OrbitControls,
) => {
  // Create and add model
  const geometry = new THREE.BoxGeometry( ...size);
  const material = new THREE.MeshBasicMaterial({ color: 0x333333 });
  material.opacity = 0.7;
  material.transparent = true;
  const ground = new THREE.Mesh(geometry, material);
  ground.position.set(...position);
  orbit.target.copy(ground.position);
  scene.add(ground);

  return ground;
}

const createText = (
  text: string,
  position: CoordinateTuple,
  scene: THREE.Scene,
  config: ProjectConfig,
) => {
  const fontLoader = new FontLoader();
  fontLoader.load( 'https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', ( font ) => {
    // Create text geometry
    const textGeometryOptions = {
      font: font,
      size: 0.2,
      height: 0.1,
    }
    const textGeometry = new TextGeometry(text, textGeometryOptions);

    // Create text material
    const textMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const textMesh = new THREE.Mesh(textGeometry, textMaterial);

    // Position the text below the sphere
    textMesh.position.set(position[0] - (config.size / 2 * text.length * textGeometryOptions.size / 2 ), position[1] + 1 + config.size, position[2]);
    scene.add(textMesh);
  });
}

const createCube = (
  size: CoordinateTuple,
  position: CoordinateTuple,
  scene: THREE.Scene,
  meshType: string,
  config: ProjectConfig,
) => {
  // Create and add model
  const geometry = new THREE.SphereGeometry(size[0]);
  const reflectionOptions = config.reflection ? {
    envMap: reflection,      
    // envMap: scene.background,      
    combine: THREE.MixOperation,     
    reflectivity: config.reflectivity,
    roughness: config.roughness,
    metalness: config.metalness,
    transmission: config.transmission,
  }: {};
  const material = new THREE[meshType]({
    color: 0x123456,
    ...reflectionOptions,
  });
  material.wireframe = config.wireframe;
  // material.reflection = config.reflection;
  const cube = new THREE.Mesh(geometry, material);
  cube.position.set(...position);
  scene.add(cube);

  return cube;
}
</script>

<template>
  <div ref="statsEl"></div>
  <canvas ref="canvas"></canvas>
</template>

