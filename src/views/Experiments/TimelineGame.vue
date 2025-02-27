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
import { updateAnimation } from "@/utils/animation";

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
        camera: { position: [-35, 50, -200] },
        ground: { size: 100000.0 },
        lights: { directional: { intensity: config.directional.intensity } },
      },
      defineSetup: async () => {
        // getWalls(scene, world, { length: 400, height: 150, depth: 0.2 });
        const { mesh, rigidBody, mixer, actions }: ComplexModel = await getModel(
          scene,
          world,
          "goomba.glb",
          {
            position: [0, 3, 0],
            rotation: [0, 3, 0],
            scale: [0.3, 0.3, 0.3],
            size: 3,
            restitution: -1,
            boundary: 0.5,
            weight: 10,
          }
        );
        elements.push(mesh);
        // rigidBody.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);

        animate({
          beforeTimeline: () => {
            // bindAnimatedElements(elements);
          },
          timelines: [
            {
              list: [
                {
                  interval: [200, 400],
                  action: () => {
                    console.log("forward", getFrame());
                    updateAnimation(mixer, actions, getDelta(), 10);
                    mesh.position.z -= 0.5;
                    mesh.rotation.y = 0;
                  },
                },
                {
                  interval: [200, 400],
                  delay: 200,
                  action: () => {
                    console.log("backward", getFrame());
                    updateAnimation(mixer, actions, getDelta(), 10);
                    mesh.position.z += 0.5;
                    mesh.rotation.y = 3;
                  },
                },
              ],
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
