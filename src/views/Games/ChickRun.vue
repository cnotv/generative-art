<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { controls } from "@/utils/control";
import { stats } from "@/utils/stats";

import { getModel, getTools } from "@/utils/threeJs";
import { bindAnimatedElements, bodyJump, updateAnimation } from "@/utils/animation";
import { useUiStore } from "@/stores/ui";

// Set UI controls
const uiStore = useUiStore();
const keyUp = (event: KeyboardEvent) => uiStore.setKeyState(event.key, true);
const keyDown = (event: KeyboardEvent) => uiStore.setKeyState(event.key, false);

const character = {
  speed: 0.5,
  jump: 1,
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
    const elements = [] as any[];
    const { animate, setup, world, scene, getDelta } = getTools({
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
          weight: 10,
          angular: 10,
          showHelper: false,
          enabledRotations: [false, true, false],
          hasGravity: true,
        });
        elements.push(chickModel);

        animate({
          beforeTimeline: () => {
            bindAnimatedElements(elements, world, getDelta());
            if (uiStore.controls.jump) {
              bodyJump(chickModel, [], character.speed, character.jump);
            }
          },
          timeline: [
            {
              start: 0,
              action: () => {
                // controllerForward(chickModel, [], 10, getDelta());
                updateAnimation(chickModel.mixer, chickModel.actions.run, getDelta(), 20);
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
