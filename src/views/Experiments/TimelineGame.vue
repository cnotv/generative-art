<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { controls } from "@/utils/control";
import { stats } from "@/utils/stats";
import * as THREE from "three";

import { getModel, getTools } from "@/utils/threeJs";
import {
  controllerForward,
  resetAnimation,
  bindAnimatedElements,
  controllerJump,
  controllerTurn,
} from "@/utils/animation";
import { getCube } from "@/utils/models";
import brickTexture from "@/assets/brick.jpg";
import { getCoinBlock } from "@/utils/custom-models";

const statsEl = ref(null);
const canvas = ref(null);
const route = useRoute();

let initInstance: () => void;
onMounted(() => {
  initInstance = () => {
    init(
      (canvas.value as unknown) as HTMLCanvasElement,
      (statsEl.value as unknown) as HTMLElement
    );
  };

  initInstance();
  window.addEventListener("resize", initInstance);
});
onUnmounted(() => window.removeEventListener("resize", initInstance));

const config = {
  directional: {
    enabled: true,
    helper: false,
    intensity: 2,
  },
};

const rotationMap: RotationMap = {
  forward: 0,
  left: 90,
  backward: 180,
  right: 270,
};

const character = {
  speed: 0.5,
  jump: 3,
};

const init = async (canvas: HTMLCanvasElement, statsEl: HTMLElement) => {
  stats.init(route, statsEl);
  controls.create(config, route, {}, () => createScene());
  const createScene = async () => {
    const elements = [] as any[];
    const { animate, setup, scene, world, getDelta } = getTools({
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
            position: [30 * x, 30 * y + 12, -30 * z],
            type: "fixed",
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
            type: "kinematicPositionBased",
            weight: 50,
            angular: 10,
            showHelper: false,
            enabledRotations: [false, true, false],
            hasGravity: true,
          });

        // Goomba 1
        const goomba1 = await getGoomba([0, 30, 0]);
        const timeline1 = (model: AnimatedComplexModel) => {
          return [
            {
              interval: [100, 100],
              actionStart: () => controllerTurn(model, rotationMap["backward"]),
              action: () => {
                controllerForward(model, cubes, 0.5, getDelta());
              },
            },
            {
              interval: [100, 100],
              delay: 100,
              actionStart: () => controllerTurn(model, rotationMap["backward"]),
              action: () => {
                controllerForward(model, cubes, 0.5, getDelta());
              },
            },
            {
              interval: [30, 170],
              delay: 140,
              action: () => {
                controllerJump(model, cubes, 0.5, 3.2);
              },
            },
            {
              interval: [1, 250],
              delay: 250,
              action: () => {
                resetAnimation([model]);
              },
            },
          ] as Timeline[];
        };

        const goomba2 = await getGoomba([-60, 30, 0]);
        const timeline2 = (model: AnimatedComplexModel) => {
          return [
            {
              interval: [120, 480],
              actionStart: () => controllerTurn(model, rotationMap["backward"]),
              action: () => {
                controllerForward(model, cubes, 0.5, getDelta());
              },
            },
            {
              interval: [120, 480],
              delay: 120,
              actionStart: () => controllerTurn(model, rotationMap["right"]),
              action: () => {
                controllerForward(model, cubes, 0.5, getDelta());
              },
            },
            {
              interval: [30, 570],
              delay: 200,
              action: () => {
                controllerJump(model, cubes, 0.5, 3);
              },
            },
            {
              interval: [120, 480],
              delay: 240,
              actionStart: () => controllerTurn(model, rotationMap["backward"]),
              action: () => {
                controllerForward(model, cubes, 0.5, getDelta());
              },
            },
            {
              interval: [120, 480],
              delay: 360,
              actionStart: () => controllerTurn(model, rotationMap["left"]),
              action: () => {
                controllerForward(model, cubes, 0.5, getDelta());
              },
            },
          ] as Timeline[];
        };

        const goomba3 = await getGoomba([-60, 0, 60]);
        const timeline3 = (model: AnimatedComplexModel) => {
          return [
            {
              interval: [200, 200],
              actionStart: () => controllerTurn(model, rotationMap["backward"]),
              action: () => {
                controllerForward(model, cubes, 0.5, getDelta());
              },
            },
            {
              interval: [100, 300],
              delay: 200,
              actionStart: () => controllerTurn(model, rotationMap["backward"]),
              action: () => {
                controllerForward(model, cubes, 0.5, getDelta());
              },
            },
          ] as Timeline[];
        };

        const goomba4 = await getGoomba([-30 * 5, 0, -30]);
        const timeline4 = (model: AnimatedComplexModel) => {
          return [
            {
              interval: [100, 100],
              action: () => {
                controllerForward(model, cubes, 0.5, getDelta());
              },
            },
            {
              interval: [100, 100],
              delay: 100,
              actionStart: () => controllerTurn(model, rotationMap["right"]),
              action: () => {
                controllerForward(model, cubes, 0.5, getDelta());
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

        const goomba6 = await getGoomba([30, 0, 30 * 2]);
        const timeline6 = (model: AnimatedComplexModel) => {
          return [
            {
              interval: [1, 0],
              actionStart: () => controllerTurn(model, 1),
              action: () => {
                controllerForward(model, cubes, 0.5, getDelta());
              },
            },
          ] as Timeline[];
        };

        // elements.push(goomba6, ...cubes);
        elements.push(
          goomba1,
          goomba2,
          goomba3,
          goomba4,
          goomba5,
          goomba6,
          movingCube
          // ...cubes
        );

        animate({
          beforeTimeline: () => {
            bindAnimatedElements(elements, getDelta());
          },
          timeline: [
            ...timeline1(goomba1),
            ...timeline2(goomba2),
            ...timeline3(goomba3),
            ...timeline4(goomba4),
            ...movingCubeTimeline,
            ...timeline6(goomba6),
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
