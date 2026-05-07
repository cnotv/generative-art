<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import {
  p2pIsSupported,
  p2pLobbyJoin,
  type LobbyHandle,
  type MatchRequest
} from '@webgamekit/multiplayer-p2p'
import Button from '@/components/ui/button/Button.vue'
import { Input } from '@/components/ui/input'

const LOBBY_ROOM_ID = 'webgamekit-lobby'
const PEER_ID_LENGTH = 8

const lobbyHandle = ref<LobbyHandle | null>(null)
const localPeerId = ref<string>('')
const localName = ref<string>('')
const peerNames = ref<Map<string, string>>(new Map())
const lobbyPeers = ref<string[]>([])
const incomingRequests = ref<Array<{ request: MatchRequest; fromPeerId: string }>>([])
const sentRequests = ref<Map<string, { requestId: string; gameRoomId: string }>>(new Map())
const matchedSession = ref<{ peerId: string; gameRoomId: string } | null>(null)
const unsupported = ref(false)

const displayName = (peerId: string): string =>
  peerNames.value.get(peerId) || peerId.slice(0, PEER_ID_LENGTH)

const commitName = (): void => {
  lobbyHandle.value?.setName(localName.value.trim())
}

const joinLobby = (): void => {
  if (!p2pIsSupported()) {
    unsupported.value = true
    return
  }

  const handle = p2pLobbyJoin(LOBBY_ROOM_ID, undefined, {
    onPeerJoin: (peerId) => {
      if (!lobbyPeers.value.includes(peerId)) {
        lobbyPeers.value = [...lobbyPeers.value, peerId]
      }
    },
    onPeerLeave: (peerId) => {
      lobbyPeers.value = lobbyPeers.value.filter((id) => id !== peerId)
      incomingRequests.value = incomingRequests.value.filter((r) => r.fromPeerId !== peerId)
      sentRequests.value.delete(peerId)
    },
    onRequest: (request, fromPeerId) => {
      const alreadyPending = incomingRequests.value.some((r) => r.fromPeerId === fromPeerId)
      if (!alreadyPending) {
        incomingRequests.value = [...incomingRequests.value, { request, fromPeerId }]
      }
    },
    onAccepted: (requestId) => {
      const entry = [...sentRequests.value.entries()].find(([, v]) => v.requestId === requestId)
      if (!entry) return
      const [targetPeerId, { gameRoomId }] = entry
      matchedSession.value = { peerId: targetPeerId, gameRoomId }
      sentRequests.value.delete(targetPeerId)
    },
    onIgnored: (requestId) => {
      const entry = [...sentRequests.value.entries()].find(([, v]) => v.requestId === requestId)
      if (entry) sentRequests.value.delete(entry[0])
    },
    onPeerName: (peerId, name) => {
      peerNames.value = new Map(peerNames.value).set(peerId, name)
    }
  })

  localPeerId.value = handle.session.peerId
  lobbyPeers.value = handle.getPeerIds()
  lobbyHandle.value = handle
  if (localName.value.trim()) handle.setName(localName.value.trim())
}

const leaveLobby = (): void => {
  lobbyHandle.value?.stop()
  lobbyHandle.value = null
  localPeerId.value = ''
  lobbyPeers.value = []
  incomingRequests.value = []
  sentRequests.value = new Map()
  peerNames.value = new Map()
  matchedSession.value = null
}

const requestPlayer = (targetPeerId: string): void => {
  if (!lobbyHandle.value || sentRequests.value.has(targetPeerId)) return
  const request = lobbyHandle.value.sendRequest(targetPeerId)
  sentRequests.value = new Map(sentRequests.value).set(targetPeerId, {
    requestId: request.requestId,
    gameRoomId: request.gameRoomId
  })
}

const acceptRequest = (entry: { request: MatchRequest; fromPeerId: string }): void => {
  if (!lobbyHandle.value) return
  lobbyHandle.value.acceptRequest(entry.request, entry.fromPeerId)
  incomingRequests.value = incomingRequests.value.filter(
    (r) => r.request.requestId !== entry.request.requestId
  )
  matchedSession.value = { peerId: entry.fromPeerId, gameRoomId: entry.request.gameRoomId }
}

