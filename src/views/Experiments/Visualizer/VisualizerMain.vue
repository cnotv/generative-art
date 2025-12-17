<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { controls } from "@/utils/control";
import { stats } from "@/utils/stats";
import * as THREE from "three";

import { getTools } from "@webgamekit/threejs";
import { bindAnimatedElements } from "@webgamekit/animation";
import { setupAudio, cleanup, toggleAudioSource, getAudioSource } from "./audio";
import {
  getVisualizer,
  getVisualizerNames,
  type VisualizerSetup,
  setupVisualizerClickHandlers,
  clearVisualizerClickHandlers
} from "./visualizer";
import MinimalPlayer from "./components/MinimalPlayer.vue";
import ContrastPlayer from "./components/ContrastPlayer.vue";

const statsEl = ref(null);
const canvas = ref(null);
const audioElement = ref<HTMLAudioElement>();
const route = useRoute();
const router = useRouter();

// Get available visualizer names first
const availableVisualizerNames = getVisualizerNames();

// Initialize currentVisualizer based on query params with fallbacks
const initializeVisualizer = () => {
  // 1. Try to get from query parameter
  const queryVisualizer = route.query.style as string;
  if (queryVisualizer && availableVisualizerNames.includes(queryVisualizer)) {
    return queryVisualizer;
  }

  // 2. Fallback to default
  const defaultVisualizer = 'circular-waves';
  if (availableVisualizerNames.includes(defaultVisualizer)) {
    return defaultVisualizer;
  }

  // 3. Fallback to first available visualizer
  return availableVisualizerNames[0] || defaultVisualizer;
};

const currentVisualizer = ref(initializeVisualizer());
const visualizer = ref(getVisualizer(currentVisualizer.value) as VisualizerSetup);
const visualizerObjects = ref({} as Record<string, any>);
let switchVisualizerFunction: ((name: string) => void) | null = null;

// Initialize player type from query params
const initializePlayerType = () => {
  const queryPlayer = route.query.player as string;
  if (queryPlayer === 'contrast') {
    return false; // false = contrast player
  }
  return true; // true = minimal player (default)
};

// Control which player shows audio (true = minimal, false = contrast)
const showAudioInMinimal = ref(initializePlayerType());

// Audio source control
const currentAudioSource = ref<'song' | 'microphone' | 'selected-output'>('song');

// Custom dropdown state
const isDropdownOpen = ref(false);
const dropdownRef = ref<HTMLElement>();

