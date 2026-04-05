<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import {
  multiplayerClientCreate,
  multiplayerClientDestroy,
  multiplayerClientSendPosition,
  multiplayerClientOnPlayers,
  type MultiplayerClientSession,
  type PlayerState
} from '@webgamekit/multiplayer-client'

const serverUrl = ref('http://localhost:3000')
const session = ref<MultiplayerClientSession | null>(null)
const players = ref<PlayerState[]>([])
const status = ref<'disconnected' | 'connecting' | 'connected'>('disconnected')
const errorMessage = ref('')

let unsubscribePlayers: (() => void) | null = null

const connect = () => {
  status.value = 'connecting'
  errorMessage.value = ''

  const newSession = multiplayerClientCreate(serverUrl.value)
  newSession.socket.on('connect', () => {
    status.value = 'connected'
    session.value = newSession

    unsubscribePlayers = multiplayerClientOnPlayers(newSession, (updatedPlayers) => {
      players.value = updatedPlayers
    })
  })

  newSession.socket.on('connect_error', (error: Error) => {
    status.value = 'disconnected'
    errorMessage.value = `Connection failed: ${error.message}`
    multiplayerClientDestroy(newSession)
  })
}

const disconnect = () => {
  if (!session.value) return
  unsubscribePlayers?.()
  unsubscribePlayers = null
  multiplayerClientDestroy(session.value)
  session.value = null
  players.value = []
  status.value = 'disconnected'
}

const broadcastPosition = () => {
  if (!session.value) return
  const position = {
    x: Number.parseFloat((Math.random() * 10 - 5).toFixed(2)),
    y: 0,
    z: Number.parseFloat((Math.random() * 10 - 5).toFixed(2))
  }
  const rotation = { x: 0, y: Number.parseFloat((Math.random() * Math.PI * 2).toFixed(2)), z: 0 }
  multiplayerClientSendPosition(session.value, position, rotation)
}

onUnmounted(() => {
  if (session.value) disconnect()
})
</script>

<template>
  <div class="multiplayer-client">
    <h1 class="multiplayer-client__title">Multiplayer Client</h1>
    <p class="multiplayer-client__description">
      Demonstrates <code>@webgamekit/multiplayer-client</code> connecting to a Socket.IO server.
    </p>

    <section class="multiplayer-client__connect">
      <input
        v-model="serverUrl"
        class="multiplayer-client__input"
        :disabled="status !== 'disconnected'"
        placeholder="Socket.IO server URL"
        type="text"
      />
      <button
        v-if="status === 'disconnected'"
        class="multiplayer-client__button multiplayer-client__button--primary"
        @click="connect"
      >
        Connect
      </button>
      <button
        v-else
        class="multiplayer-client__button multiplayer-client__button--danger"
        :disabled="status === 'connecting'"
        @click="disconnect"
      >
        {{ status === 'connecting' ? 'Connecting…' : 'Disconnect' }}
      </button>
    </section>

    <p v-if="errorMessage" class="multiplayer-client__error">{{ errorMessage }}</p>

    <section v-if="status === 'connected'" class="multiplayer-client__info">
      <p class="multiplayer-client__socket-id">
        Socket ID: <strong>{{ session?.socket.id }}</strong>
      </p>

      <button
        class="multiplayer-client__button multiplayer-client__button--secondary"
        @click="broadcastPosition"
      >
        Broadcast random position
      </button>

      <div class="multiplayer-client__players">
        <h2 class="multiplayer-client__players-title">Connected players ({{ players.length }})</h2>
        <ul class="multiplayer-client__player-list">
          <li
            v-for="player in players"
            :key="player.id"
            class="multiplayer-client__player"
            :class="{ 'multiplayer-client__player--self': player.id === session?.socket.id }"
          >
            <span class="multiplayer-client__player-id">{{ player.id }}</span>
            <span class="multiplayer-client__player-pos">
              x={{ player.position.x.toFixed(2) }} y={{ player.position.y.toFixed(2) }} z={{
                player.position.z.toFixed(2)
              }}
            </span>
          </li>
        </ul>
        <p v-if="players.length === 0" class="multiplayer-client__empty">No players yet.</p>
      </div>
    </section>

    <section class="multiplayer-client__setup">
      <h2 class="multiplayer-client__setup-title">Server setup</h2>
      <p>Run a Socket.IO server using <code>@webgamekit/multiplayer-server</code>:</p>
      <pre class="multiplayer-client__code">
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { multiplayerServerCreate } from '@webgamekit/multiplayer-server'

const httpServer = createServer()
const io = new Server(httpServer, { cors: { origin: '*' } })
multiplayerServerCreate(io)
httpServer.listen(3000)</pre
      >
    </section>
  </div>
</template>

<style scoped>
.multiplayer-client {
  max-width: 48rem;
  margin: 0 auto;
  padding: var(--spacing-8);
  font-family: inherit;
  color: var(--color-primary);
}

.multiplayer-client__title {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: var(--spacing-2);
}

.multiplayer-client__description {
  color: var(--color-muted-foreground);
  margin-bottom: var(--spacing-6);
}

.multiplayer-client__connect {
  display: flex;
  gap: var(--spacing-3);
  margin-bottom: var(--spacing-4);
}

.multiplayer-client__input {
  flex: 1;
  padding: var(--spacing-2) var(--spacing-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background);
  color: var(--color-primary);
  font-size: 0.875rem;
}

.multiplayer-client__input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.multiplayer-client__button {
  padding: var(--spacing-2) var(--spacing-4);
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  cursor: pointer;
  white-space: nowrap;
}

.multiplayer-client__button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.multiplayer-client__button--primary {
  background: var(--color-primary);
  color: var(--color-primary-foreground);
}

.multiplayer-client__button--secondary {
  background: var(--color-muted);
  color: var(--color-primary);
}

.multiplayer-client__button--danger {
  background: hsl(0 72% 51%);
  color: hsl(0 0% 98%);
}

.multiplayer-client__error {
  color: hsl(0 72% 51%);
  margin-bottom: var(--spacing-4);
  font-size: 0.875rem;
}

.multiplayer-client__info {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-6);
  margin-bottom: var(--spacing-6);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
}

.multiplayer-client__socket-id {
  font-size: 0.875rem;
  color: var(--color-muted-foreground);
}

.multiplayer-client__players-title {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: var(--spacing-2);
}

.multiplayer-client__player-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.multiplayer-client__player {
  display: flex;
  justify-content: space-between;
  padding: var(--spacing-2) var(--spacing-3);
  background: var(--color-muted);
  border-radius: var(--radius-md);
  font-size: 0.8125rem;
  font-family: monospace;
}

.multiplayer-client__player--self {
  border: 1px solid var(--color-primary);
}

.multiplayer-client__player-pos {
  color: var(--color-muted-foreground);
}

.multiplayer-client__empty {
  color: var(--color-muted-foreground);
  font-size: 0.875rem;
}

.multiplayer-client__setup {
  margin-top: var(--spacing-6);
  font-size: 0.875rem;
  color: var(--color-muted-foreground);
}

.multiplayer-client__setup-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-primary);
  margin-bottom: var(--spacing-2);
}

.multiplayer-client__code {
  background: var(--color-muted);
  border-radius: var(--radius-md);
  padding: var(--spacing-4);
  font-size: 0.75rem;
  overflow-x: auto;
  white-space: pre;
  margin-top: var(--spacing-2);
}
</style>
