<script setup lang="ts">
import type { ChatMessage } from '@webgamekit/chat'
import { Chat } from '@/components/Chat'

export type MultiplayerPlayer = {
  id: string
  name: string
  color: string
  score: number
  isHost?: boolean
  isDrawer?: boolean
  isSolved?: boolean
}

defineProps<{
  players: MultiplayerPlayer[]
  localPeerId: string
  messages: ChatMessage[]
  chatPlaceholder?: string
  chatDisabled?: boolean
}>()

const emit = defineEmits<{
  send: [text: string]
}>()
</script>

<template>
  <aside class="multiplayer-sidebar">
    <div class="multiplayer-sidebar__players">
      <ul class="multiplayer-sidebar__player-list">
        <li
          v-for="player in players"
          :key="player.id"
          class="multiplayer-sidebar__player"
          :class="{
            'multiplayer-sidebar__player--local': player.id === localPeerId,
            'multiplayer-sidebar__player--drawer': player.isDrawer
          }"
        >
          <span class="multiplayer-sidebar__player-dot" :style="{ background: player.color }" />
          <span class="multiplayer-sidebar__player-name">{{ player.name }}</span>
          <span v-if="player.isHost" class="multiplayer-sidebar__player-tag">(Host)</span>
          <span v-if="player.isDrawer" class="multiplayer-sidebar__player-icon" aria-label="Drawing"
            >✏️</span
          >
          <span v-if="player.isSolved" class="multiplayer-sidebar__player-solved">✓</span>
          <span class="multiplayer-sidebar__player-score">{{ player.score }}</span>
        </li>
      </ul>
    </div>
    <div class="multiplayer-sidebar__chat">
      <Chat
        variant="game"
        :messages="messages"
        :local-peer-id="localPeerId"
        :placeholder="chatPlaceholder"
        :disabled="chatDisabled"
        @send="emit('send', $event)"
      />
    </div>
  </aside>
</template>

<style scoped>
.multiplayer-sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  height: 100%;
  padding: var(--spacing-3);
  overflow: hidden;
  box-sizing: border-box;
}

.multiplayer-sidebar__players {
  display: flex;
  flex-direction: column;
  flex-shrink: 1;
  min-height: 0;
  max-height: 40%;
  overflow-y: auto;
}

.multiplayer-sidebar__player-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.multiplayer-sidebar__player {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-2) var(--spacing-3);
  border: 2px solid var(--game-border);
  border-radius: 999px;
  background: var(--game-surface-subtle);
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--game-ink);
  box-shadow: 2px 2px 0 var(--game-border);
}

.multiplayer-sidebar__player--local {
  background: var(--game-surface-dim);
}

.multiplayer-sidebar__player--drawer {
  background: var(--pic-yellow, #ffd93d);
  transform: rotate(-1deg);
}

.multiplayer-sidebar__player-dot {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 50%;
  flex-shrink: 0;
}

.multiplayer-sidebar__player-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.multiplayer-sidebar__player-tag {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--game-ink-muted);
  flex-shrink: 0;
}

.multiplayer-sidebar__player-icon {
  font-size: 1rem;
  line-height: 1;
  flex-shrink: 0;
}

.multiplayer-sidebar__player-solved {
  color: #2e7d32;
  font-weight: 900;
  font-size: var(--font-size-sm);
  flex-shrink: 0;
}

.multiplayer-sidebar__player-score {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  flex-shrink: 0;
}

.multiplayer-sidebar__chat {
  flex: 1;
  min-height: 14rem;
  max-height: 100%;
  display: flex;
  flex-direction: column;
}
</style>
