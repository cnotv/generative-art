<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from "vue";
import { useRoute } from "vue-router";
import { controls } from "@/utils/control";
import { stats } from "@/utils/stats";

import { getTools } from "@/utils/threeJs";
import { bindAnimatedElements } from "@/utils/animation";
import { setupAudio, cleanup } from "./audio";
import { getVisualizer, getVisualizerNames, type VisualizerSetup } from "./visualizer";

const statsEl = ref(null);
const canvas = ref(null);
const audioElement = ref(null);
const route = useRoute();
const currentVisualizer = ref('basic'); // Use first available visualizer
const visualizer = ref(getVisualizer(currentVisualizer.value) as VisualizerSetup);
const visualizerObjects = ref({} as Record<string, any>);
let switchVisualizerFunction: ((name: string) => void) | null = null;

// Get available visualizer names
const availableVisualizers = computed(() => {
  return getVisualizerNames().map(name => ({
    value: name,
    label: name.charAt(0).toUpperCase() + name.slice(1) // Capitalize first letter
  }));
});

const currentSong = computed((): number => {
  const song = visualizer.value?.song;
  const isValid = (typeof song === 'number' && song >= 0 && song < songs.length)
  if (isValid) {
    return song;
  } else {
    console.warn(`Visualizer "${visualizer.value?.name}" has invalid song index (${song}). Defaulting to 0.`);

    return 0;
  }
});

const songs = [
  {
    src: "/Danger Mode - Crime Wave - 01 Summit.mp3",
    title: "Crime Wave",
    artist: "Danger Mode",
    link: "https://dangermode.bandcamp.com/album/crime-wave"
  },
  {
    src: "/Shotgun Sawyer - You Got to Run (Single) - 01 You Got to Run (Single Version).mp3",
    title: "You Got to Run",
    artist: "Shotgun Sawyer",
    link: "https://shotgunsawyer.bandcamp.com/album/you-got-to-run-single"
  },
  {
    src: "/Zef - Ground Zero - 01 Livewire.mp3",
    title: "Ground Zero",
    artist: "Zef",
    link: "https://zef-music.bandcamp.com/album/ground-zero"
  }
];

// Watch for visualizer changes
watch(currentVisualizer, (newVisualizer) => {
  if (switchVisualizerFunction) {
    switchVisualizerFunction(newVisualizer);
  }
});

// Watch for song changes and reinitialize audio
watch(currentSong, () => {
  if (audioElement.value) {
    setupAudio(audioElement.value as HTMLAudioElement);
  }
});

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
};

const init = async (canvas: HTMLCanvasElement, statsEl: HTMLElement) => {
  stats.init(route, statsEl);
  controls.create(config, route, {}, () => createScene());

  // Setup audio controls using the new module with audio element reference
  if (audioElement.value) {
    setupAudio(audioElement.value as HTMLAudioElement);
  } else {
    setupAudio();
  }

  const createScene = async () => {
    const elements = [] as any[];
    const { animate, setup, world, getDelta, scene, camera } = getTools({
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
        // Function to switch visualizers
        const switchVisualizer = (name: string) => {
          // Clear existing visualizer objects
          if (visualizer.value) {
            // Remove all objects from scene except lights and camera
            const objectsToRemove = scene.children.filter(
              (child) =>
                child.type !== "DirectionalLight" &&
                child.type !== "AmbientLight" &&
                child.type !== "HemisphereLight"
            );
            objectsToRemove.forEach((obj) => scene.remove(obj));
          }

          // Reset camera position and rotation
          camera.position.set(0, 20, 30);
          camera.rotation.set(0, 0, 0);
          camera.lookAt(0, 0, 0);

          visualizer.value = getVisualizer(name);

          if (visualizer.value) {
            // Setup the visualizer and store the returned objects
            const setupResult = visualizer.value.setup(scene);
            visualizerObjects.value = setupResult;
          }
        };

        // Store the switch function for the watcher
        switchVisualizerFunction = switchVisualizer;

        // Initialize with default visualizer
        switchVisualizer(currentVisualizer.value);
        animate({
          beforeTimeline: () => {
            bindAnimatedElements(elements, world, getDelta());
          },
          timeline: [
            {
              action: () => {
                if (visualizer.value && visualizerObjects.value) {
                  visualizer.value.animate(visualizerObjects.value);
                }
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

  <!-- Visualizer selector -->
  <div class="visualizer">
    <select class="visualizer__select" v-model="currentVisualizer">
      <option
        v-for="visualizer in availableVisualizers"
        :key="visualizer.value"
        :value="visualizer.value"
      >
        {{ visualizer.label }}
      </option>
    </select>
  </div>

  <!-- Bottom section with audio player and credits -->
  <div class="player">
    <div class="player__container">
      <div class="player__audio-wrapper">
        <audio
          ref="audioElement"
          class="player__audio"
          controls
          loop
          crossorigin="anonymous"
          :src="songs[currentSong].src"
        />
      </div>
      <div class="player__credits">
        <div class="player__song-title">{{ songs[currentSong].title }}</div>
        <div class="player__artist">by {{ songs[currentSong].artist }}</div>
        <a
          :href="songs[currentSong].link"
          target="_blank"
          rel="noopener noreferrer"
          class="player__link"
          >Artist Link</a
        >
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Visualizer Block */
.visualizer {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 1000;
}

.visualizer__select {
  background: rgba(0, 0, 0, 0.8);
  color: white;
  border: 1px solid #444;
  border-radius: 5px;
  padding: 8px 12px;
  font-size: 14px;
  cursor: pointer;
}

.visualizer__select:focus {
  outline: none;
  border-color: #666;
}

/* Player Block */
.player {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
}

.player__container {
  background: rgba(0, 0, 0, 0.8);
  padding: 20px;
  border-radius: 10px;
  backdrop-filter: blur(10px);
}

.player__audio-wrapper {
  display: flex;
  justify-content: center;
  margin-bottom: 15px;
}

.player__audio {
  width: 300px;
  height: 40px;
}

.player__credits {
  text-align: center;
  color: white;
  font-family: Arial, sans-serif;
}

.player__song-title {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 5px;
}

.player__artist {
  font-size: 14px;
  margin-bottom: 5px;
}

.player__link {
  color: #888;
  font-size: 12px;
  text-decoration: none;
}

.player__link:hover {
  color: #aaa;
}
</style>
