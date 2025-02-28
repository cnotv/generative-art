<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute } from "vue-router";
import { controls } from "@/utils/control";
import { stats } from "@/utils/stats";
import {
  bindAnimatedElements,
  getModel,
  getTools,
  resetAnimation,
} from "@/utils/threeJs";
import { moveForward, moveJump, updateAnimation } from "@/utils/animation";
import { getCube } from "@/utils/models";
import brickTexture from "@/assets/brick.jpg";
import { getCoinBlock } from "@/utils/custom-models";

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

const config = {
  directional: {
    enabled: true,
    helper: false,
    intensity: 2,
  },
};

const init = async (canvas: HTMLCanvasElement, statsEl: HTMLElement) => {
  stats.init(route, statsEl);
  controls.create(config, route, {}, () => createScene());
  const createScene = async () => {
    const elements = [] as any[];
    const { animate, setup, scene, world, getDelta, getFrame } = getTools({
      stats,
      route,
      canvas,
    });
    setup({
      config: {
        camera: { position: [-184, 84, 48] },
        ground: { size: 100000, color: 0x99ddaa },
        sky: { texture: "../assets/landscape.jpg", size: 700 },
        lights: { directional: { intensity: config.directional.intensity } },
      },
      defineSetup: async () => {
        // getWalls(scene, world, { length: 400, height: 150, depth: 0.2 });
        const getGoomba = async (position: CoordinateTuple) =>
          getModel(scene, world, "goomba.glb", {
            position,
            scale: [0.3, 0.3, 0.3],
            size: 3,
            restitution: -10,
            boundary: 0.5,
            weight: 50,
            angular: 10,
          });
        // Goomba 1
        const goomba1 = await getGoomba([0, 30, 0]);
        const goomba1Timeline = [
          {
            interval: [100, 100],
            action: () => {
              updateAnimation(goomba1.mixer, goomba1.actions.run, getDelta(), 10);
              moveForward(goomba1, cubes, 0.5);
              goomba1.mesh.rotation.y = 0;
            },
          },
          {
            interval: [100, 100],
            delay: 100,
            action: () => {
              updateAnimation(goomba1.mixer, goomba1.actions.run, getDelta(), 10);
              moveForward(goomba1, cubes, 0.5, true);

              goomba1.mesh.rotation.y = 3;
            },
          },
          {
            interval: [30, 170],
            delay: 145,
            action: () => {
              updateAnimation(goomba1.mixer, goomba1.actions.run, getDelta(), 10);
              moveJump(goomba1, cubes, 0.5, 3);

              goomba1.mesh.rotation.y = 3;
            },
          },
        ];

        const goomba2 = await getGoomba([-60, 30, 0]);
        const goomba2Timeline = [];
        const coins = [[0, 3, 2]].map(([x, y, z]) =>
          getCoinBlock(scene, world, { position: [30 * x, 30 * y + 15, -30 * z] })
        );
        const cubes = [
          [0, 0, 0],
          [0, 0, 1],
          [0, 0, 2],
          [0, 1, 2],
          [-1, 0, 2],
          [-2, 0, 0],
          [-2, 0, 1],
          [-2, 0, 2],
        ].map(([x, y, z]) =>
          getCube(scene, world, {
            size: [30, 30, 30],
            restitution: -1,
            position: [30 * x, 30 * y + 15, -30 * z],
            type: "fixed",
            texture: brickTexture,
            boundary: 0.5,
            color: 0x999999,
          })
        );
        elements.push(goomba1, goomba2, ...cubes);

        animate({
          beforeTimeline: () => {
            bindAnimatedElements(elements);
          },
          timeline: [
            ...goomba1Timeline,
            ...goomba2Timeline,
            {
              start: 0,
              action: () => {
                coins.forEach((coin) => (coin.mesh.rotation.z += 0.05));
              },
            },
          ],
        });
      },
    });
  };
  createScene();
};
</script>

<template>
  <div ref="statsEl"></div>
  <canvas ref="canvas"></canvas>
</template>
