<script setup lang="ts">
import { onMounted, ref, type ComponentPublicInstance } from 'vue'
import { LobbyUIButton, LobbyUIFocusHint } from '@/components/LobbyUI'
import { useDialogFocusTrap } from '@/composables/useDialogFocusTrap'
import type { RrPlayer } from '../types'

const props = defineProps<{
  playerList: RrPlayer[]
  localPeerId: string
  canRestart: boolean
}>()

const emit = defineEmits<{
  restart: []
  back: []
}>()

const runAgainReference = ref<ComponentPublicInstance | null>(null)
const dialogReference = ref<HTMLElement | null>(null)
const { focusedHint, inputSource } = useDialogFocusTrap(dialogReference)

const formatDistance = (distance: number): string => `${Math.round(distance)} m`

onMounted(() => {
  if (props.canRestart) {
    ;(runAgainReference.value?.$el as HTMLElement | undefined)?.focus()
  }
})
</script>

<template>
  <div class="rr-summary">
    <div ref="dialogReference" class="rr-summary__dialog">
      <h2 class="rr-summary__title lui-slide-in">Distance run</h2>
      <ol class="rr-summary__list lui-slide-in lui-slide-in--2">
        <li
          v-for="(player, index) in playerList"
          :key="player.id"
          class="rr-summary__row"
          :class="{ 'rr-summary__row--winner': index === 0 && player.distance > 0 }"
        >
          <span class="rr-summary__rank">{{ index + 1 }}</span>
          <span class="rr-summary__dot" :style="{ background: player.color }" />
          <span class="rr-summary__name">{{ player.name }}</span>
          <span class="rr-summary__distance">{{ formatDistance(player.distance) }}</span>
        </li>
      </ol>
      <div class="rr-summary__actions lui-slide-in lui-slide-in--3" data-lui-row>
        <LobbyUIButton
          v-if="canRestart"
          ref="runAgainReference"
          variant="cta"
          size="lg"
          title="Start a fresh run"
          @click="emit('restart')"
        >
          Run again
        </LobbyUIButton>
        <p v-else class="rr-summary__waiting">Waiting for host to restart…</p>
        <LobbyUIButton size="sm" variant="ghost" title="Return to the lobby" @click="emit('back')">
          Back to lobby
        </LobbyUIButton>
      </div>
    </div>
    <LobbyUIFocusHint :hint="focusedHint" :visible="inputSource === 'gamepad'" />
  </div>
</template>

<style scoped>
.rr-summary {
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

.rr-summary__dialog {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
  min-width: 20rem;
  text-align: center;
  pointer-events: all;
}

.rr-summary__title {
  margin: 0;
  font-family: var(--lui-font);
  font-size: var(--lui-text-medium);
  font-weight: 900;
  line-height: 1;
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
  text-transform: uppercase;
}

.rr-summary__list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  padding: 0;
  margin: 0;
  list-style: none;
}

.rr-summary__row {
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

.rr-summary__rank {
  min-width: 1.5rem;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.rr-summary__dot {
  flex-shrink: 0;
  width: 0.875rem;
  height: 0.875rem;
  border-radius: 50%;
}

.rr-summary__name {
  flex: 1;
  overflow: hidden;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rr-summary__distance {
  font-variant-numeric: tabular-nums;
}

.rr-summary__row--winner .rr-summary__rank,
.rr-summary__row--winner .rr-summary__name,
.rr-summary__row--winner .rr-summary__distance {
  color: var(--lui-focus-color);
}

.rr-summary__actions {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  align-items: center;
}

.rr-summary__waiting {
  margin: 0;
  font-family: var(--lui-font);
  font-size: var(--lui-text-small);
  font-weight: 900;
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
  text-transform: uppercase;
}
</style>
