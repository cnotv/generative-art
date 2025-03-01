<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute } from "vue-router";
import { controls } from "@/utils/control";
import { stats } from "@/utils/stats";
import {
  bindAnimatedElements,
  getModel,
  getTimelineLoopModel,
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

const rotationMap: RotationMap = {
  forward: 0,
  right: 1.5,
  backward: 3,
  left: 4.5,
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
        ground: { size: 100000, color: 0x227755 },
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
        const goomba1Timeline: Timeline[] = [
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
        // const goomba2Timeline = getTimelineLoopModel({
        //   loop: 0,
        //   length: 40,
        //   action: (direction: Direction) => {
        //     updateAnimation(goomba2.mixer, goomba2.actions.run, getDelta(), 10);
        //     if (direction === "jump") {
        //       moveJump(goomba2, cubes, 0.5, 3);
        //     } else {
        //       moveForward(
        //         goomba2,
        //         cubes,
        //         0.5,
        //         direction === "backward" || direction === "right"
        //       );
        //       goomba2.mesh.rotation.y = rotationMap[direction];
        //     }
        //   },
        //   list: [
        //     [3, "forward"],
        //     [3, "right"],
        //     [1, "jump"],
        //     [3, "left"],
        //     [3, "backward"],
        //   ],
        // });

        const goomba2Timeline: Timeline[] = [
          {
            interval: [120, 480],
            action: () => {
              updateAnimation(goomba2.mixer, goomba2.actions.run, getDelta(), 10);
              moveForward(goomba2, cubes, 0.5, true);
              goomba2.mesh.rotation.y = 3;
            },
          },
          {
            interval: [120, 480],
            delay: 120,
            action: () => {
              updateAnimation(goomba2.mixer, goomba2.actions.run, getDelta(), 10);
              moveForward(goomba2, cubes, 0.5);
              goomba2.mesh.rotation.y = 1.5;
            },
          },
          {
            interval: [30, 570],
            delay: 200,
            action: () => {
              updateAnimation(goomba2.mixer, goomba2.actions.run, getDelta(), 10);
              moveJump(goomba2, cubes, 0.5, 3);
            },
          },
          {
            interval: [120, 480],
            delay: 240,
            action: () => {
              updateAnimation(goomba2.mixer, goomba2.actions.run, getDelta(), 10);
              moveForward(goomba2, cubes, 0.5, true);
              goomba2.mesh.rotation.y = 4.5;
            },
          },
          {
            interval: [120, 480],
            delay: 360,
            action: () => {
              updateAnimation(goomba2.mixer, goomba2.actions.run, getDelta(), 10);
              moveForward(goomba2, cubes, 0.5);
              goomba2.mesh.rotation.y = 0;
            },
          },
        ];

        const goomba3 = await getGoomba([-60, 0, 30]);
        const goomba3Timeline: Timeline[] = [
          {
            interval: [200, 0],
            action: () => {
              updateAnimation(goomba3.mixer, goomba3.actions.run, getDelta(), 10);
              moveForward(goomba3, cubes, 0.5, true);
              goomba3.mesh.rotation.y = 3;
            },
          },
          {
            interval: [1, 200],
            delay: 200,
            action: () => {
              resetAnimation([goomba3]);
            },
          },
        ];

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
            color: 0x888888,
          })
        );

        elements.push(goomba1, goomba2, goomba3, ...cubes);

        animate({
          beforeTimeline: () => {
            bindAnimatedElements(elements);
          },
          timeline: [
            ...goomba1Timeline,
            ...goomba2Timeline,
            ...goomba3Timeline,
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
