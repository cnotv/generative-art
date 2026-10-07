<script setup lang="ts">
import { ref } from 'vue'
import { LobbyUIButton, LobbyUIFocusHint, LobbyUIOptionToggle } from '@/components/LobbyUI'
import { useDialogFocusTrap } from '@/composables/useDialogFocusTrap'
import type { Level } from '../types'

defineProps<{
  levels: Level[]
  unlockedCount: number
  languages: Array<{ value: string; label: string }>
}>()

const language = defineModel<string>('language', { required: true })

const emit = defineEmits<{
  start: [levelId: string]
}>()

const dialogReference = ref<HTMLElement | null>(null)
const { focusedHint, inputSource } = useDialogFocusTrap(dialogReference)
</script>

<template>
  <div class="word-runner-start">
    <div ref="dialogReference" class="word-runner-start__dialog">
      <h1 class="word-runner-start__title lui-slide-in">Word Runner</h1>
      <p class="word-runner-start__hint lui-slide-in lui-slide-in--2">
        Race the bot through a text, one word at a time. The right word is the faster route, and
        every word keeps its lane. Win to open the next level.
      </p>
      <div class="lui-slide-in lui-slide-in--2" data-lui-row>
        <LobbyUIOptionToggle v-model="language" :options="languages" size="sm" />
      </div>
      <ul class="word-runner-start__levels lui-slide-in lui-slide-in--3">
        <li
          v-for="(level, index) in levels"
          :key="level.id"
          class="word-runner-start__level"
          data-lui-row
        >
          <LobbyUIButton
            :autofocus="index === unlockedCount - 1"
            :variant="index === unlockedCount - 1 ? 'cta' : 'primary'"
            :disabled="index >= unlockedCount"
            size="sm"
            :title="level.situation"
            @click="emit('start', level.id)"
          >
            {{ level.cefr }} · {{ level.title }}
          </LobbyUIButton>
          <span class="word-runner-start__situation">{{ level.situation }}</span>
        </li>
      </ul>
      <p class="word-runner-start__situation lui-slide-in lui-slide-in--3">
        Win a level's race to open the next one.
      </p>
    </div>
    <LobbyUIFocusHint :hint="focusedHint" :visible="inputSource === 'gamepad'" />
  </div>
</template>

<style scoped>
.word-runner-start {
  position: absolute;
  inset: 0;
  z-index: var(--z-overlay);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-4);
  pointer-events: none;
}

.word-runner-start__dialog {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  align-items: center;
  max-width: 36rem;
  text-align: center;
  pointer-events: all;
}

.word-runner-start__title {
  margin: 0;
  font-family: var(--lui-font);
  font-size: var(--lui-text-important);
  line-height: 1;
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
  text-transform: uppercase;
}

.word-runner-start__hint,
.word-runner-start__situation {
  margin: 0;
  font-family: var(--lui-font);
  font-size: var(--lui-text-small);
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
}

.word-runner-start__situation {
  font-size: var(--lui-text-tiny);
}

.word-runner-start__levels {
  display: grid;
  grid-template-columns: auto auto;
  gap: var(--spacing-1) var(--spacing-3);
  align-items: center;
  padding: 0;
  margin: 0;
  list-style: none;
}

.word-runner-start__level {
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
  align-items: center;
}

.word-runner-start__level .word-runner-start__situation {
  text-align: left;
}
</style>
