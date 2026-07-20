<script setup lang="ts">
import { onMounted, ref, type ComponentPublicInstance } from 'vue'
import { LobbyUIButton, LobbyUIFocusHint } from '@/components/LobbyUI'
import { useDialogFocusTrap } from '@/composables/useDialogFocusTrap'
import type { MePlayer } from './types'

const props = defineProps<{
  playerList: MePlayer[]
  localPeerId: string
  canRestart: boolean
}>()

const emit = defineEmits<{
  restart: []
  back: []
}>()

const playAgainReference = ref<ComponentPublicInstance | null>(null)
const dialogReference = ref<HTMLElement | null>(null)
const { focusedHint, inputSource } = useDialogFocusTrap(dialogReference)

const formatTime = (seconds: number | null): string => {
  if (seconds === null) return '--:--'
  const minutes = Math.floor(seconds / 60)
  const rest = (seconds % 60).toFixed(1).padStart(4, '0')
  return `${minutes}:${rest}`
}

onMounted(() => {
  if (props.canRestart) {
    ;(playAgainReference.value?.$el as HTMLElement | undefined)?.focus()
  }
})
</script>

<template>
  <div class="me-summary">
    <div ref="dialogReference" class="me-summary__dialog">
      <h2 class="me-summary__title lui-slide-in">Race results</h2>
      <ol class="me-summary__list lui-slide-in lui-slide-in--2">
        <li
          v-for="(player, index) in playerList"
          :key="player.id"
          class="me-summary__row"
          :class="{ 'me-summary__row--winner': index === 0 && player.finishTime !== null }"
        >
          <span class="me-summary__rank">{{ index + 1 }}</span>
          <span class="me-summary__dot" :style="{ background: player.color }" />
          <span class="me-summary__name">{{ player.name }}</span>
          <span class="me-summary__time">{{ formatTime(player.finishTime) }}</span>
        </li>
      </ol>
      <div class="me-summary__actions lui-slide-in lui-slide-in--3" data-lui-row>
        <LobbyUIButton
          v-if="canRestart"
          ref="playAgainReference"
          variant="cta"
          size="lg"
          title="Race the track again"
          @click="emit('restart')"
        >
          Play again
        </LobbyUIButton>
        <p v-else class="me-summary__waiting">Waiting for host to restart…</p>
        <LobbyUIButton
          size="sm"
          variant="ghost"
          title="Return to the track editor"
          @click="emit('back')"
        >
          Back to editor
        </LobbyUIButton>
      </div>
    </div>
    <LobbyUIFocusHint :hint="focusedHint" :visible="inputSource === 'gamepad'" />
  </div>
</template>

<style scoped>
.me-summary {
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

.me-summary__dialog {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
  min-width: 20rem;
  text-align: center;
  pointer-events: all;
}

.me-summary__title {
  margin: 0;
  font-family: var(--lui-font);
  font-size: var(--lui-text-small);
  font-weight: 900;
  line-height: 1;
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
  text-transform: uppercase;
}

.me-summary__list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  padding: 0;
  margin: 0;
  list-style: none;
}

.me-summary__row {
  display: flex;
  gap: var(--spacing-2);
  align-items: center;
  padding: var(--spacing-1) var(--spacing-2);
  font-family: var(--lui-font);
  font-size: var(--lui-text-small);
  font-weight: 900;
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
}

.me-summary__rank {
  min-width: 1.5rem;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.me-summary__dot {
  flex-shrink: 0;
  width: 0.875rem;
  height: 0.875rem;
  border-radius: 50%;
}

.me-summary__name {
  flex: 1;
  overflow: hidden;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.me-summary__time {
  font-variant-numeric: tabular-nums;
}

.me-summary__row--winner .me-summary__rank,
.me-summary__row--winner .me-summary__name,
.me-summary__row--winner .me-summary__time {
  color: var(--lui-focus-color);
}

.me-summary__actions {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  align-items: center;
}

.me-summary__waiting {
  margin: 0;
  font-family: var(--lui-font);
  font-size: var(--lui-text-small);
  font-weight: 900;
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
  text-transform: uppercase;
}
</style>
