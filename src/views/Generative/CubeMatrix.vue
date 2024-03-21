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
  let offsetX = -850;
  let offsetY = -220;
  let rotation = 0;
  let amountX = 50;
  let amountY = 50;

  const config = {
    size: 20,
    speed: 20,
    gap: 2
  };

  stats.init(route, statsEl);
  controls.create(config, route, {
    size: { min: 10, max: 50 },
    speed: { min: 1, max: 100 },
    gap: { min: 1, max: 3 }
  });

  const drawGeometry = (p: P5, x: number, y: number) => {
    p.push(); // Point changes to this instance
    const color = `#333`;
    p.translate(
      x * config.size * config.gap + offsetX,
      y * config.size * config.gap + offsetY
    );
    // p.rotate(rotation + x + y)
    p.rotateX(rotation);
    p.rotateY(rotation);
    p.rotateZ(rotation);
    p.fill(50, 50, 250, 60);
    // p.noFill();
    p.noStroke();
    p.stroke(color);
    p.box(config.size);
    p.pop(); // Close instance
  };

  p.setup = function () {
    p.createCanvas(p.windowWidth, p.windowHeight, p.WEBGL); // Define canvas size
    // p.rectMode(p.CENTER);
    video.record(canvas, route);
  };

  p.draw = function () {
    stats.start(route);

    // Setup
    offsetX = -Math.floor(p.windowWidth / 2 - config.size * 2.5);
    offsetY = -Math.floor(p.windowHeight / 2 - config.size * 1.5);
    amountX = Math.floor(p.windowWidth / (config.size * config.gap));
    amountY = Math.floor(p.windowHeight / (config.size * config.gap));

    p.clear();

    rotation += (config.speed / 1000);

    // Populate
    for (let x = 0; x < amountX; x++) {
      for (let y = 0; y < amountY; y++) {
        drawGeometry(p, x, y);
      }
    }
    
    video.stop(p.frameCount ,route);
    stats.end(route);
  };
};

</script>

<template>
  <div ref="statsEl"></div>
  <canvas ref="canvas"></canvas>
</template>
