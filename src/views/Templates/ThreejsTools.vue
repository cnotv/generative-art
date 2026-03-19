<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { controls } from "@/utils/control";
import { stats } from "@/utils/stats";

import { getTools } from "@webgamekit/threejs";
import { bindAnimatedElements, createTimelineManager } from "@webgamekit/animation";

const statsElement = ref(null);
const canvas = ref(null);
const route = useRoute();

let initInstance: () => void;
onMounted(() => {
  initInstance = () => {
    init(
      (canvas.value as unknown) as HTMLCanvasElement,
      (statsElement.value as unknown) as HTMLElement
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

const init = async (canvas: HTMLCanvasElement, statsElement: HTMLElement) => {
  stats.init(route, statsElement);
  controls.create(config, route, {}, () => createScene());
  const createScene = async () => {
    const elements = [] as any[];
    const { animate, setup, world, getDelta } = await getTools({
      stats,
      route,
      canvas,
    });
    setup({
      config: {
        camera: { position: [-184, 84, 48] },
        ground: { size: 100000, color: 0x227755 },
        sky: { size: 100000 },
        lights: { directional: { intensity: config.directional.intensity } },
      },
      defineSetup: async () => {
        const timelineManager = createTimelineManager();

        animate({
          beforeTimeline: () => {
            bindAnimatedElements(elements, world, getDelta());
          },
          timeline: timelineManager,
        });
      },
    });
  };
  createScene();
};
</script>

<template>
  <div ref="statsElement"></div>
  <canvas ref="canvas"></canvas>
</template>
