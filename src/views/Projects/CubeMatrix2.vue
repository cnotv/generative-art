<script setup lang="ts">
import { ref, onMounted } from 'vue';
import Stats from "stats.js";
import * as dat from "dat.gui";
import P5 from "p5";
import { useRoute } from 'vue-router';

const statsEl = ref(null)
const canvas = ref(null)
const route = useRoute();

const hasStats = route.query.stats === 'true';
const hasControl = route.query.control === 'true';
const isRecording = route.query.record === 'true';

const stats = new Stats();

onMounted(() => {
  new P5((p: P5) => init(
    p,
    statsEl.value as unknown as HTMLElement,
    canvas.value as unknown as HTMLCanvasElement,
    stats as unknown as Stats
  ), statsEl.value!);
})

const init = (p: P5, statsEl: HTMLElement, canvas: HTMLCanvasElement, stats: Stats): void => {
  if (hasStats) {
    // FPS stats
    stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
    statsEl!.appendChild(stats.dom);
  }

  let offsetX = -850;
  let offsetY = -220;
  let rotation = 0;
  let amountX = 50;
  let amountY = 50;
  const totalFrames = 400;

  const config = {
    size: 20,
    speed: 7,
    gap: 1.1
  };

  if (hasControl) {
    const gui = new dat.GUI();
    const control = gui.addFolder("control");
    control.open();
    control.add(config, "size").min(10).max(50);
    control.add(config, "speed").min(1).max(100);
    control.add(config, "gap").min(1).max(3);
  }

    // Outside your setup function
  let chunks: Blob[] = [];
  let mediaRecorder: MediaRecorder;

  const saveVideo = () => {
    const blob = new Blob(chunks, { 'type': 'video/webm' });
    let url = URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url;
    a.download = 'animation.webm';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const recordVideo = () => {
    if (isRecording) {
      chunks = [];
      const stream = canvas.captureStream(30);
      mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm', bitsPerSecond: 100000000 });
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size) {
          chunks.push(e.data);
        }
      };
      mediaRecorder.onstop = saveVideo;
      mediaRecorder.start();
    };
  };

  const drawGeometry = (p: P5, x: number, y: number) => {
    p.push(); // Point changes to this instance
    p.translate(
      x * config.size * config.gap + offsetX,
      y * config.size * config.gap + offsetY
    );
    // p.rotate(rotation + x + y)
    p.rotateX(rotation);
    p.rotateY(rotation);
    p.rotateZ(rotation);
    p.fill(200, 200, 200);
    // p.noFill();
    p.noStroke();
    // p.stroke(`#333`);
    p.box(config.size);
    p.pop(); // Close instance
  };

  p.setup = function () {
    p.createCanvas(p.windowWidth, p.windowHeight, p.WEBGL, canvas); // Define canvas size
    const aspectRatio = p.width / p.height;
    const halfWidth = Math.max(1, aspectRatio);
    const halfHeight = Math.max(1, 1 / aspectRatio);
    p.ortho(-halfWidth * 200, halfWidth * 200, halfHeight * 200, -halfHeight * 200, 0, 1000);
      
    recordVideo();
  };

  p.draw = function () {
    if (hasStats) {
      stats.begin();
    }

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

    if (isRecording) {
      if (p.frameCount >= totalFrames) {
        if (mediaRecorder) {
          mediaRecorder.stop();
        }
      }
    }

    if (hasStats) {
      stats.end();
    };
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
  background: #333;
}
</style>
