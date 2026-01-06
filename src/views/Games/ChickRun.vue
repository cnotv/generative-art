<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { controls } from "@/utils/control";
import { stats } from "@/utils/stats";

import { getModel, getTools } from "@webgamekit/threejs";
import { bindAnimatedElements, bodyJump, updateAnimation } from "@webgamekit/animation";
import { useUiStore } from "@/stores/ui";
import { getCube } from "@webgamekit/threejs";
import brickTexture from "@/assets/images/textures/brick.jpg";

// Set UI controls
const uiStore = useUiStore();
const keyUp = (event: KeyboardEvent) => uiStore.setKeyState(event.key, true);
const keyDown = (event: KeyboardEvent) => uiStore.setKeyState(event.key, false);

const character = {
  speed: 0.5,
  jump: 3,
};

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

onMounted(() => {
  window.addEventListener("keydown", keyUp);
  window.addEventListener("keyup", keyDown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", keyUp);
  window.removeEventListener("keyup", keyDown);
});

onUnmounted(() => window.removeEventListener("resize", initInstance));

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
    const elements = [] as ComplexModel[];
    const obstacles = [] as ComplexModel[];
    const { animate, setup, world, scene, getDelta } = await getTools({
      stats,
      route,
      canvas,
    });
    setup({
      config: {
        camera: { position: [0, 20, 150] },
        ground: { size: 100000, color: 0x227755 },
        sky: { size: 700 },
        lights: { directional: { intensity: config.directional.intensity } },
        orbit: false,
      },
      defineSetup: async () => {
        const chickModel = await getModel(scene, world, "goomba.glb", {
          scale: [0.3, 0.3, 0.3],
          rotation: [0, 1, 0],
          size: 3,
          restitution: -10,
          boundary: 0.5,
          weight: 30,
          angular: 10,
          showHelper: false,
          enabledRotations: [false, true, false],
          hasGravity: true,
        });
        elements.push(chickModel);

        animate({
          beforeTimeline: () => {
            bindAnimatedElements([...elements, ...obstacles], world, getDelta());
            if (uiStore.controls.jump) {
              bodyJump(chickModel, [], character.speed, character.jump);
            }
          },
          timeline: [
            // Make Goomba run
            {
              action: () => {
                if (chickModel.userData.mixer && chickModel.userData.actions?.run) {
                  updateAnimation(
                    chickModel.userData.mixer,
                    chickModel.userData.actions.run,
                    getDelta()
                  );
                }
              },
            },
            // Generate cubes
            {
              frequency: 75,
              action: () => {
                const cube = getCube(scene, world, {
                  size: [30, 30, 30],
                  restitution: -1,
                  position: [30 * 8, 15 * Math.floor(Math.random() * 3) + 15, 0],
                  type: "fixed",
                  texture: brickTexture,
                  boundary: 0.5,
                  color: 0x888888,
                }) as ComplexModel;
                obstacles.push(cube);
              },
            },
            // Move obstacles
            {
              action: () => {
                obstacles.forEach((obstacle: ComplexModel) => {
                  obstacle.mesh.position.x -= character.speed * 3;
                });
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
