<script setup lang="ts">
import * as THREE from "three";
import { ref, onMounted } from "vue";
import { useRoute } from "vue-router";
import { video } from "@/utils/video";
import { controls } from "@/utils/control";
import { stats } from "@/utils/stats";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import RAPIER from "@dimforge/rapier3d-compat";

const statsEl = ref(null);
const canvas = ref(null);
const route = useRoute();
const cubes = [] as {
  cube: THREE.Mesh<THREE.BoxGeometry, THREE.MeshLambertMaterial, THREE.Object3DEventMap>;
  rigidBody: RAPIER.RigidBody;
}[];

const setCubePosition = (
  click: MouseEvent,
  model: THREE.Mesh<THREE.BoxGeometry, THREE.MeshLambertMaterial, THREE.Object3DEventMap>,
  rigidBody: RAPIER.RigidBody
) => {
  const x = -(click.clientX - window.innerWidth / 2) / 50;
  const y = -(click.clientY - window.innerHeight) / 50;

  model.position.set(x, y, 0);
  rigidBody.setTranslation({ x, y, z: 0 }, true);
};

const createGround = (
  size: CoordinateTuple,
  position: CoordinateTuple,
  scene: THREE.Scene,
  world: RAPIER.World
) => {
  // Create and add model
  const geometry = new THREE.BoxGeometry(...size);
  const material = new THREE.MeshBasicMaterial({ color: 0x333333 });
  const ground = new THREE.Mesh(geometry, material);
  ground.position.set(...position);
  scene.add(ground);

  // Create a dynamic rigid-body.
  RAPIER.RigidBodyDesc.dynamic().setTranslation(...position);

  // Create a cuboid collider attached to the dynamic rigidBody.
  let colliderDesc = RAPIER.ColliderDesc.cuboid(...size).setTranslation(...position);
  let collider = world.createCollider(colliderDesc);

  return { ground, collider };
};

const createCube = (
  size: CoordinateTuple,
  position: CoordinateTuple,
  scene: THREE.Scene,
  orbit: OrbitControls,
  world: RAPIER.World
) => {
  // Create and add model
  const geometry = new THREE.BoxGeometry(...size);
  const material = new THREE.MeshLambertMaterial({ color: 0xdddddd });
  const cube = new THREE.Mesh(geometry, material);
  cube.position.set(...position);
  cube.rotation.set(0.5, 0.5, 0.5);
  orbit.target.copy(cube.position);
  scene.add(cube);

  // Create a dynamic rigid-body.
  let rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(...position);
  let rigidBody = world.createRigidBody(rigidBodyDesc);
  rigidBody.setRotation({ w: 1.0, x: 0.5, y: 0.5, z: 0.5 }, true);

  // Create a cuboid collider attached to the dynamic rigidBody.
  let colliderDesc = RAPIER.ColliderDesc.cuboid(
    ...(size.map((x) => x * 0.6) as CoordinateTuple)
  );
  let collider = world.createCollider(colliderDesc, rigidBody);

  return { cube, rigidBody, collider };
};

onMounted(() => {
  init(
    (canvas.value as unknown) as HTMLCanvasElement,
    (statsEl.value as unknown) as HTMLElement
  ),
    statsEl.value!;
});

const init = (canvas: HTMLCanvasElement, statsEl: HTMLElement) => {
  const config = {
    // size: 50,
  };
  stats.init(route, statsEl);
  controls.create(config, route, {}, () => {
    setup();
  });

  const setup = async () => {
    let gravity = { x: 0.0, y: -9.81, z: 0.0 };
    await RAPIER.init();
    let world = new RAPIER.World(gravity);
    const groundSize = [100.0, 0.1, 20.0] as CoordinateTuple;
    const cubeSize = [1.0, 1.0, 1.0] as CoordinateTuple;
    const cubePosition = [0.0, 5.0, 0.0] as CoordinateTuple;
    const groundPosition = [1, -1, 1] as CoordinateTuple;

    const renderer = new THREE.WebGLRenderer({ canvas: canvas });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x111111); // Set background color to black
    renderer.shadowMap.enabled = true; // Enable shadow maps
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Use soft shadows

    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    const scene = new THREE.Scene();
    const orbit = new OrbitControls(camera, renderer.domElement);

    camera.position.set(0, 15, 15);

    // Add directional light with shadows
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.bias = -0.0001;
    scene.add(directionalLight);

    // Add hemisphere light
    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    scene.add(hemisphereLight);

    createGround(groundSize, groundPosition, scene, world);
    cubes.push(createCube(cubeSize, cubePosition, scene, orbit, world));

    // Change cube position
    document.addEventListener("click", (event) => {
      const { cube, rigidBody } = createCube(cubeSize, cubePosition, scene, orbit, world);
      setCubePosition(event, cube, rigidBody);
      cubes.push({ cube, rigidBody });
    });

    video.record(canvas, route);

    function animate() {
      stats.start(route);
      requestAnimationFrame(animate);
      world.step();

      cubes.forEach(({ cube, rigidBody }) => {
        let position = rigidBody.translation();
        cube.position.set(position.x, position.y, position.z);
        let rotation = rigidBody.rotation();
        cube.rotation.set(rotation.x, rotation.y, rotation.z);
      });

      orbit.update();

      renderer.render(scene, camera);
      video.stop(renderer.info.render.frame, route);
      stats.end(route);
    }
    animate();
  };
  setup();
};
</script>

<template>
  <div ref="statsEl"></div>
  <canvas ref="canvas"></canvas>
</template>
