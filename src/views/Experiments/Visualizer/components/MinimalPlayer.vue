<template>
  <div class="minimal-player">
    <span class="minimal-player__song">{{ songTitle }}</span>
    <span class="minimal-player__separator"> BY </span>
    <a 
      :href="artistLink"
      target="_blank"
      rel="noopener noreferrer"
      class="minimal-player__artist"
    >{{ artist }}</a>
    
    <!-- Integrated custom audio player when showAudio is true -->
    <div v-if="showAudio" class="minimal-player__audio">
      <!-- Hidden audio element for control -->
      <audio
        ref="audioElement"
        :src="audioSrc"
        :loop="true"
        :autoplay="true"
        crossorigin="anonymous"
        @loadeddata="handleLoadedData"
        @timeupdate="updateTime"
        @loadedmetadata="updateDuration"
        @ended="handleEnded"
        @pause="isPlaying = false"
        @play="isPlaying = true"
      />
      
      <!-- Custom controls -->
      <div class="player-controls">
        <!-- Play/Pause button -->
        <button 
          @click="togglePlayPause" 
          class="control-button play-button"
          :title="isPlaying ? 'Pause' : 'Play'"
        >
          {{ isPlaying ? '⏸' : '▶' }}
        </button>
        
        <!-- Progress bar -->
        <div class="progress-container" @click="seek">
          <div class="progress-bar">
            <div 
              class="progress-fill" 
              :style="{ width: progressPercent + '%' }"
            ></div>
          </div>
        </div>
        
        <!-- Time display -->
        <span class="time-display">
          {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
        </span>
        
        <!-- Volume control -->
        <div class="volume-container">
          <button 
            @click="toggleMute" 
            class="control-button volume-button"
            :title="isMuted ? 'Unmute' : 'Mute'"
          >
            {{ isMuted ? '🔇' : '🔊' }}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            v-model="volume"
            @input="updateVolume"
            class="volume-slider"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';

interface Props {
  songTitle: string;
  artist: string;
  artistLink: string;
  showAudio?: boolean;
  audioSrc?: string;
}

withDefaults(defineProps<Props>(), {
  showAudio: false,
  audioSrc: ''
});

const emit = defineEmits<{
  audioReady: [element: HTMLAudioElement];
}>();

// Audio player state
const audioElement = ref<HTMLAudioElement>();
const isPlaying = ref(false);
const currentTime = ref(0);
const duration = ref(0);
const volume = ref(1);
const isMuted = ref(false);
const progressPercent = ref(0);

const handleLoadedData = () => {
  if (audioElement.value) {
    emit('audioReady', audioElement.value);
  }
};

const togglePlayPause = () => {
  if (!audioElement.value) return;
  
  if (isPlaying.value) {
    audioElement.value.pause();
  } else {
    audioElement.value.play();
  }
};

const updateTime = () => {
  if (!audioElement.value) return;
  
  currentTime.value = audioElement.value.currentTime;
  progressPercent.value = duration.value > 0 
    ? (currentTime.value / duration.value) * 100 
    : 0;
};

const updateDuration = () => {
  if (!audioElement.value) return;
  
  duration.value = audioElement.value.duration;
};

const seek = (event: MouseEvent) => {
  if (!audioElement.value) return;
  
  const progressContainer = event.currentTarget as HTMLElement;
  const rect = progressContainer.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  const percent = clickX / rect.width;
  const newTime = percent * duration.value;
  
  audioElement.value.currentTime = newTime;
};

const toggleMute = () => {
  if (!audioElement.value) return;
  
  isMuted.value = !isMuted.value;
  audioElement.value.muted = isMuted.value;
};

const updateVolume = () => {
  if (!audioElement.value) return;
  
  audioElement.value.volume = volume.value;
  if (volume.value === 0) {
    isMuted.value = true;
    audioElement.value.muted = true;
  } else if (isMuted.value) {
    isMuted.value = false;
    audioElement.value.muted = false;
  }
};

const formatTime = (seconds: number): string => {
  if (isNaN(seconds)) return '0:00';
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const handleEnded = () => {
  // Since we're using loop="true" in the template, this will rarely trigger
  // but we'll reset playing state just in case
  isPlaying.value = false;
};

// Watch for volume changes
watch(volume, updateVolume);

onMounted(() => {
  if (audioElement.value) {
    audioElement.value.volume = volume.value;
  }
});
</script>

<style scoped>
.minimal-player {
  position: absolute;
  top: 20px;
  left: 60px;
  z-index: 1000;
  font-weight: 900; /* Boldest possible */
  color: black;
  text-transform: uppercase;
  text-shadow: 1px 1px 0 white; /* Solid SE shadow */
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.minimal-player__song {
  color: black;
}

.minimal-player__separator {
  color: black;
}

.minimal-player__artist {
  color: black;
  text-decoration: none;
}

.minimal-player__artist:hover {
  text-decoration: underline;
}

.minimal-player__audio {
  margin-left: 16px;
}

/* Integrated Audio Player Styles */
.player-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.control-button {
  background: transparent;
  border: none;
  color: black;
  font-weight: 900;
  text-shadow: 1px 1px 0 white;
  cursor: pointer;
  font-size: 12px;
  padding: 2px 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
}

.control-button:hover {
  opacity: 0.7;
}

.progress-container {
  cursor: pointer;
  padding: 4px 0;
}

.progress-bar {
  width: 80px;
  height: 3px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 2px;
  position: relative;
  box-shadow: 0 0 0 1px white;
}

.progress-fill {
  height: 100%;
  background: black;
  border-radius: 2px;
  transition: width 0.1s ease;
  box-shadow: 0 0 0 1px white;
}

.time-display {
  color: black;
  font-weight: 900;
  text-shadow: 1px 1px 0 white;
  font-size: 10px;
  min-width: 60px;
  text-align: center;
}

.volume-container {
  display: flex;
  align-items: center;
  gap: 4px;
}

.volume-button {
  font-size: 10px;
}

.volume-slider {
  width: 50px;
  height: 3px;
  background: rgba(0, 0, 0, 0.3);
  outline: none;
  border-radius: 2px;
  appearance: none;
  box-shadow: 0 0 0 1px white;
}

.volume-slider::-webkit-slider-thumb {
  appearance: none;
  width: 8px;
  height: 8px;
  background: black;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 0 0 1px white;
}

.volume-slider::-moz-range-thumb {
  width: 8px;
  height: 8px;
  background: black;
  border-radius: 50%;
  cursor: pointer;
  border: 1px solid white;
}
</style>
