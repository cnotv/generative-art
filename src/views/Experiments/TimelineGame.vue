<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute } from "vue-router";
import { controls } from "@/utils/control";
import { stats } from "@/utils/stats";
import * as THREE from "three";
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
            type: "kinematicPositionBased",
            texture: brickTexture,
            boundary: 0.5,
            color: 0x888888,
          })
        );

        const getGoomba = async (position: CoordinateTuple, rotation?: CoordinateTuple) =>
          getModel(scene, world, "goomba.glb", {
            position,
            rotation,
            scale: [0.3, 0.3, 0.3],
            size: 3,
            restitution: -10,
            boundary: 0.5,
            weight: 50,
            angular: 10,
            showHelper: true,
          });
        // Goomba 1
        const goomba1 = await getGoomba([0, 30, 0]);
        const timeline1 = (model: AnimatedComplexModel) => {
          const { mixer, actions, mesh, rigidBody } = model;
          return [
            {
              interval: [100, 100],
              action: () => {
                updateAnimation(mixer, actions.run, getDelta(), 10);
                moveForward(model, cubes, 0.5);
                mesh.rotation.y = rotationMap["forward"];
              },
            },
            {
              interval: [100, 100],
              delay: 100,
              action: () => {
                updateAnimation(mixer, actions.run, getDelta(), 10);
                moveForward(model, cubes, 0.5, true);
                mesh.rotation.y = rotationMap["backward"];
              },
            },
            {
              interval: [30, 170],
              delay: 140,
              action: () => {
                updateAnimation(mixer, actions.run, getDelta(), 10);
                moveJump(model, cubes, 0.5, 3.2);
              },
            },
          ] as Timeline[];
        };

        const goomba2 = await getGoomba([-60, 30, 0]);
        // const timeline2 = getTimelineLoopModel({
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

        const timeline2 = (model: AnimatedComplexModel) => {
          const { mixer, actions, mesh, rigidBody } = model;
          return [
            {
              interval: [120, 480],
              action: () => {
                updateAnimation(mixer, actions.run, getDelta(), 10);
                moveForward(model, cubes, 0.5, true);
                mesh.rotation.y = rotationMap["backward"];
              },
            },
            {
              interval: [120, 480],
              delay: 120,
              action: () => {
                updateAnimation(mixer, actions.run, getDelta(), 10);
                moveForward(model, cubes, 0.5);
                mesh.rotation.y = rotationMap["right"];
              },
            },
            {
              interval: [30, 570],
              delay: 200,
              action: () => {
                updateAnimation(mixer, actions.run, getDelta(), 10);
                moveJump(model, cubes, 0.5, 3);
              },
            },
            {
              interval: [120, 480],
              delay: 240,
              action: () => {
                updateAnimation(mixer, actions.run, getDelta(), 10);
                moveForward(model, cubes, 0.5, true);
                mesh.rotation.y = rotationMap["left"];
              },
            },
            {
              interval: [120, 480],
              delay: 360,
              action: () => {
                updateAnimation(mixer, actions.run, getDelta(), 10);
                moveForward(model, cubes, 0.5);
                mesh.rotation.y = rotationMap["forward"];
              },
            },
          ] as Timeline[];
        };

        const goomba3 = await getGoomba([-60, 0, 60]);
        const timeline3 = (model: AnimatedComplexModel) => {
          const { mixer, actions, mesh, rigidBody } = model;
          return [
            {
              interval: [300, 0],
              action: () => {
                updateAnimation(mixer, actions.run, getDelta(), 10);
                moveForward(model, cubes, 0.5, true);
                mesh.rotation.y = rotationMap["backward"];
              },
            },
            {
              interval: [1, 300],
              delay: 300,
              action: () => {
                resetAnimation([model]);
              },
            },
          ] as Timeline[];
        };

        const goomba4 = await getGoomba([-120, 0, -30], [0, rotationMap["right"], 0]);
        const timeline4 = (model: AnimatedComplexModel) => {
          const { mixer, actions, mesh, rigidBody } = model;
          return [
            {
              interval: [300, 0],
              action: () => {
                updateAnimation(mixer, actions.run, getDelta(), 10);
                moveForward(model, cubes, 0.5, true);
              },
            },
            {
              interval: [1, 300],
              delay: 300,
              action: () => {
                resetAnimation([model]);
              },
            },
          ] as Timeline[];
        };

        const goomba5 = await getGoomba(
          [30 * 0, 30 * 2 + 15, -30 * -5],
          [0, rotationMap["right"], 0]
        );

        const movingCube = getCube(scene, world, {
          size: [30, 30, 30],
          restitution: -1,
          position: [30 * 0, 30 * 0 + 15, -30 * -5],
          type: "kinematicPositionBased",
          texture: brickTexture,
          boundary: 0.5,
          color: 0x888888,
        });
        const movingCubeTimeline: Timeline[] = [
          {
            interval: [100, 100],
            action: () =>
              movingCube.rigidBody.setTranslation(
                movingCube.mesh.position.add(new THREE.Vector3(0, 0.5, 0)),
                true
              ),
          },
          {
            interval: [100, 100],
            delay: 100,
            action: () =>
              movingCube.rigidBody.setTranslation(
                movingCube.mesh.position.add(new THREE.Vector3(0, -0.5, 0)),
                true
              ),
          },
        ];

        elements.push(goomba1, goomba2, goomba3, goomba4, goomba5, movingCube, ...cubes);

        animate({
          beforeTimeline: () => {
            bindAnimatedElements(elements);
          },
          timeline: [
            ...timeline1(goomba1),
            ...timeline2(goomba2),
            ...timeline3(goomba3),
            ...timeline4(goomba4),
            ...movingCubeTimeline,
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
