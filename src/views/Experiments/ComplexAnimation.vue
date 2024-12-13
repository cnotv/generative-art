<script setup lang="ts">
import * as THREE from 'three';
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { video } from '@/utils/video';
import { controls } from '@/utils/control';
import { stats } from '@/utils/stats';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import RAPIER from '@dimforge/rapier3d';
import terrainTextureAsset from '@/assets/grass.jpg';
import { createLights, getGround, getRenderer, loadAnimation, loadFBX, loadGLTF, setThirdPersonCamera, cloneModel, instanceMatrix, getInstanceConfig } from '@/utils/threeJs';
import { complexAnimation as config } from '@/config/scenes';
import { getBlade } from '@/utils/custom-models';

const statsEl = ref(null)
const canvas = ref(null)
const route = useRoute();
const groundSize = [1000.0, 0.1, 1000.0] as CoordinateTuple;
const groundPosition = [1, -1, 1] as CoordinateTuple;
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
  stats.init(route, statsEl);
  controls.create(config, route, {
    tree: {
      show: {},
      amount: {},
      size: {},
      sizeDelta: {},
      area: {},
    },
    grass: {
      show: {},
      amount: {},
      size: {},
      sizeDelta: {},
      area: {},
    },
    mushroom: {
      show: {},
      amount: {},
      size: {},
      sizeDelta: {},
      area: {},
    },
  }, () => {
    setup()
  });

  const setup = async () => {
    const renderer = getRenderer(canvas);
    const camera = new THREE.PerspectiveCamera(config.fov, config.aspect, config.near, config.far);
    const scene = new THREE.Scene();
    const orbit = new OrbitControls(camera, renderer.domElement);
    const clock = new THREE.Clock();
    const instancedModels = {
      tree: getInstanceConfig(config.tree, groundSize),
      grass: getInstanceConfig(config.grass, groundSize),
      mushroom: getInstanceConfig(config.mushroom, groundSize),
    } as Record<string, ModelOptions[]>

    camera.position.set(-30, 25, 30);
    scene.fog = new THREE.Fog( 0xaaaaff, 1)

    const { directionalLight} = createLights(scene);
    getGround(groundSize, groundPosition, scene, world, terrainTextureAsset);

    // Add girl
    const girl = await loadFBX('character.fbx', { position: [0, -1, 0], scale: [0.1, 0.1, 0.1] });
    const animationWalk = await loadAnimation(girl, 'walk.fbx');
    scene.add(girl);

    // Populate trees
    if (config.tree.show) {
      const { model: tree } = await loadGLTF('tree.glb');
      cloneModel(tree, scene, instancedModels.tree);
    }

    // Populate grass
    if (config.grass.show) {
      const grass = getBlade();
      instanceMatrix(grass, scene, instancedModels.grass);
    }

    // Populate mushrooms
    if (config.mushroom.show) {
      const { model: mushroom } = await loadGLTF('cute_mushrooms.glb');
      cloneModel(mushroom, scene, instancedModels.mushroom);
    }

    video.record(canvas, route);

    function animate() {
      stats.start(route);
      const frame = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      animationWalk.update(delta);
      // girl.position.z += 0.15;
      directionalLight.position.copy({ x: girl.position.x + 5, y: girl.position.y + 5, z: girl.position.z + 5});
      // setThirdPersonCamera(camera, config, girl);

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