const ignoreRequest = (entry: { request: MatchRequest; fromPeerId: string }): void => {
  if (!lobbyHandle.value) return
  lobbyHandle.value.ignoreRequest(entry.request, entry.fromPeerId)
  incomingRequests.value = incomingRequests.value.filter(
    (r) => r.request.requestId !== entry.request.requestId
  )
}

const dismissMatch = (): void => {
  matchedSession.value = null
}

onMounted(() => {
  joinLobby()
})

onUnmounted(() => {
  leaveLobby()
})
</script>

<template>
  <div class="matchmaker">
    <header class="matchmaker__header">
      <h1 class="matchmaker__title">Matchmaker</h1>
      <p v-if="unsupported" class="matchmaker__error">
        P2P requires a secure context (HTTPS or localhost).
      </p>
      <p v-else-if="!lobbyHandle" class="matchmaker__subtitle matchmaker__subtitle--searching">
        Connecting<span class="matchmaker__dots" aria-hidden="true"
          ><span>.</span><span>.</span><span>.</span></span
        >
      </p>
      <p
        v-else-if="lobbyPeers.length === 0"
        class="matchmaker__subtitle matchmaker__subtitle--searching"
      >
        You are <strong>{{ localName.trim() || localPeerId.slice(0, PEER_ID_LENGTH) }}</strong> —
        searching<span class="matchmaker__dots" aria-hidden="true"
          ><span>.</span><span>.</span><span>.</span></span
        >
      </p>
      <p v-else class="matchmaker__subtitle">
        You are <strong>{{ localName.trim() || localPeerId.slice(0, PEER_ID_LENGTH) }}</strong> —
        {{ lobbyPeers.length }} player{{ lobbyPeers.length === 1 ? '' : 's' }} online
      </p>
    </header>

    <main v-if="lobbyHandle && !unsupported" class="matchmaker__main">
      <!-- Name setting -->
      <section class="matchmaker__section">
        <h2 class="matchmaker__section-title">Your name</h2>
        <div class="matchmaker__name-row">
          <Input
            v-model="localName"
            class="matchmaker__name-input"
            placeholder="Enter your name…"
            maxlength="24"
            @keydown.enter="commitName"
            @blur="commitName"
          />
        </div>
      </section>
      <!-- Incoming requests -->
      <section v-if="incomingRequests.length" class="matchmaker__section">
        <h2 class="matchmaker__section-title">Requests</h2>
        <ul class="matchmaker__list">
          <li
            v-for="entry in incomingRequests"
            :key="entry.request.requestId"
            class="matchmaker__item matchmaker__item--request"
          >
            <span class="matchmaker__player-id">{{ displayName(entry.fromPeerId) }}</span>
            <span class="matchmaker__player-label">wants to play</span>
            <div class="matchmaker__actions">
              <Button size="sm" @click="acceptRequest(entry)">Accept</Button>
              <Button size="sm" variant="outline" @click="ignoreRequest(entry)">Ignore</Button>
            </div>
          </li>
        </ul>
      </section>

      <!-- Player list -->
      <section class="matchmaker__section">
        <h2 class="matchmaker__section-title">Online players</h2>
        <p v-if="!lobbyPeers.length" class="matchmaker__empty">
          No other players yet. Share this page to invite someone.
        </p>
        <ul v-else class="matchmaker__list">
          <li v-for="peerId in lobbyPeers" :key="peerId" class="matchmaker__item">
            <span class="matchmaker__player-id">{{ displayName(peerId) }}</span>
            <span v-if="sentRequests.has(peerId)" class="matchmaker__player-status">
              Pending…
            </span>
            <Button v-else size="sm" variant="outline" @click="requestPlayer(peerId)">
              Request
            </Button>
          </li>
        </ul>
      </section>

      <Button class="matchmaker__leave-btn" variant="ghost" @click="leaveLobby">
        Leave lobby
      </Button>
    </main>

    <!-- Matched overlay -->
    <div v-if="matchedSession" class="matchmaker__matched-overlay">
      <div class="matchmaker__matched">
        <p class="matchmaker__matched-title">Matched!</p>
        <p class="matchmaker__matched-peer">
          Session with <strong>{{ displayName(matchedSession.peerId) }}</strong>
        </p>
        <p class="matchmaker__matched-room">Room: {{ matchedSession.gameRoomId }}</p>
        <Button class="matchmaker__matched-close" variant="outline" @click="dismissMatch">
          Close
        </Button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.matchmaker {
  position: relative;
  min-height: 100vh;
  padding-top: var(--nav-height);
  display: flex;
  flex-direction: column;
  align-items: center;
  background-color: var(--color-background);
  color: var(--color-foreground);
}

