<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute } from "vue-router";
import { video } from "@/utils/video";
import { controls } from "@/utils/control";
import { stats } from "@/utils/stats";
import { createLights, getEnvironment, getGround, removeElements } from "@/utils/threeJs";
import { bindAnimatedElements, animateTimeline } from "@/utils/animation";
import { getBall } from "@/utils/models";
import { times } from "@/utils/lodash";

const statsEl = ref(null);
const canvas = ref(null);
const route = useRoute();

onMounted(() => {
  init(
    (canvas.value as unknown) as HTMLCanvasElement,
    (statsEl.value as unknown) as HTMLElement
  ),
    statsEl.value!;
});

const init = async (canvas: HTMLCanvasElement, statsEl: HTMLElement) => {
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
  };
  stats.init(route, statsEl);
  controls.create(config, route, {}, () => {
    setup();
  });

  const setup = async () => {
    const { renderer, scene, camera, clock, world } = getEnvironment(canvas, {
      camera: { position: [0, 150, 0] },
    });
    createLights(scene, { directionalLightIntensity: config.directional.intensity });
    getGround(scene, world, { size: 1000.0, color: 0xffffff });

    let elements = [] as any[];
    const addBall = (position: CoordinateTuple) => {
      elements.push(
        getBall(scene, world, {
          position,
          size: 0.5,
          weight: 80,
          restitution: -0.5,
          color: 0xffffff,
          opacity: 0.5,
          castShadow: false,
          receiveShadow: false,
        })
      );
    };

    const generateBalls = (amount: number, width = 100, length = 100) => {
      const gaps = { x: width / 4, y: 2, z: length / 4 };
      const getSign = () => (Math.random() > 0.5 ? 1 : -1);

      times(amount, () => {
        const x = getSign() * Math.floor((Math.random() * width) / 2 - gaps.x);
        const z = getSign() * Math.floor((Math.random() * length) / 2 - gaps.z);
        const y = 100;
        addBall([x, y, z]);
      });
    };

    video.record(canvas, route);
    function animate() {
      stats.start(route);
      const delta = clock.getDelta();
      const frame = requestAnimationFrame(animate);
      world.step();

      bindAnimatedElements(elements, world, delta);
      generateBalls(20, 600, 300);
      animateTimeline(
        [
          {
            interval: [1, 300],
            action: () => (elements = removeElements(scene, world, elements)),
          },
        ],
        frame
      );

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
