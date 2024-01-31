<script setup lang="ts">
import { ref, onMounted } from 'vue';
import P5 from "p5";
import { video } from '@/utils/video';
import { controls } from '@/utils/control';
import { stats } from '@/utils/stats';
import { useRoute } from 'vue-router';

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
  let offsetX = -50;
  let offsetY = -220;
    
  const config = {
    size: 25,
    gap: 1.5
  };
  stats.init(route, statsEl);
  controls.create(config, route, {
    size: { min: 10, max: 50 },
    gap: { min: 1, max: 3 }
  });

  const amountX = Math.floor(p.windowWidth / (config.size + config.gap) - offsetX);
  const amountY = Math.floor(p.windowHeight / (config.size + config.gap));

  const drawGeometry = (p: P5, x: number, y: number) => {
    p.push(); // Point changes to this instance
    const itemX = x * config.size * config.gap + offsetX;
    const itemY = y * config.size * config.gap + offsetY;
    const dx = itemX - p.mouseX;
    const dy = itemY - p.mouseY;
    const mouseAngle = p.atan2(dy, dx);

    p.translate(itemX, itemY);
    p.rotate(mouseAngle)
    p.fill(`#333`);
    p.noStroke();
    p.rect(0, 0, config.size, 1); // Create geometry
    p.pop(); // Close instance
  };

  p.setup = function () {
		p.createCanvas(p.windowWidth, p.windowHeight); // Define canvas size
		p.rectMode(p.CENTER);
    video.record(canvas, route);
  };

  p.draw = function () {
    stats.start(route);

		p.clear();
		for (let x = 0; x < amountX; x++) {
			for (let y = 0; y < amountY; y++) {
				drawGeometry(p, x, y)
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
