<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute } from "vue-router";
import { video } from "@/utils/video";
import { controls } from "@/utils/control";
import { stats } from "@/utils/stats";
import {
  getLights,
  getEnvironment,
  getGround,
  getModel,
  removeElements,
} from "@webgamekit/threejs";
import {
  bindAnimatedElements,
  resetAnimation,
  animateTimeline,
  createTimelineManager,
} from "@webgamekit/animation";
import { getBall, getWalls } from "@webgamekit/threejs";
import { times } from "@/utils/lodash";
import bowlingTexture from "@/assets/images/textures/bowling.png";
import type { CoordinateTuple } from "@/types/three";

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
    const length = 400;
    const { renderer, scene, camera, clock, world } = await getEnvironment(canvas, {
      camera: { position: [0, 50, 200] },
    });
    getLights(scene, { directionalLightIntensity: config.directional.intensity });
    getGround(scene, world, { size: 1000.0 });
    getWalls(scene, world, { length, height: 150, depth: 0.2 });

    let experiments = [] as any[];
    const balls = [
      async (position) =>
        getBall(scene, world, {
          position,
          size: 4,
          weight: 120,
          restitution: 0.75,
          metalness: 0.3,
          reflectivity: 0.2,
          roughness: 0.8,
          transmission: 0.5,
          color: 0xff3333,
        }), // Rubber
      async (position) =>
        await getModel(scene, world, "balloon.glb", {
          position,
          rotation: [-0.5, 0, 1],
          scale: [70, 70, 70],
          size: 10,
          damping: 0.8,
          restitution: -0.5,
          weight: 5,
          color: Math.floor(Math.random() * 16777215),
          opacity: 0.9,
        }), // Balloon
      // async (position) => await getModel(scene, world, 'bowling.glb', { position, scale: [2,2,2], size: 2, weight: 50, restitution: -0.3}), // Bowling
      async (position) =>
        getBall(scene, world, {
          position,
          size: 15,
          weight: 50,
          restitution: -0.3,
          texture: bowlingTexture,
          color: 0xffffff,
          friction: 10,
        }), // Bowling
      async (position) =>
        await getModel(scene, world, "paper_low.glb", {
          position,
          rotation: [Math.random() * 100, Math.random() * 100, Math.random() * 100],
          scale: [5, 5, 5],
          size: 3,
          friction: 100,
          angular: 10,
          damping: 0.2,
          restitution: -0.5,
          weight: 8,
        }), // Paper
      async (position) =>
        await getModel(scene, world, "tennis.glb", {
          position,
          scale: [6, 6, 6],
          size: 6,
          weight: 50,
          friction: 5,
          angular: 1,
          restitution: 0.6,
        }), // Tennis
      async (position) =>
        getBall(scene, world, {
          position,
          size: 3,
          weight: 40,
          restitution: 0.8,
          damping: 0.1,
          color: 0xffffff,
          roughness: 0.9,
        }), // Ping Pong
    ];
    const addBall = async (position: CoordinateTuple, pick: number, list = balls) => {
      experiments.push(await list[pick](position));
    };

    document.addEventListener("click", async (event) => {
      const x = -(event.clientX - window.innerWidth / 2) / 50;
      const y = -(event.clientY - window.innerHeight) / 50;

      const pick = Math.floor(Math.random() * balls.length);
      addBall([x, 70, y], pick);
    });

    const generateBalls = (amount: number, list: any[]) => {
      const gaps = { x: 50, y: 10, z: 50 };
      const getSign = () => (Math.random() > 0.5 ? 1 : -1);

      times(amount, (i) => {
        // const rows = 3;
        // const x = -(length / 2 - gaps.x) + (i % rows) * gaps.x;
        // const z = 5 + Math.floor(i / rows) * -gaps.z;
        const x = getSign() * Math.floor((Math.random() * length) / 2 - gaps.x);
        const z = getSign() * Math.floor((Math.random() * length) / 2 - gaps.z);
        const y = 50 + (i + gaps.y);
        const pick = i % list.length;
        addBall([x, y, z], pick, list);
      });
    };

    const timelineManager = createTimelineManager();
    timelineManager.addAction({
      interval: [1, 500],
      actionStart: (loop) => {
        experiments = removeElements(scene, world, experiments);
        generateBalls(500, [balls[loop % balls.length]]);
      },
      action: () => {
        experiments = resetAnimation(experiments);
      },
    });

    video.record(canvas, route);
    generateBalls(500, [balls[0]]);
    function animate() {
      stats.start(route);
      const delta = clock.getDelta();
      const frame = requestAnimationFrame(animate);
      world.step();

      bindAnimatedElements(experiments, world, delta);

      animateTimeline(timelineManager, frame);

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
