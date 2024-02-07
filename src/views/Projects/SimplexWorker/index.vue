<script setup lang="ts">
// Based on the Coding Train video https://youtu.be/Lv9gyZZJPE0
import { ref, onMounted } from 'vue'
// @ts-ignore
import MyWorker from './worker?worker'
import { useRoute } from 'vue-router';
import { video } from '@/utils/video';
import { controls } from '@/utils/control';
import { stats } from '@/utils/stats';

const statsEl = ref(null)
const canvas = ref(null)
const route = useRoute();

onMounted(() => {
  init(
    canvas.value as unknown as HTMLCanvasElement,
    statsEl.value as unknown as HTMLElement)
})

const init = (canvas: HTMLCanvasElement, statsEl: HTMLElement): void => {
  const config = {
    pixelSize: 4,
    noiseSize: 0.03,
    speed: 200,
    lightAmount: 2.2,
    fluidity: 0.2,
    windowSize: 1,
    frameCount: 0,
    width: window.innerWidth,
    height: window.innerHeight
  };

  // Detached mode
  // https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas#asynchronous_display_of_frames_produced_by_an_offscreencanvas
  const offscreen = canvas.transferControlToOffscreen();
  const worker = new MyWorker();

  stats.init(route, statsEl);
  const onChangeConfig = () => worker.postMessage({ workerConfig: config });
  controls.create(config, route, {
    pixelSize: { min: 1, max: 10 },
    noiseSize: { min: 0.0001, max: 0.1 },
    speed: { min: 80, max: 500 },
    lightAmount: { min: 1, max: 5 },
    fluidity: { min: 0, max: 1 },
    windowSize: { min: 0.1, max: 1 }
  }, onChangeConfig);

  video.record(canvas, route);
  worker.postMessage(
    {
      canvas: offscreen,
      workerConfig: config
    },
    [offscreen]
  );

  worker.onmessage = (event) => {
    if (event.data.begin) {
      stats.start(route);
    }
    if (event.data.end) {
      video.stop(config.frameCount ,route);
      stats.end(route);
    }
    if (event.data.frameCount) {
      config.frameCount = event.data.frameCount;
    }
    if (event.data.message) {
      console.log(event.data.message);
    }
  };
};
</script>

<template>
  <canvas ref="canvas"></canvas>
  <div ref="statsEl"></div>
</template>
