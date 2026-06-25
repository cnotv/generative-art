<script setup lang="ts">
import { ref, computed } from 'vue'
import GenericPanel from './GenericPanel.vue'
import IconButton from '@/components/IconButton.vue'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Play, Square, Shuffle } from 'lucide-vue-next'
import { MUSIC_PATTERNS, musicRandomDrums, type MusicPatternName } from '@webgamekit/music'
import { useStrudel } from '@/composables/useStrudel'

const { isPlaying, isLoading, error, play, stop, setTempo } = useStrudel()

const presets = Object.keys(MUSIC_PATTERNS) as MusicPatternName[]
const pattern = ref<string>(MUSIC_PATTERNS.drums)
const activePreset = ref<MusicPatternName | 'random'>('drums')
const tempo = ref(0.5)

const selectPreset = (name: MusicPatternName): void => {
  activePreset.value = name
  pattern.value = MUSIC_PATTERNS[name]
  if (isPlaying.value) play(pattern.value)
}

const randomise = (): void => {
  activePreset.value = 'random'
  pattern.value = musicRandomDrums()
  if (isPlaying.value) play(pattern.value)
}

const toggle = (): void => {
  if (isPlaying.value) stop()
  else play(pattern.value)
}

const onTempo = (value: number[]): void => {
  tempo.value = value[0]
  setTempo(tempo.value)
}

const playLabel = computed(() => (isPlaying.value ? 'Stop' : 'Play'))
</script>

<template>
  <GenericPanel panel-type="music" side="right" title="Music">
    <div class="music-panel">
      <div class="music-panel__row">
        <IconButton panel-colors :title="playLabel" :disabled="isLoading" @click="toggle">
          <Square v-if="isPlaying" />
          <Play v-else />
        </IconButton>
        <Button
          variant="outline"
          size="sm"
          title="Generate a random drum pattern"
          @click="randomise"
        >
          <Shuffle class="music-panel__icon" />
          Randomise
        </Button>
      </div>

      <div class="music-panel__presets">
        <Button
          v-for="name in presets"
          :key="name"
          size="sm"
          :variant="activePreset === name ? 'default' : 'outline'"
          @click="selectPreset(name)"
        >
          {{ name }}
        </Button>
      </div>

      <label class="music-panel__label">Tempo (cps)</label>
      <Slider
        :model-value="[tempo]"
        :min="0.25"
        :max="1.5"
        :step="0.05"
        @update:model-value="onTempo"
      />

      <pre class="music-panel__pattern">{{ pattern }}</pre>

      <p v-if="error" class="music-panel__error">{{ error }}</p>
    </div>
  </GenericPanel>
</template>

<style scoped>
.music-panel {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  min-width: 16rem;
}

.music-panel__row {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

.music-panel__presets {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-1);
}

.music-panel__icon {
  width: var(--font-size-sm);
  height: var(--font-size-sm);
}

.music-panel__label {
  font-size: var(--font-size-xs);
  color: var(--color-muted-foreground);
}

.music-panel__pattern {
  margin: 0;
  padding: var(--spacing-2);
  background: var(--panel-item-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-family: monospace;
  font-size: var(--font-size-xs);
  color: var(--color-foreground);
  white-space: pre-wrap;
  overflow-wrap: break-word;
}

.music-panel__error {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--color-destructive);
}
</style>
