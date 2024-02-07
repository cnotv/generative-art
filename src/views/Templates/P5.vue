<script setup lang="ts">
import { ref, onMounted } from 'vue';
import P5 from "p5";
import { useRoute } from 'vue-router';
import { video } from '@/utils/video';
import { controls } from '@/utils/control';
import { stats } from '@/utils/stats';

const statsEl = ref(null)
const canvas = ref(null)
const route = useRoute();

onMounted(() => {
  new P5((p: P5) => init(
    p,
    statsEl.value as unknown as HTMLElement,
    canvas.value as unknown as HTMLCanvasElement,
  ), statsEl.value!);
})

const init = (p: P5, statsEl: HTMLElement, canvas: HTMLCanvasElement): void => {
  const config = {
    size: 50,
    speed: 100,
    gap: 1.4,
    interval: 90,
    initialAngle: 20,
    strokeWeight: 0,
    opacity: 255,
    stroke: [50, 50, 50],
    fill: [100, 100, 100],
    background: [100, 100, 100],
  };

  stats.init(route, statsEl);
  controls.create(config, route, {
    size: { min: 10, max: 50 },
    speed: { min: 1, max: 200 },
    gap: { min: 1, max: 3 },
    interval: { min: 60, max: 1000 },
    initialAngle: { min: 0, max: 360 },
    strokeWeight: { min: 0, max: 10 },
    opacity: { min: 0, max: 255 },
    stroke: { addColor: []},
    fill: { addColor: []},
    background: { addColor: []},
  }, () => {
    p.frameCount = 0;
  });

  const drawGeometry = (p: P5) => {
    p.push(); // Point changes to this instance
    p.directionalLight(255, 255, 255, 0, 0, -1);
    p.noFill();
    // p.noStroke();
    p.stroke(config.stroke);
    p.strokeWeight(config.strokeWeight);
    if (config.opacity) {
      p.fill([...config.fill, config.opacity]);
    }
    p.box(config.size);
    p.pop(); // Close instance
  };

  p.setup = function () {
    p.createCanvas(p.windowWidth, p.windowHeight, p.WEBGL, canvas); // Define canvas size

    // Create orthographic projection
    const aspectRatio = p.width / p.height;
    const halfWidth = Math.max(1, aspectRatio);
    const halfHeight = Math.max(1, 1 / aspectRatio);
    p.ortho(-halfWidth * 200, halfWidth * 200, halfHeight * 200, -halfHeight * 200, 0, 1000);

    video.record(canvas, route);
  };

  p.draw = function () {
    stats.start(route);
    p.clear();
    p.background(config.background);
    drawGeometry(p);
    video.stop(p.frameCount ,route);
    stats.end(route);
  };
};

</script>

<template>
  <div ref="statsEl"></div>
  <canvas ref="canvas"></canvas>
</template>

