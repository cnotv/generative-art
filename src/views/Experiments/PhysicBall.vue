<script setup lang="ts">
import * as THREE from 'three';
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { video } from '@/utils/video';
import { controls } from '@/utils/control';
import { stats } from '@/utils/stats';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import RAPIER from '@dimforge/rapier3d';
import { RectAreaLightHelper } from 'three/addons/helpers/RectAreaLightHelper.js';

type ProjectConfig = any;

const statsEl = ref(null)
const canvas = ref(null)
const route = useRoute();
const models = [] as { mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshPhysicalMaterial, THREE.Object3DEventMap>, rigidBody: RAPIER.RigidBody}[];
const groundSize = [1000.0, 0.1, 1000.0] as [number, number, number];
const sphereSize = () => Math.random() * 0.5 + 0.5;
const modelPosition = [0.0, 5.0, 0.0] as [number, number, number];
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

const init = (canvas: HTMLCanvasElement, statsEl: HTMLElement, ) => {
  const config = {
    directional: {
      enabled: true,
      helper: false,
      intensity: 10,
    },
    area: {
      enabled: true,
      helper: false,
      intensity: 1,
      width: 10,
      height: 10,
    },
    ambient: {
      enabled: true,
      intensity: 0.2,
    },
    hemisphere: {
      enabled: true,
      helper: false,
      intensity: 1,
    },
    point: {
      enabled: true,
      helper: false,
      intensity: 1,
    },
    spot: {
      enabled: true,
      helper: false,
      intensity: 1,
    },
    // size: 50,
  }
  stats.init(route, statsEl);
  controls.create(config, route, {
    directional: {
      enabled: {},
      intensity: {},
      helper: {},
    },
    area: {
      enabled: {},
      intensity: {},
      width: {},
      height: {},
      helper: {},
    },
    ambient: {
      enabled: {},
      intensity: {},
    },
    hemisphere: {
      enabled: {},
      helper: {},
      intensity: {},
    },
    point: {
      enabled: {},
      helper: {},
      intensity: {},
    },
    spot: {
      enabled: {},
      helper: {},
      intensity: {},
    },
  }, () => {
    setup()
  });

  const setup = () => {
    const renderer = getRenderer(canvas);
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const scene = new THREE.Scene();
    const orbit = new OrbitControls(camera, renderer.domElement);

    camera.position.z = -20;
    camera.position.y = 10;

    createLights(scene, config);
    getGround(groundSize, groundPosition, scene, world);
    models.push(getModel(sphereSize(), modelPosition, scene, orbit, world));

    // Change mesh position
    document.addEventListener('click', (event) => {
      const { mesh, rigidBody } = getModel(sphereSize(), modelPosition, scene, orbit, world);
      setModelPosition(event, mesh, rigidBody);
      models.push({ mesh, rigidBody });
    });

    video.record(canvas, route);

    function animate() {
      stats.start(route);
      requestAnimationFrame(animate);
      world.step();

      models.forEach(({ mesh, rigidBody }) => {
        let position = rigidBody.translation();
        mesh.position.set(position.x, position.y, position.z);
        let rotation = rigidBody.rotation();
        mesh.rotation.set(rotation.x, rotation.y, rotation.z);
      });

      orbit.update();

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
  renderer.setClearColor(0x777777); // Set background color to black
  renderer.shadowMap.enabled = true; // Enable shadow maps
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Use soft shadows
  return renderer;
}

const createLights = (scene: THREE.Scene, config: ProjectConfig) => {
  if (config.directional.enabled) {
    // Add directional light with shadows
    const directionalLight = new THREE.DirectionalLight(0xffffff, config.directional.intensity);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -30;
    directionalLight.shadow.camera.right = 30;
    directionalLight.shadow.camera.top = 30;
    directionalLight.shadow.camera.bottom = -30;
    directionalLight.shadow.bias = -0.0001;
    scene.add(directionalLight);

    if (config.directional.helper) {
      // Add light helper
      const helper = new THREE.DirectionalLightHelper(directionalLight, 5);
      scene.add(helper);
    }
  }

  if (config.area.enabled) {
    const rectLight = new THREE.RectAreaLight( 0xffffff, config.area.intensity, config.area.width, config.area.height );
    rectLight.position.set(5, 5, 5);
    rectLight.lookAt( 0, 0, 0 );
    scene.add(rectLight)

    if (config.area.helper) {
      // Add light helper
      const helper = new RectAreaLightHelper(rectLight, 5);
      scene.add(helper);
    }
  }

  if (config.ambient.enabled) {
    const ambient = new THREE.AmbientLight( 0xffffff, config.ambient.intensity );
    ambient.position.set(5, 5, 5);
    scene.add( ambient )
  }

  if (config.hemisphere.enabled) {
    const hemisphereLight = new THREE.HemisphereLight( 0xffffff, 0xffffff, config.hemisphere.intensity );
    hemisphereLight.color.setHSL( 0.6, 1, 0.6 );
    hemisphereLight.groundColor.setHSL( 0.095, 1, 0.75 );
    hemisphereLight.position.set( 0, 50, 0 );
    scene.add( hemisphereLight );

    if (config.hemisphere.helper) {
      const hemisphereLightHelper = new THREE.HemisphereLightHelper( hemisphereLight, 10 );
      scene.add( hemisphereLightHelper );
    }
  }

  if (config.point.enabled) {
    const pointLight = new THREE.PointLight(0xffffff, 1.2);
    pointLight.position.set(5, 5, 5);
    pointLight.castShadow = true;
    pointLight.shadow.mapSize.width = 2048;
    pointLight.shadow.mapSize.height = 2048;
    pointLight.shadow.camera.near = 0.5;
    pointLight.shadow.camera.far = 50;
    pointLight.shadow.bias = -0.0001;
    scene.add(pointLight);

    if (config.hemisphere.helper) {
      const pointLightHelper = new THREE.PointLightHelper( pointLight, 10 );
      scene.add( pointLightHelper );
    }
  }

  if (config.spot.enabled) {
    const spotLight = new THREE.SpotLight(0xffffff, 1.2);
    spotLight.position.set(5, 5, 5);
    spotLight.castShadow = true;
    spotLight.shadow.mapSize.width = 2048;
    spotLight.shadow.mapSize.height = 2048;
    spotLight.shadow.camera.near = 0.5;
    spotLight.shadow.camera.far = 50;
    spotLight.shadow.bias = -0.0001;
    scene.add(spotLight);

    if (config.spot.helper) {
      const spotLightHelper = new THREE.SpotLightHelper( spotLight, 10 );
      scene.add( spotLightHelper );
    }
  }
}

/**
 * Reassign ball position on click
 * @param click 
 * @param model 
 * @param rigidBody 
 */
const setModelPosition = (
  click: MouseEvent,
  model: THREE.Mesh<THREE.SphereGeometry, THREE.MeshPhysicalMaterial, THREE.Object3DEventMap>,
  rigidBody: RAPIER.RigidBody
) => {
  const x = - (click.clientX - window.innerWidth / 2) / 50;
  const y = - (click.clientY - window.innerHeight) / 50;

  model.position.set(x, y, 0);
  rigidBody.setTranslation({ x, y, z: 0 }, true);
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
  const geometry = new THREE.BoxGeometry( ...size);
  const material = new THREE.MeshPhysicalMaterial({
    color: 0x222222,
    // envMap: reflection,
    reflectivity: 0.3,
    roughness: 0.3,
    transmission: 1,
  });
  const ground = new THREE.Mesh(geometry, material);
  ground.position.set(...position);
  ground.receiveShadow = true;
  scene.add(ground);

  // Create a dynamic rigid-body.
  let rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(...position);

  // Create a cuboid collider attached to the dynamic rigidBody.
  let colliderDesc = RAPIER.ColliderDesc.cuboid(...size).setTranslation(...position);
  let collider = world.createCollider(colliderDesc);

  return { ground, collider };
}

/**
 * Create a ball with physics, texture, and shadow
 * Friction and bounciness is size based
 * @param size 
 * @param position 
 * @param scene 
 * @param orbit 
 * @param world 
 */
const getModel = (
  size: number,
  position: [number, number, number],
  scene: THREE.Scene,
  orbit: OrbitControls,
  world: RAPIER.World
) => {
  // Create and add model
  const geometry = new THREE.SphereGeometry(size);
  const material = new THREE.MeshPhysicalMaterial({
    color: 0x222222,
    // envMap: reflection,
    reflectivity: 0.2,
    roughness: 0.3,
    metalness: 0.5,
    transmission: 1,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.rotation.set(0.5, 0.5, 0.5);
  mesh.castShadow = true;
  mesh.receiveShadow = false; //default
  orbit.target.copy(mesh.position);
  scene.add(mesh);

  // Create a dynamic rigid-body.
  let rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(...position);
  let rigidBody = world.createRigidBody(rigidBodyDesc);
  rigidBody.setRotation({ w: 1.0, x: 0.5, y: 0.5, z: 0.5 }, true);

  // Create a cuboid collider attached to the dynamic rigidBody.
  let colliderDesc = RAPIER.ColliderDesc
    .ball(size)
    .setRestitution(1 / size / 3)
    .setFriction(5 * size);
  let collider = world.createCollider(colliderDesc, rigidBody);

  return { mesh, rigidBody, collider };
}
</script>

<template>
  <div ref="statsEl"></div>
  <canvas ref="canvas"></canvas>
</template>

