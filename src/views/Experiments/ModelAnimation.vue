<script setup lang="ts">
import * as THREE from 'three';
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { video } from '@/utils/video';
import { controls } from '@/utils/control';
import { stats } from '@/utils/stats';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import RAPIER from '@dimforge/rapier3d';
import terrainTextureAsset from '@/assets/terrain.jpg';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

type Model = THREE.Group<THREE.Object3DEventMap>

const statsEl = ref(null)
const canvas = ref(null)
const route = useRoute();
const groundSize = [1000.0, 0.1, 1000.0] as CoordinateTuple;
const sphereSize = () => Math.random() * 0.5 + 0.5;
const groundPosition = [1, -1, 1] as CoordinateTuple;
let gravity = { x: 0.0, y: -9.81, z: 0.0 };
let world = new RAPIER.World(gravity);

onMounted(() => {
  init(
    canvas.value as unknown as HTMLCanvasElement,
    statsEl.value as unknown as HTMLElement,
  ), statsEl.value!;
})

const init = async (canvas: HTMLCanvasElement, statsEl: HTMLElement, ) => {
  const config = {
    // size: 50,
  }
  stats.init(route, statsEl);
  controls.create(config, route, {
  }, () => {
    setup()
  });

  const setup = async () => {
    const renderer = getRenderer(canvas);
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const scene = new THREE.Scene();
    const orbit = new OrbitControls(camera, renderer.domElement);
    const clock = new THREE.Clock();

    camera.position.set(-30, 25, 30);
    scene.fog = new THREE.Fog( 0xaaaaff, 1)

    createLights(scene);
    const { texture: groundTexture } = getGround(groundSize, groundPosition, scene, world);
    const { model, mixer } = await loadAnimatedModel();
    scene.add(model);

    video.record(canvas, route);

    function animate() {
      stats.start(route);
      requestAnimationFrame(animate);
      const delta = clock.getDelta();
      mixer.update(delta);

      orbit.update();
      groundTexture.offset.y -= 0.0015;

      renderer.render( scene, camera );
      video.stop(renderer.info.render.frame ,route);
      stats.end(route);
    }
    animate();
  }
  setup();
}

const getRenderer = (canvas: HTMLCanvasElement) => {
  const renderer = new THREE.WebGLRenderer({ canvas: canvas });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0xaaaaff); // Set background color to black
  renderer.shadowMap.enabled = true; // Enable shadow maps
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Use soft shadows
  return renderer;
}

const createLights = (scene: THREE.Scene) => {
  // Add directional light with shadows
  const directionalLight = new THREE.DirectionalLight(0xffffaa, 1.2);
  directionalLight.position.set(5, 5, 5);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 50;

  // Camera frustum
  directionalLight.shadow.camera.left = -20;
  directionalLight.shadow.camera.right = 20;
  directionalLight.shadow.camera.top = 20;
  directionalLight.shadow.camera.bottom = -20;
  directionalLight.shadow.bias = -0.0001;
  scene.add(directionalLight);

  // const shadowCameraHelper = new THREE.CameraHelper(directionalLight.shadow.camera);
  // scene.add(shadowCameraHelper);
  
  const ambient = new THREE.AmbientLight( 0xffffff, 0.2 );
  ambient.position.set(5, 5, 5);
  scene.add( ambient )
}

/**
 * Get default textures
 * @param img 
 * @returns 
 */
const getTextures = (img: string) => {
  const textureLoader = new THREE.TextureLoader();
  const texture = textureLoader.load(img);

  // Adjust the texture offset and repeat
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.offset.set(1, 1); // Offset the texture by 50%
  texture.repeat.set(1, 1); // Repeat the texture 0.5 times in both directions

  return texture;
}

/**
 * Create scene ground with physics, texture, and shadow
 * @param size 
 * @param position 
 * @param scene 
 * @param world 
 */
const getGround = (
  size: CoordinateTuple,
  position: CoordinateTuple,
  scene: THREE.Scene,
  world: RAPIER.World
) => {
  // Create and add model
  const texture = getTextures(terrainTextureAsset);
  const material = new THREE.MeshPhysicalMaterial({
    map: texture,
    reflectivity: 0.3,
  });
  const geometry = new THREE.BoxGeometry( ...size);
  const ground = new THREE.Mesh(geometry, material);
  ground.position.set(...position);
  ground.receiveShadow = true;
  scene.add(ground);

  // Create a dynamic rigid-body.
  let rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(...position);

  // Create a cuboid collider attached to the dynamic rigidBody.
  let colliderDesc = RAPIER.ColliderDesc.cuboid(...size).setTranslation(...position);
  let collider = world.createCollider(colliderDesc);

  return { ground, collider, texture };
}

/**
 * Return threeJS valid 3D model
 */
const loadGLTF = (): Promise<{ model: Model, gltf: any}> => {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load('/low_poly.glb', (gltf) => {
      resolve({model: gltf.scene, gltf});
    }, undefined, reject);
  });
}

const loadAnimatedModel = async () => {
  const { model, gltf } = await loadGLTF();
  model.castShadow = true;
  model.receiveShadow = false; //default
  model.position.set(0, -1, 0);
  model.scale.set(8, 8, 8);
  // Ensure the model casts and receives shadows
  model.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  // Add animation
  const mixer = new THREE.AnimationMixer(model)
  const action = mixer.clipAction(gltf.animations[0]);
  action.play();

  return { model, mixer }
}
</script>

<template>
  <div ref="statsEl"></div>
  <canvas ref="canvas"></canvas>
</template>

