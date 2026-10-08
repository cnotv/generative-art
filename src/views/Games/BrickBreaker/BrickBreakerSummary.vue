<script setup lang="ts">
import { computed, onMounted, ref, type ComponentPublicInstance } from 'vue'
import { LobbyUIButton, LobbyUIFocusHint } from '@/components/LobbyUI'
import { useDialogFocusTrap } from '@/composables/useDialogFocusTrap'
import type { MatchResult } from '@/types/seededMatch'
import type { BbPlayer } from './types'

const props = defineProps<{
  ranking: MatchResult[]
  players: Record<string, BbPlayer>
  localPlayerId: string
  isSolo: boolean
  canRestart: boolean
  highScore: number
}>()

const emit = defineEmits<{ restart: [] }>()

const playAgainReference = ref<ComponentPublicInstance | null>(null)
const dialogReference = ref<HTMLElement | null>(null)
const { focusedHint, inputSource } = useDialogFocusTrap(dialogReference)

const rows = computed(() =>
  props.ranking.map((result) => ({
    ...result,
    name: props.players[result.playerId]?.name ?? 'Left the room',
    color: props.players[result.playerId]?.color ?? 'transparent'
  }))
)

const winnerId = computed(() => props.ranking[0]?.playerId ?? null)

const title = computed(() => {
  if (props.isSolo) return 'Game over'
  return winnerId.value === props.localPlayerId ? 'You win!' : `${rows.value[0]?.name} wins!`
})

onMounted(() => {
  if (props.canRestart) {
    ;(playAgainReference.value?.$el as HTMLElement | undefined)?.focus()
  }
})
</script>

<template>
  <div class="bb-summary">
    <div ref="dialogReference" class="bb-summary__dialog">
      <h2
        class="bb-summary__title lui-slide-in"
        :class="{ 'bb-summary__title--winner': !isSolo && winnerId === localPlayerId }"
      >
        {{ title }}
      </h2>
      <ol class="bb-summary__list lui-slide-in lui-slide-in--2">
        <li
          v-for="(row, index) in rows"
          :key="row.playerId"
          class="bb-summary__row"
          :class="{ 'bb-summary__row--winner': !isSolo && index === 0 }"
        >
          <span class="bb-summary__rank">{{ index + 1 }}</span>
          <span class="bb-summary__dot" :style="{ background: row.color }" />
          <span class="bb-summary__name">{{ row.name }}</span>
          <span class="bb-summary__score">{{ row.score }}</span>
        </li>
      </ol>
      <p v-if="isSolo && highScore > 0" class="bb-summary__hint lui-slide-in lui-slide-in--2">
        Best {{ highScore }}
      </p>
      <div class="bb-summary__actions lui-slide-in lui-slide-in--3" data-lui-row>
        <LobbyUIButton
          v-if="canRestart"
          ref="playAgainReference"
          variant="cta"
          size="sm"
          title="Start a new match with a fresh wall"
          @click="emit('restart')"
        >
          Play again
        </LobbyUIButton>
        <p v-else class="bb-summary__hint">Waiting for host…</p>
      </div>
    </div>
    <LobbyUIFocusHint :hint="focusedHint" :visible="inputSource === 'gamepad'" />
  </div>
</template>

<style scoped>
.bb-summary {
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

.bb-summary__dialog {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
  min-width: 20rem;
  text-align: center;
  pointer-events: all;
}

.bb-summary__title {
  margin: 0;
  font-family: var(--lui-font);
  font-size: var(--lui-text-medium);
  font-weight: 900;
  line-height: 1;
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
  text-transform: uppercase;
}

.bb-summary__title--winner {
  color: var(--lui-focus-color);
}

.bb-summary__list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  padding: 0;
  margin: 0;
  list-style: none;
}

.bb-summary__row {
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

.bb-summary__rank {
  min-width: 1.5rem;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.bb-summary__dot {
  flex-shrink: 0;
  width: 0.875rem;
  height: 0.875rem;
  border-radius: 50%;
}

.bb-summary__name {
  flex: 1;
  overflow: hidden;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bb-summary__score {
  font-variant-numeric: tabular-nums;
}

.bb-summary__row--winner .bb-summary__rank,
.bb-summary__row--winner .bb-summary__name,
.bb-summary__row--winner .bb-summary__score {
  color: var(--lui-focus-color);
}

.bb-summary__actions {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  align-items: center;
}

.bb-summary__hint {
  margin: 0;
  font-family: var(--lui-font);
  font-size: var(--lui-text-small);
  font-weight: 900;
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
  text-transform: uppercase;
}
</style>
