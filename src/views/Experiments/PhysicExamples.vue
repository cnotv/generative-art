<script setup lang="ts">
import * as THREE from 'three';
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { video } from '@/utils/video';
import { controls } from '@/utils/control';
import { stats } from '@/utils/stats';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import RAPIER from '@dimforge/rapier3d';
import { animateTimeline, createLights, getRenderer } from '@/utils/threeJs';
import { getBall, getCube } from '@/utils/models';

const statsEl = ref(null)
const canvas = ref(null)
const route = useRoute();
let gravity = { x: 0.0, y: -9.81, z: 0.0 };
let world = new RAPIER.World(gravity);
const models = [] as { mesh: THREE.Mesh<any>, rigidBody: RAPIER.RigidBody, collider: RAPIER.Collider }[];

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
      intensity: 5,
    },
    ambient: {
      enabled: true,
      intensity: 2,
    },
  }
  stats.init(route, statsEl);
  controls.create(config, route, {
  }, () => {
    setup()
  });

  const setup = () => {
    const renderer = getRenderer(canvas);
    const scene = new THREE.Scene();
    const clock = new THREE.Clock();

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = -20;
    camera.position.y = 10;
    const orbit = new OrbitControls(camera, renderer.domElement);

    createLights(scene, {directionalLightIntensity: config.directional.intensity });
    // getGround(scene, world, { worldSize: 1000.0 });
    getCube(scene, world, {
      size: [10, 0.2, 3],
      position: [20, 0, 0],
      rotation: [0, 0, 10],
    });
    models.push(getBall(scene, world, { position: [20, 10, 0]}));

    video.record(canvas, route);

    function animate() {
      stats.start(route);
      const delta = clock.getDelta();
      const frame = requestAnimationFrame(animate);
      world.step();

      models.forEach(({ mesh, rigidBody }) => {
        let position = rigidBody.translation();
        mesh.position.set(position.x, position.y, position.z);
        let rotation = rigidBody.rotation();
        mesh.rotation.set(rotation.x, rotation.y, rotation.z);
      });
      // models[0].mesh.position.y -= 0.1;
      animateTimeline([{
        interval: [2, 200], action: () => {
          models[0].rigidBody.resetForces(true);
          models[0].rigidBody.resetTorques(true);
          models[0].rigidBody.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
          models[0].rigidBody.setTranslation({x: 20, y: 15, z: 0}, true);
        }},
      ], frame);

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

