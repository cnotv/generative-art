<script setup lang="ts">
import * as THREE from 'three';
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { video } from '@/utils/video';
import { controls } from '@/utils/control';
import { stats } from '@/utils/stats';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import RAPIER from '@dimforge/rapier3d';

const statsEl = ref(null)
const canvas = ref(null)
const route = useRoute();

const setCubePosition = (
  click: MouseEvent,
  model: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial, THREE.Object3DEventMap>,
  rigidBody: RAPIER.RigidBody
) => {
  const x = - (click.clientX - window.innerWidth / 2) / 50;
  const y = - (click.clientY - window.innerHeight) / 50;

  model.position.set(x, y, 0);
  rigidBody.setTranslation({ x, y, z: 0 }, true);
}

const createGround = (
  size: [number, number, number],
  position: [number, number, number],
  scene: THREE.Scene,
  world: RAPIER.World
) => {
  // Create and add model
  const geometry = new THREE.BoxGeometry( ...size);
  const material = new THREE.MeshBasicMaterial( { color: 0x333333 } );
  const ground = new THREE.Mesh(geometry, material);
  ground.position.set(...position);
  scene.add(ground);

  // Create a dynamic rigid-body.
  let rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(...position);

  // Create a cuboid collider attached to the dynamic rigidBody.
  let colliderDesc = RAPIER.ColliderDesc.cuboid(...size).setTranslation(...position);
  let collider = world.createCollider(colliderDesc);

  return { ground, collider };
}

const createCube = (
  size: [number, number, number],
  position: [number, number, number],
  scene: THREE.Scene,
  orbit: OrbitControls,
  world: RAPIER.World
) => {
  // Create and add model
  const geometry = new THREE.BoxGeometry( ...size);
  const material = new THREE.MeshBasicMaterial( { color: 0xffffff } );
  const cube = new THREE.Mesh(geometry, material);
  cube.position.set(...position);
  orbit.target.copy(cube.position);
  scene.add(cube);

  // Create a dynamic rigid-body.
  let rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(...position);
  let rigidBody = world.createRigidBody(rigidBodyDesc);

  // Create a cuboid collider attached to the dynamic rigidBody.
  let colliderDesc = RAPIER.ColliderDesc.cuboid(...size);
  let collider = world.createCollider(colliderDesc, rigidBody);

  return { cube, rigidBody, collider };
}

onMounted(() => {
  init(
    canvas.value as unknown as HTMLCanvasElement,
    statsEl.value as unknown as HTMLElement,
  ), statsEl.value!;
})

const init = (canvas: HTMLCanvasElement, statsEl: HTMLElement, ) => {
  const config = {
    // size: 50,
  }
  stats.init(route, statsEl);
  controls.create(config, route, {
    // size: {  },
    // details: {},
    // wireframe: {},
    // background: { addColor: []},
    // fill: { addColor: []},
    // light: { addColor: []},
  }, () => {
    setup()
  });

  const setup = () => {
    let gravity = { x: 0.0, y: -9.81, z: 0.0 };
    let world = new RAPIER.World(gravity);
    const groundSize = [100.0, 0.1, 20.0] as [number, number, number];
    const cubeSize = [1.0, 1.0, 1.0] as [number, number, number];
    const cubePosition = [0.0, 5.0, 0.0] as [number, number, number];
    const groundPosition = [1, -1, 1] as [number, number, number];

    const renderer = new THREE.WebGLRenderer({ canvas: canvas });
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.setClearColor(0x000000); // Set background color to black
    
    const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
    const scene = new THREE.Scene();
    const orbit = new OrbitControls(camera, renderer.domElement);
    
    camera.position.z = -10;
    camera.position.y = 4;

    createGround(groundSize, groundPosition, scene, world);
    const { cube: cube1, rigidBody: rigidBody1 } = createCube(cubeSize, cubePosition, scene, orbit, world);

    // Change cube position
    document.addEventListener('click', (event) => setCubePosition(event, cube1, rigidBody1));

    video.record(canvas, route);

    function animate() {
      stats.start(route);
      requestAnimationFrame(animate);
      world.step();

      // Get the rigid-body's position.
      let position = rigidBody1.translation();
      cube1.position.set(position.x, position.y, position.z);

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

