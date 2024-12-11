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
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

type Model = THREE.Group<THREE.Object3DEventMap>
interface ModelOptions {
  position?: [number, number, number];
  scale?: [number, number, number];
}

const statsEl = ref(null)
const canvas = ref(null)
const route = useRoute();
const groundSize = [1000.0, 0.1, 1000.0] as [number, number, number];
const sphereSize = () => Math.random() * 0.5 + 0.5;
const groundPosition = [1, -1, 1] as [number, number, number];
let gravity = { x: 0.0, y: -9.81, z: 0.0 };
let world = new RAPIER.World(gravity);

/**
 * Reflection
 * https://github.com/mrdoob/three.js/blob/master/examples/webgl_materials_cubemap.html
 * https://threejs.org/examples/#webgl_animation_skinning_ik
 * https://paulbourke.net/panorama/cubemaps/
 */
const cubeFaces = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
const urls = cubeFaces.map(code => new URL(`../../assets/cubemaps/stairs/${code}.jpg`, import.meta.url).href);
const reflection = new THREE.CubeTextureLoader().load( urls );

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
    const girl = await loadFBX('character.fbx', { position: [0, -1, 0], scale: [0.15, 0.15, 0.15] });
    const animationWalk = await loadAnimation(girl, 'walk.fbx');
    scene.add(girl);

    video.record(canvas, route);

    function animate() {
      stats.start(route);
      requestAnimationFrame(animate);
      const delta = clock.getDelta();
      animationWalk.update(delta);

      orbit.update();
      groundTexture.offset.y -= 0.00015;

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
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
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
  
  const ambient = new THREE.AmbientLight( 0xffffff, 0.5 );
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
  size: [number, number, number],
  position: [number, number, number],
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

const loadFBX = (fileName: string, { position, scale }: ModelOptions = {}): Promise<Model> => {
  return new Promise((resolve, reject) => {
    const loader = new FBXLoader();
    loader.load(`/${fileName}`, (model) => {
      if (position) model.position.set(...position);
      if (scale) model.scale.set(...scale);
      model.castShadow = true;
      model.receiveShadow = false; //default
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      resolve(model)
    }, undefined, reject);
  });
}

/**
 * Return threeJS valid 3D model
 */
const loadGLTF = (fileName: string, { position, scale }: ModelOptions = {}): Promise<{ model: Model, gltf: any}> => {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(`/${fileName}`, (gltf) => {
      const model = gltf.scene;
      model.castShadow = true;
      model.receiveShadow = false; //default
      if (position) model.position.set(...position);
      if (scale) model.scale.set(...scale);
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      resolve({ model, gltf });
    }, undefined, reject);
  });
}

const loadAnimation = (model: Model, fileName: string): Promise<THREE.AnimationMixer> => {
  return new Promise((resolve, reject) => {
    // Add animation
    const loader = new FBXLoader();
    loader.load(`/${fileName}`, (animation) => {
    const mixer = new THREE.AnimationMixer(model);
      const action = mixer.clipAction((model?.animations[0] ? model : animation).animations[0]);
      action.play();
      resolve(mixer);
    });
  });
}
</script>

<template>
  <div ref="statsEl"></div>
  <canvas ref="canvas"></canvas>
</template>

