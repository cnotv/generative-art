<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { video } from '@/utils/video';
import { controls } from '@/utils/control';
import { stats } from '@/utils/stats';
import { bindAnimatedElements, animateTimeline, createLights, getEnvironment, getGround, getModel, resetAnimation, removeElements } from '@/utils/threeJs';
import { getBall, getWalls } from '@/utils/models';
import { times } from '@/utils/lodash';
import bowlingTexture from '@/assets/bowling.png';

const statsEl = ref(null)
const canvas = ref(null)
const route = useRoute();

onMounted(() => {
  init(
    canvas.value as unknown as HTMLCanvasElement,
    statsEl.value as unknown as HTMLElement,
  ), statsEl.value!;
})

const init = async (canvas: HTMLCanvasElement, statsEl: HTMLElement, ) => {
  const config = {
    directional: {
      enabled: true,
      helper: false,
      intensity: 2,
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

  const setup = async () => {
    const length = 25;
    const { renderer, scene, camera, clock, orbit, world } = getEnvironment(canvas, { camera: { position: [-35, 250, -200] } });
    createLights(scene, {directionalLightIntensity: config.directional.intensity });
    // getGround(scene, world, { worldSize: 1000.0 });
    getWalls(scene, world, { length, height: 200, depth: 10, opacity: 0 });

    let experiments = [] as any[];
    const addBall = (position: CoordinateTuple) => {
      experiments.push(getBall(scene, world, {position, size: 0.5, weight: 40, restitution: -0.5, color: 0x0055ff, castShadow: false, receiveShadow: false}));
    }

    const generateBalls = (amount: number) => {
      const gaps = { x: length/4, y: 2, z: length/4 };
      const getSign = () => Math.random() > 0.5 ? 1 : -1;

      times(amount, () => {
        const x = getSign() * Math.floor(Math.random() * length / 2 - gaps.x)
        const z = getSign() * Math.floor(Math.random() * length / 2 - gaps.z)
        const y = 200;
        addBall([x, y, z]);
      });
    }

    video.record(canvas, route);
    function animate() {
      stats.start(route);
      const delta = clock.getDelta();
      const frame = requestAnimationFrame(animate);
      world.step();

      bindAnimatedElements(experiments);

      animateTimeline([
        {
          start: 0,
          end: 2000,
          action: () => {
            generateBalls(25);
          }
        },
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

