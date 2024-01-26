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

  let offsetX = -50;
  let offsetY = -220;
    
  const config = {
    size: 12,
    gap: 1.6
  };
  const amountX = Math.floor(p.windowWidth / (config.size + config.gap) - offsetX);
  const amountY = Math.floor(p.windowHeight / (config.size + config.gap));

  const gui = new dat.GUI();
  const control = gui.addFolder("control");
  control.open();
  control.add(config, "size").min(10).max(50);
  control.add(config, "gap").min(1).max(5);

  const drawGeometry = (p: P5, x: number, y: number) => {
    p.push(); // Point changes to this instance
    const itemX = x * config.size * config.gap + offsetX;
    const itemY = y * config.size * config.gap + offsetY;
    
    const mouseAngle = p.map(itemX - p.mouseX, itemY - p.mouseY, config.size, p.PI, 1.2);
    
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
  };

  p.draw = function () {
    stats.begin();

		p.clear();
		for (let x = 0; x < amountX; x++) {
			for (let y = 0; y < amountY; y++) {
				drawGeometry(p, x, y)
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
