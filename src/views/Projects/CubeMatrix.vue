<script setup lang="ts">
import { ref, onMounted } from 'vue';
import Stats from "stats.js";
import * as dat from "dat.gui";
import P5 from "p5";

const statsEl = ref(null)
const canvas = ref(null)
const stats = new Stats();

onMounted(() => {
  new P5((p: P5) => init(
    p,
    statsEl.value as unknown as HTMLElement,
    stats as unknown as Stats
  ), statsEl.value);
})

const init = (p: P5, statsEl: HTMLElement, stats: Stats): void => {
  // FPS stats
  stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
  statsEl!.appendChild(stats.dom);

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

  const gui = new dat.GUI();
  const control = gui.addFolder("control");
  control.open();
  control.add(config, "size").min(10).max(50);
  control.add(config, "speed").min(1).max(100);
  control.add(config, "gap").min(1).max(5);

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
  };

  p.draw = function () {
    stats.begin();

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
    stats.end();
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
