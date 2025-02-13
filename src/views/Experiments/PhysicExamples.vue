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

    const bouncyBall = getBall(scene, world)
    const pingPongBall = getBall(scene, world)
    const bowlingBall = getBall(scene, world)
    const paperBall = getBall(scene, world)
    const tennisBall = getBall(scene, world)
    const rubberBall = getBall(scene, world)
    const experiments = [
      bouncyBall,
      pingPongBall,
      bowlingBall,
      paperBall,
      tennisBall,
      rubberBall
    ];

    times(experiments.length, (i) => {
      const x = -20 + (i % 3) * 20;
      const y = 5 + Math.floor(i / 3) * -20;
      getCube(scene, world, {
        color: 0xaaaaaa,
        size: [10, 0.2, 3],
        position: [x, y, 0],
        rotation: [0, -0.7, 10],
      })

      experiments[i].initialValues.position = [x, y + 10, 0]
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
        interval: [10, 200], action: () => {
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

