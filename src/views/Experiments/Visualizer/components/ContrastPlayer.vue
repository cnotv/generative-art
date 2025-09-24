<template>
  <div class="player">
    <div class="player__container">
      <div v-if="showAudio" class="player__audio-wrapper">
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
      <div class="player__credits">
        <div class="player__song-title">{{ songTitle }}</div>
        <div class="player__artist">
          by
          <a
            :href="artistLink"
            target="_blank"
            rel="noopener noreferrer"
            class="player__link"
            >{{ artist }}</a
          >
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
/* Player Block */
.player {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
}

.player__container {
  background: rgba(255, 255, 255, 0.9);
  padding: 20px;
  border-radius: 10px;
  backdrop-filter: blur(5px);
}

.player__audio-wrapper {
  display: flex;
  justify-content: center;
  margin-bottom: 15px;
}

/* Integrated Audio Player Styles */
.player-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.control-button {
  background: transparent;
  border: none;
  color: black;
  font-weight: 900;
  text-shadow: 1px 1px 2px rgba(255, 255, 255, 0.7);
  cursor: pointer;
  font-size: 16px;
  padding: 4px 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 28px;
  border-radius: 4px;
  transition: background-color 0.2s ease;
}

.control-button:hover {
  background: rgba(0, 0, 0, 0.1);
}

.progress-container {
  cursor: pointer;
  padding: 6px 0;
}

.progress-bar {
  width: 200px;
  height: 6px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
  position: relative;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: black;
  border-radius: 3px;
  transition: width 0.1s ease;
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.3);
}

.time-display {
  color: black;
  font-weight: 900;
  text-shadow: 1px 1px 2px rgba(255, 255, 255, 0.7);
  font-size: 14px;
  min-width: 80px;
  text-align: center;
}

.volume-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.volume-button {
  font-size: 14px;
}

.volume-slider {
  width: 80px;
  height: 6px;
  background: rgba(0, 0, 0, 0.2);
  outline: none;
  border-radius: 3px;
  appearance: none;
  cursor: pointer;
}

.volume-slider::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  background: black;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  transition: transform 0.2s ease;
}

.volume-slider::-webkit-slider-thumb:hover {
  transform: scale(1.1);
}

.volume-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: black;
  border-radius: 50%;
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.volume-slider::-moz-range-track {
  background: rgba(0, 0, 0, 0.2);
  height: 6px;
  border-radius: 3px;
}

.player__credits {
  text-align: center;
  color: black;
  font-weight: 900;
  text-shadow: 1px 1px 2px rgba(255, 255, 255, 0.7);
}

.player__song-title {
  font-size: 18px;
  font-weight: 900;
  text-shadow: 1px 1px 2px rgba(255, 255, 255, 0.7);
}

.player__artist {
  font-size: 14px;
  font-weight: 900;
  text-shadow: 1px 1px 2px rgba(255, 255, 255, 0.7);
}

.player__link {
  color: #444;
  font-weight: 900;
  text-shadow: 1px 1px 2px rgba(255, 255, 255, 0.7);
}

.player__link:hover {
  color: #aaa;
}
</style>
