<script setup lang="ts">
import * as THREE from 'three';
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { video } from '@/utils/video';
import { controls } from '@/utils/control';
import { stats } from '@/utils/stats';
import RAPIER from '@dimforge/rapier3d';
import { animateTimeline, createLights, getRenderer } from '@/utils/threeJs';
import { getBall, getCube } from '@/utils/models';
import { times } from '@/utils/lodash';

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
    const { renderer, scene, camera, clock, orbit } = getEnvironment(canvas);
    createLights(scene, {directionalLightIntensity: config.directional.intensity });
    // getGround(scene, world, { worldSize: 1000.0 });
    times(9, (i) => {
      const x = -20 + 20 * i;
      getCube(scene, world, {
        color: 0xaaaaaa,
        size: [10, 0.2, 3],
        position: [x, 8, 0],
        rotation: [0, -0.7, 10],
      })
    });
    models.push(getBall(scene, world, { position: [10, 10, 0]}));

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
          models.forEach(({ rigidBody }) => {
            rigidBody.resetForces(true);
            rigidBody.resetTorques(true);
            rigidBody.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
            rigidBody.setTranslation({ x: 20, y: 15, z: 0 }, true);
          });
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

