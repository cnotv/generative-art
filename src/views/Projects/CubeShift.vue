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
  let amountX = 50;
  let amountY = 50;

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

  let rotation = {
    x: config.initialAngle,
    y: config.initialAngle,
    z: config.initialAngle
  };
  let movement = 0;

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
    rotation = {
      x: config.initialAngle,
      y: config.initialAngle,
      z: config.initialAngle
    };
    p.frameCount = 0;
  });

  const drawGeometry = (p: P5, x: number, y: number) => {
    p.push(); // Point changes to this instance
    p.directionalLight(255, 255, 255, 0, 0, -1);
    p.translate(
      x * config.size * (config.gap / 2) + offsetX,
      y * config.size * (config.gap / 2) + offsetY + movement
    );

    p.rotateX(rotation.x);
    p.rotateY(rotation.y);

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
    const aspectRatio = p.width / p.height;
    const halfWidth = Math.max(1, aspectRatio);
    const halfHeight = Math.max(1, 1 / aspectRatio);
    p.ortho(-halfWidth * 200, halfWidth * 200, halfHeight * 200, -halfHeight * 200, 0, 1000);
    video.record(canvas, route);
  };

  p.draw = function () {
    stats.start(route);

    // Setup
    offsetX = -Math.floor(p.windowWidth / 2 - config.size * 2.5);
    offsetY = -Math.floor(p.windowHeight / 2 - config.size * 1.5);
    amountX = Math.floor(p.windowWidth / (config.size * (config.gap / 2)));
    amountY = Math.floor(p.windowHeight / (config.size * (config.gap / 2)));

    p.clear();
    p.background(config.background);

    let remainder = p.frameCount % config.interval;
    const speed = config.speed / 4000;

    if (remainder < config.interval / 4) {
      rotation.x += (speed);
    } else if (remainder < config.interval / 3){
      movement += speed;
    } else if (remainder < config.interval / 2) {
      rotation.y += (speed);
    } else {
      movement += speed;
    } 

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

<style scoped>
canvas {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
}
</style>
