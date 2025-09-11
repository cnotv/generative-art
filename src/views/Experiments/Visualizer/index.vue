<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { controls } from "@/utils/control";
import { stats } from "@/utils/stats";

import { getTools } from "@/utils/threeJs";
import { bindAnimatedElements } from "@/utils/animation";
import * as THREE from "three";
import { setupAudio, getAudioData, cleanup } from "./audio";

const statsEl = ref(null);
const canvas = ref(null);
const audioElement = ref(null);
const route = useRoute();

let initInstance: () => void;
onMounted(() => {
  initInstance = () => {
    init(
      (canvas.value as unknown) as HTMLCanvasElement,
      (statsEl.value as unknown) as HTMLElement
    );
  };

  initInstance();
  window.addEventListener("resize", initInstance);
});
onUnmounted(() => {
  window.removeEventListener("resize", initInstance);
  // Cleanup audio when component unmounts
  cleanup();
});

const config = {
  directional: {
    enabled: true,
    helper: false,
    intensity: 2,
  },
  visualizer: {
    barCount: 32,
    barWidth: 2,
    barSpacing: 3,
    maxHeight: 20,
  },
};

const init = async (canvas: HTMLCanvasElement, statsEl: HTMLElement) => {
  stats.init(route, statsEl);
  controls.create(config, route, {}, () => createScene());

  // Setup audio controls using the new module
  setupAudio();

  const createScene = async () => {
    const elements = [] as any[];
    const { animate, setup, world, getDelta, scene } = getTools({
      stats,
      route,
      canvas,
    });
    setup({
      config: {
        camera: { position: [0, 20, 30] },
        ground: { size: 0, color: 0x333333 }, // Disable default ground
        sky: false,
        lights: { directional: { intensity: config.directional.intensity } },
      },
      defineSetup: async () => {
        // Create visualizer bars using map
        const bars: THREE.Mesh[] = Array.from(
          { length: config.visualizer.barCount },
          (_, i) => {
            const barGeometry = new THREE.BoxGeometry(
              config.visualizer.barWidth,
              1,
              config.visualizer.barWidth
            );
            const barMaterial = new THREE.MeshLambertMaterial({});
            const bar = new THREE.Mesh(barGeometry, barMaterial);

            // Position bars in a line
            const x = (i - config.visualizer.barCount / 2) * config.visualizer.barSpacing;
            bar.position.set(x, 0.5, 0);

            scene.add(bar);
            return bar;
          }
        );

        animate({
          beforeTimeline: () => {
            bindAnimatedElements(elements, world, getDelta());
          },
          timeline: [
            {
              action: () => {
                const audioData = getAudioData();

                // Update bar heights based on audio data
                bars.forEach((bar, index) => {
                  const height = 1 + audioData[index] * config.visualizer.maxHeight;
                  bar.scale.y = height;
                  bar.position.y = height / 2;
                });
              },
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

  <!-- Bottom section with audio player and credits -->
  <div class="bottom-section">
    <div class="bottom-container">
      <div class="audio-container">
        <audio
          ref="audioElement"
          controls
          autoplay
          loop
          crossorigin="anonymous"
          src="/Danger Mode - Crime Wave - 01 Summit.mp3"
        />
      </div>
      <div class="credit-text">
        <div class="song-title">Crime Wave</div>
        <div class="artist-name">by Danger Mode</div>
        <a
          href="https://dangermode.bandcamp.com/album/crime-wave"
          target="_blank"
          class="album-link"
        >
          dangermode.bandcamp.com/album/crime-wave
        </a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bottom-section {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
}

.bottom-container {
  background: rgba(0, 0, 0, 0.8);
  padding: 20px;
  border-radius: 10px;
  backdrop-filter: blur(10px);
}

.audio-container {
  display: flex;
  justify-content: center;
  margin-bottom: 15px;
}

.audio-container audio {
  width: 300px;
  height: 40px;
}

.credit-text {
  text-align: center;
  color: white;
  font-family: Arial, sans-serif;
}

.song-title {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 5px;
}

.artist-name {
  font-size: 14px;
  margin-bottom: 5px;
}

.album-link {
  color: #888;
  font-size: 12px;
  text-decoration: none;
}

.album-link:hover {
  color: #aaa;
}
</style>