// Get available visualizer names for dropdown
const availableVisualizers = computed(() => {
  return availableVisualizerNames.map(name => ({
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

// Watch for visualizer changes and update URL
watch(currentVisualizer, (newVisualizer) => {
  // Update URL query parameter
  router.push({
    query: {
      ...route.query,
      style: newVisualizer
    }
  });

  // Switch visualizer
  if (switchVisualizerFunction) {
    switchVisualizerFunction(newVisualizer);
  }
});

// Watch for route changes (browser back/forward) and update visualizer
watch(() => route.query.style, (newQueryVisualizer) => {
  const queryVisualizer = newQueryVisualizer as string;
  if (
    queryVisualizer &&
    availableVisualizerNames.includes(queryVisualizer) &&
    queryVisualizer !== currentVisualizer.value
  ) {
    currentVisualizer.value = queryVisualizer;
  }
});

// Watch for route changes (browser back/forward) and update player type
watch(() => route.query.player, (newQueryPlayer) => {
  const queryPlayer = newQueryPlayer as string;
  const shouldShowMinimal = queryPlayer !== 'contrast';

  if (shouldShowMinimal !== showAudioInMinimal.value) {
    showAudioInMinimal.value = shouldShowMinimal;
  }
});

let initInstance: () => void;

const handleAudioReady = (element: HTMLAudioElement) => {
  audioElement.value = element;
  if (audioElement.value) {
    setupAudio(audioElement.value);
  }
};

const togglePlayerStyle = () => {
  showAudioInMinimal.value = !showAudioInMinimal.value;

  // Update URL query parameter
  router.push({
    query: {
      ...route.query,
      player: showAudioInMinimal.value ? 'minimal' : 'contrast'
    }
  });
};

// Audio source display constants
const AUDIO_SOURCE_CONFIG = {
  'song': { icon: '🎵', text: 'Song', nextTitle: 'Switch to Microphone Input' },
  'microphone': { icon: '🎤', text: 'Mic', nextTitle: 'Switch to Selected Audio Output' },
  'selected-output': { icon: '🔊', text: 'Audio', nextTitle: 'Switch to Song Playback' }
} as const;

// Audio source toggle function
const handleAudioSourceToggle = async () => {
  const success = await toggleAudioSource();
  if (success) {
    currentAudioSource.value = getAudioSource();
    console.log(`Switched to ${currentAudioSource.value} input`);
  } else {
    console.error('Failed to toggle audio source');
  }
};

// Combined function for audio source display
const getAudioSourceDisplay = () => {
  const config = AUDIO_SOURCE_CONFIG[currentAudioSource.value] || AUDIO_SOURCE_CONFIG['song'];
  return {
    icon: config.icon,
    text: config.text,
    title: config.nextTitle
  };
};

// Custom dropdown functions
const toggleDropdown = () => {
  isDropdownOpen.value = !isDropdownOpen.value;
};

const selectVisualizer = (visualizerValue: string) => {
  currentVisualizer.value = visualizerValue;
  isDropdownOpen.value = false;
};

const closeDropdown = (event: Event) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    isDropdownOpen.value = false;
  }
};

// Get current visualizer label for display
const currentVisualizerLabel = computed(() => {
  const current = availableVisualizers.value.find(v => v.value === currentVisualizer.value);
  return current?.label || currentVisualizer.value;
});

onMounted(() => {
  initInstance = () => {
    init(
      (canvas.value as unknown) as HTMLCanvasElement,
      (statsEl.value as unknown) as HTMLElement
    );
  };

  initInstance();
  window.addEventListener("resize", initInstance);
  document.addEventListener("click", closeDropdown);

  // Auto-play audio when mounted
  setTimeout(() => {
    if (audioElement.value) {
      audioElement.value.play().catch();
    }
  }, 100);
});

onUnmounted(() => {
  window.removeEventListener("resize", initInstance);
  document.removeEventListener("click", closeDropdown);
  clearVisualizerClickHandlers();
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
  if (audioElement.value) {
    setupAudio(audioElement.value);
  }

  const createScene = async () => {
    const elements = [] as any[];
    const { animate, setup, world, getDelta, scene, camera } = await getTools({
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
        // Helper function to reset camera based on visualizer configuration
        const resetCamera = (visualizerSetup: VisualizerSetup | null) => {
          if (visualizerSetup && visualizerSetup.camera) {
            // Use visualizer-specific camera position if defined
            camera.position.set(...visualizerSetup?.camera?.position as [number, number, number] || [0, 0, 0]);
            camera.rotation.set(...(visualizerSetup?.camera?.rotation as [number, number, number]) || [0, 0, 0]);
            camera.lookAt(10, 10, 10);
          } else {
            // Default camera position for visualizers without camera config
            camera.position.set(0, 20, 30);
            camera.lookAt(0, 0, 0);
          }
        };

        // Helper function to clear existing visualizer objects from scene
        const clearVisualizerObjects = (currentVisualizer: VisualizerSetup | null) => {
          if (currentVisualizer) {
            // Remove all objects from scene except lights and camera
            const objectsToRemove = scene.children.filter(
              (child) =>
                child.type !== "DirectionalLight" &&
                child.type !== "AmbientLight" &&
                child.type !== "HemisphereLight"
            );
            objectsToRemove.forEach((obj) => scene.remove(obj));
          }
        };

        const switchVisualizer = async (name: string) => {
          clearVisualizerObjects(visualizer.value);
          scene.background = new THREE.Color(0x87CEEB); // Default sky blue background
          visualizer.value = getVisualizer(name);
          resetCamera(visualizer.value);

          if (visualizer.value) {
            // Setup the visualizer and store the returned objects
            const setupResult = await visualizer.value.setup(scene, world);
            visualizerObjects.value = setupResult;
          }

          // Setup click/touch handlers for the new visualizer
          setupVisualizerClickHandlers(visualizer.value, camera, canvas, visualizerObjects.value);

          // Reset and update the animation with new timeline
          animate({
            beforeTimeline: () => {
              bindAnimatedElements(elements, world, getDelta());
            },
            timeline: visualizer.value?.getTimeline(() => visualizerObjects.value) ?? [],
          });
        };

        // Store the switch function for the watcher
        switchVisualizerFunction = switchVisualizer;

        // Initialize with default visualizer
        await switchVisualizer(currentVisualizer.value);
      },
    });
  };
  createScene();
};
</script>

<template>
  <div ref="statsEl"></div>
  <canvas ref="canvas"></canvas>

  <div class="header">
    <!-- Player style toggle button -->
    <button
      @click="togglePlayerStyle"
      class="player-toggle"
      :title="
        showAudioInMinimal ? 'Switch to Contrast Player' : 'Switch to Minimal Player'
      "
    >
      {{ showAudioInMinimal ? "CONTRAST" : "MINIMAL" }}
    </button>

    <!-- Audio source toggle button -->
    <button
      @click="handleAudioSourceToggle"
      class="audio-source-toggle"
      :title="getAudioSourceDisplay().title"
    >
      {{ getAudioSourceDisplay().icon }} {{ getAudioSourceDisplay().text }}
    </button>

    <MinimalPlayer
      v-if="showAudioInMinimal"
      :song-title="songs[currentSong].title"
      :artist="songs[currentSong].artist"
      :artist-link="songs[currentSong].link"
      :show-audio="true"
      :audio-src="songs[currentSong].src"
      @audio-ready="handleAudioReady"
    />

    <!-- Custom Visualizer selector -->
    <div class="visualizer" ref="dropdownRef">
      <button
        @click="toggleDropdown"
        class="visualizer__button"
        :class="{ 'visualizer__button--open': isDropdownOpen }"
      >
        {{ currentVisualizerLabel }}
        <span class="visualizer__arrow">{{ isDropdownOpen ? "▲" : "▼" }}</span>
      </button>

      <div v-if="isDropdownOpen" class="visualizer__dropdown">
        <button
          v-for="visualizer in availableVisualizers"
          :key="visualizer.value"
          @click="selectVisualizer(visualizer.value)"
          class="visualizer__option"
          :class="{
            'visualizer__option--active': visualizer.value === currentVisualizer,
          }"
        >
          {{ visualizer.label }}
        </button>
      </div>
    </div>
  </div>

  <!-- Contrast player -->
  <ContrastPlayer
    v-if="!showAudioInMinimal"
    :song-title="songs[currentSong].title"
    :artist="songs[currentSong].artist"
    :artist-link="songs[currentSong].link"
    :show-audio="true"
    :audio-src="songs[currentSong].src"
    @audio-ready="handleAudioReady"
  />
</template>

<style scoped>
.header {
  position: absolute;
  top: 16px;
  left: 16px;
  right: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 10;
}

.visualizer__button {
  background: transparent;
  color: black;
  border: none;
  font-weight: 900;
  text-transform: uppercase;
  text-shadow: 1px 1px 0 white;
  font-size: 14px;
  cursor: pointer;
  padding: 0;
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: opacity 0.2s ease;
}

.visualizer__button:focus {
  outline: none;
}

.visualizer__button:hover {
  opacity: 0.7;
}

.visualizer__arrow {
  font-size: 10px;
  transition: transform 0.2s ease;
}

.visualizer__button--open .visualizer__arrow {
  transform: rotate(180deg);
}

.visualizer__dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 8px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 4px;
  padding: 4px 0;
  min-width: 120px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.visualizer__option {
  display: block;
  width: 100%;
  background: transparent;
  color: black;
  border: none;
  font-weight: 900;
  text-transform: uppercase;
  text-shadow: none;
  font-size: 12px;
  cursor: pointer;
  padding: 6px 12px;
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  text-align: left;
  transition: background-color 0.2s ease;
}

.visualizer__option:hover {
  background: rgba(0, 0, 0, 0.1);
}

.visualizer__option--active {
  background: rgba(0, 0, 0, 0.15);
  font-weight: 900;
}

.visualizer__option:focus {
  outline: none;
  background: rgba(0, 0, 0, 0.1);
}

/* Player Toggle */
.player-toggle {
  background: transparent;
  color: black;
  border: none;
  font-weight: 900;
  text-transform: uppercase;
  text-shadow: 1px 1px 0 white;
  font-size: 14px;
  cursor: pointer;
  padding: 0;
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  transition: opacity 0.2s ease;
}

.player-toggle:focus {
  outline: none;
}

.player-toggle:hover {
  opacity: 0.7;
}

/* Audio Source Toggle */
.audio-source-toggle {
  background: transparent;
  color: black;
  border: none;
  font-size: 14px;
  font-weight: 900;
  text-transform: uppercase;
  cursor: pointer;
  padding: 4px 8px;
  transition: all 0.2s ease;
  text-shadow: 1px 1px 0 white;
  border-radius: 4px;
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  display: flex;
  align-items: center;
  gap: 4px;
}

.audio-source-toggle:focus {
  outline: none;
}

.audio-source-toggle:hover {
  opacity: 0.7;
  background: rgba(255, 255, 255, 0.1);
}
</style>