.matchmaker__header {
  width: 100%;
  max-width: 36rem;
  padding: var(--spacing-8) var(--spacing-4) var(--spacing-4);
}

.matchmaker__title {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 var(--spacing-1);
}

.matchmaker__subtitle {
  font-size: 0.875rem;
  color: var(--color-muted-foreground);
  margin: 0;
}

@keyframes matchmaker-bounce {
  0%,
  60%,
  100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  30% {
    transform: translateY(-0.3em);
    opacity: 1;
  }
}

.matchmaker__dots {
  display: inline-flex;
  gap: 0.05em;
}

.matchmaker__dots span {
  display: inline-block;
  animation: matchmaker-bounce 1.2s ease-in-out infinite;
}

.matchmaker__dots span:nth-child(2) {
  animation-delay: 0.2s;
}
.matchmaker__dots span:nth-child(3) {
  animation-delay: 0.4s;
}

.matchmaker__error {
  font-size: 0.875rem;
  color: var(--color-destructive);
  margin: 0;
}

.matchmaker__main {
  width: 100%;
  max-width: 36rem;
  padding: 0 var(--spacing-4) var(--spacing-8);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-6);
}

.matchmaker__section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}

.matchmaker__section-title {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-muted-foreground);
  margin: 0;
}

.matchmaker__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.matchmaker__item {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-3) var(--spacing-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background-color: var(--color-card);
}

.matchmaker__item--request {
  border-color: var(--color-primary);
  background-color: var(--color-card);
}

.matchmaker__player-id {
  font-family: var(--font-mono, monospace);
  font-size: 0.875rem;
  font-weight: 600;
  flex: 1;
}

.matchmaker__player-label {
  font-size: 0.8125rem;
  color: var(--color-muted-foreground);
}

.matchmaker__player-status {
  font-size: 0.8125rem;
  color: var(--color-muted-foreground);
  font-style: italic;
}

.matchmaker__actions {
  display: flex;
  gap: var(--spacing-2);
}

.matchmaker__empty {
  font-size: 0.875rem;
  color: var(--color-muted-foreground);
  margin: 0;
  padding: var(--spacing-4);
  text-align: center;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
}

.matchmaker__name-row {
  display: flex;
  gap: var(--spacing-2);
}

.matchmaker__name-input {
  flex: 1;
  height: 2rem;
  font-size: 0.875rem;
}

.matchmaker__leave-btn {
  align-self: flex-start;
}

.matchmaker__matched-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, var(--overlay-opacity, 0.5));
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-overlay);
}

.matchmaker__matched {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-8);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-3);
  min-width: 20rem;
  text-align: center;
}

.matchmaker__matched-title {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0;
  color: var(--color-primary);
}

.matchmaker__matched-peer {
  font-size: 1rem;
  margin: 0;
}

.matchmaker__matched-room {
  font-size: 0.75rem;
  font-family: var(--font-mono, monospace);
  color: var(--color-muted-foreground);
  margin: 0;
}

.matchmaker__matched-close {
  margin-top: var(--spacing-2);
}
</style>
