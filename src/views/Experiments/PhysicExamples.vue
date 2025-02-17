<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { video } from '@/utils/video';
import { controls } from '@/utils/control';
import { stats } from '@/utils/stats';
import RAPIER from '@dimforge/rapier3d';
import { animateTimeline, createLights, getEnvironment } from '@/utils/threeJs';
import { getBall, getCube } from '@/utils/models';
import { times } from '@/utils/lodash';

const statsEl = ref(null)
const canvas = ref(null)
const route = useRoute();
let gravity = { x: 0.0, y: -9.81, z: 0.0 };
let world = new RAPIER.World(gravity);

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

    const experiments = [
      getBall(scene, world, { restitution: 0.5 }), // Rubber
      getBall(scene, world, {size: 5, damping: 8, color: 0xfafafa}), // Balloon
      getBall(scene, world, {size: 4, weight: 50, restitution: -0.5}), // Bowling
      getBall(scene, world, {size: 1.5, damping: 1.5, restitution: -0.5, weight: 6, color: 0xffffff}), // Paper
      getBall(scene, world, {size: 1.5, weight: 5, color: 0xffff00}), // Tennis
      getBall(scene, world, {size: 0.8, weight: 6, restitution: 0.2, color: 0xffffff}), // Ping Pong
    ];

    const rows = 3;
    const gaps = { x: 22, y: 20 };
    times(experiments.length, (i) => {
      const x = -20 + (i % rows) * gaps.x;
      const y = 5 + Math.floor(i / rows) * -gaps.y;
      getCube(scene, world, {
        color: 0xaaaaaa,
        size: [10, 0.2, 3],
        position: [x, y, 0],
        rotation: [0, -0.7, 10],
      })

      experiments[i].initialValues.position = [x, y + 15, 0]
      experiments[i].rigidBody.setTranslation({ x, y: y + 10, z: 0 }, true);
    });

    video.record(canvas, route);

    function animate() {
      stats.start(route);
      const delta = clock.getDelta();
      const frame = requestAnimationFrame(animate);
      world.step();

      experiments.forEach(({ mesh, rigidBody }) => {
        let position = rigidBody.translation();
        mesh.position.set(position.x, position.y, position.z);
        let rotation = rigidBody.rotation();
        mesh.rotation.set(rotation.x, rotation.y, rotation.z);
      });
      // experiments[0].mesh.position.y -= 0.1;
      animateTimeline([{
        interval: [10, 300], action: () => {
          experiments.forEach(({ rigidBody, initialValues: { position: [x, y, z]} }) => {
            rigidBody.resetForces(true);
            rigidBody.resetTorques(true);
            rigidBody.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
            rigidBody.setTranslation({ x, y, z }, true);
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

