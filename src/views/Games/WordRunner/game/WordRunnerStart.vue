<script setup lang="ts">
import { ref } from 'vue'
import { LobbyUIButton, LobbyUIFocusHint } from '@/components/LobbyUI'
import { useDialogFocusTrap } from '@/composables/useDialogFocusTrap'
import type { Phrase } from '../types'

defineProps<{
  phrases: Phrase[]
  languageName: string
}>()

const emit = defineEmits<{
  start: [phraseId: string]
}>()

const dialogReference = ref<HTMLElement | null>(null)
const { focusedHint, inputSource } = useDialogFocusTrap(dialogReference)
</script>

<template>
  <div class="word-runner-start">
    <div ref="dialogReference" class="word-runner-start__dialog">
      <h1 class="word-runner-start__title lui-slide-in">Word Runner</h1>
      <p class="word-runner-start__hint lui-slide-in lui-slide-in--2">
        Run through the next word of the phrase. Every word keeps its lane, so the phrase becomes a
        path.
      </p>
      <p class="word-runner-start__language lui-slide-in lui-slide-in--2">{{ languageName }}</p>
      <ul class="word-runner-start__phrases lui-slide-in lui-slide-in--3">
        <li v-for="(phrase, index) in phrases" :key="phrase.id" data-lui-row>
          <LobbyUIButton
            :autofocus="index === 0"
            :variant="index === 0 ? 'cta' : 'primary'"
            size="sm"
            :title="phrase.translation"
            @click="emit('start', phrase.id)"
          >
            {{ phrase.title }}
          </LobbyUIButton>
        </li>
      </ul>
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
.word-runner-start__language {
  margin: 0;
  font-family: var(--lui-font);
  font-size: var(--lui-text-small);
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
}

.word-runner-start__language {
  font-size: var(--lui-text-tiny);
  text-transform: uppercase;
}

.word-runner-start__phrases {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  align-items: center;
  padding: 0;
  margin: 0;
  list-style: none;
}
</style>
