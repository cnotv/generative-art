<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import {
  p2pJoin,
  p2pLeave,
  p2pSendPosition,
  p2pOnPlayers,
  p2pOnPeerJoin,
  p2pOnPeerLeave,
  type P2PSession,
  type PlayerState
} from '@webgamekit/multiplayer-p2p'

type PeerEntry = {
  id: string
  position: PlayerState['position'] | null
  rotation: PlayerState['rotation'] | null
}

const roomId = ref('demo-room')
const session = ref<P2PSession | null>(null)
const peers = ref<PeerEntry[]>([])
const isJoined = ref(false)

const join = () => {
  const newSession = p2pJoin(roomId.value)
  session.value = newSession
  isJoined.value = true

  p2pOnPeerJoin(newSession, (peerId) => {
    if (!peers.value.some((peer) => peer.id === peerId)) {
      peers.value = [...peers.value, { id: peerId, position: null, rotation: null }]
    }
  })

  p2pOnPeerLeave(newSession, (peerId) => {
    peers.value = peers.value.filter((peer) => peer.id !== peerId)
  })

  p2pOnPlayers(newSession, (playerState) => {
    peers.value = peers.value.some((peer) => peer.id === playerState.id)
      ? peers.value.map((peer) =>
          peer.id === playerState.id
            ? { ...peer, position: playerState.position, rotation: playerState.rotation }
            : peer
        )
      : [
          ...peers.value,
          { id: playerState.id, position: playerState.position, rotation: playerState.rotation }
        ]
  })
}

const leave = () => {
  if (!session.value) return
  p2pLeave(session.value)
  session.value = null
  peers.value = []
  isJoined.value = false
}

const broadcastPosition = () => {
  if (!session.value) return
  const position = {
    x: Number.parseFloat((Math.random() * 10 - 5).toFixed(2)),
    y: 0,
    z: Number.parseFloat((Math.random() * 10 - 5).toFixed(2))
  }
  const rotation = { x: 0, y: Number.parseFloat((Math.random() * Math.PI * 2).toFixed(2)), z: 0 }
  p2pSendPosition(session.value, position, rotation)
}

onUnmounted(() => {
  if (session.value) leave()
})
</script>

<template>
  <div class="multiplayer-p2p">
    <h1 class="multiplayer-p2p__title">Multiplayer P2P</h1>
    <p class="multiplayer-p2p__description">
      Demonstrates <code>@webgamekit/multiplayer-p2p</code> using WebRTC via Trystero (NOSTR
      signaling — no server required). Open this page in multiple browser tabs with the same room ID
      to connect peers.
    </p>

    <section class="multiplayer-p2p__join">
      <input
        v-model="roomId"
        class="multiplayer-p2p__input"
        :disabled="isJoined"
        placeholder="Room ID"
        type="text"
      />
      <button
        v-if="!isJoined"
        class="multiplayer-p2p__button multiplayer-p2p__button--primary"
        @click="join"
      >
        Join room
      </button>
      <button v-else class="multiplayer-p2p__button multiplayer-p2p__button--danger" @click="leave">
        Leave room
      </button>
    </section>

    <section v-if="isJoined" class="multiplayer-p2p__info">
      <p class="multiplayer-p2p__peer-id">
        Room: <strong>{{ roomId }}</strong>
      </p>

      <button
        class="multiplayer-p2p__button multiplayer-p2p__button--secondary"
        @click="broadcastPosition"
      >
        Broadcast random position
      </button>

      <div class="multiplayer-p2p__peers">
        <h2 class="multiplayer-p2p__peers-title">Remote peers ({{ peers.length }})</h2>
        <ul class="multiplayer-p2p__peer-list">
          <li v-for="peer in peers" :key="peer.id" class="multiplayer-p2p__peer">
            <span class="multiplayer-p2p__peer-id-label">{{ peer.id }}</span>
            <span v-if="peer.position" class="multiplayer-p2p__peer-pos">
              x={{ peer.position.x.toFixed(2) }} y={{ peer.position.y.toFixed(2) }} z={{
                peer.position.z.toFixed(2)
              }}
            </span>
            <span v-else class="multiplayer-p2p__peer-pos">waiting for position…</span>
          </li>
        </ul>
        <p v-if="peers.length === 0" class="multiplayer-p2p__empty">
          No peers yet — open another tab with the same room ID.
        </p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.multiplayer-p2p {
  max-width: 48rem;
  margin: 0 auto;
  padding: var(--spacing-8);
  color: var(--color-primary);
}

.multiplayer-p2p__title {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: var(--spacing-2);
}

.multiplayer-p2p__description {
  color: var(--color-muted-foreground);
  margin-bottom: var(--spacing-6);
}

.multiplayer-p2p__join {
  display: flex;
  gap: var(--spacing-3);
  margin-bottom: var(--spacing-4);
}

.multiplayer-p2p__input {
  flex: 1;
  padding: var(--spacing-2) var(--spacing-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background);
  color: var(--color-primary);
  font-size: 0.875rem;
}

.multiplayer-p2p__input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.multiplayer-p2p__button {
  padding: var(--spacing-2) var(--spacing-4);
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  cursor: pointer;
  white-space: nowrap;
}

.multiplayer-p2p__button--primary {
  background: var(--color-primary);
  color: var(--color-primary-foreground);
}

.multiplayer-p2p__button--secondary {
  background: var(--color-muted);
  color: var(--color-primary);
}

.multiplayer-p2p__button--danger {
  background: hsl(0 72% 51%);
  color: hsl(0 0% 98%);
}

.multiplayer-p2p__info {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-6);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
}

.multiplayer-p2p__peer-id {
  font-size: 0.875rem;
  color: var(--color-muted-foreground);
}

.multiplayer-p2p__peers-title {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: var(--spacing-2);
}

.multiplayer-p2p__peer-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.multiplayer-p2p__peer {
  display: flex;
  justify-content: space-between;
  padding: var(--spacing-2) var(--spacing-3);
  background: var(--color-muted);
  border-radius: var(--radius-md);
  font-size: 0.8125rem;
  font-family: monospace;
}

.multiplayer-p2p__peer-pos {
  color: var(--color-muted-foreground);
}

.multiplayer-p2p__empty {
  color: var(--color-muted-foreground);
  font-size: 0.875rem;
}
</style>
