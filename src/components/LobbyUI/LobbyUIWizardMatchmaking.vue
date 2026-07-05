<script setup lang="ts">
import type { LobbyPendingRequest } from '@/types/lobbyWizard'
import LobbyUIButton from './LobbyUIButton.vue'

defineProps<{
  searching: boolean
  requests: LobbyPendingRequest[]
  displayName: (peerId: string) => string
}>()

const emit = defineEmits<{
  accept: [entry: LobbyPendingRequest]
  ignore: [entry: LobbyPendingRequest]
}>()
</script>

<template>
  <div v-if="searching" class="lui-matchmaking__searching">
    Looking for players
    <span class="lui-matchmaking__dots" aria-hidden="true"
      ><span>.</span><span>.</span><span>.</span></span
    >
  </div>
  <ul v-if="requests.length" class="lui-matchmaking__requests">
    <li v-for="entry in requests" :key="entry.request.requestId" class="lui-matchmaking__request">
      <span class="lui-matchmaking__request-name">
        {{ displayName(entry.fromPeerId) }} wants to play
      </span>
      <div class="lui-matchmaking__request-actions">
        <LobbyUIButton @click="emit('accept', entry)">Join</LobbyUIButton>
        <LobbyUIButton variant="ghost" @click="emit('ignore', entry)">Ignore</LobbyUIButton>
      </div>
    </li>
  </ul>
</template>

<style scoped>
.lui-matchmaking__searching,
.lui-matchmaking__request-name {
  font-family: var(--lui-font);
  font-weight: 900;
  font-size: var(--lui-text-medium);
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
}

.lui-matchmaking__searching {
  display: flex;
  align-items: baseline;
  gap: 0.1em;
}

@keyframes lui-bounce {
  0%,
  60%,
  100% {
    transform: translateY(0);
    opacity: 0.4;
  }

  30% {
    transform: translateY(-0.35em);
    opacity: 1;
  }
}

.lui-matchmaking__dots span {
  display: inline-block;
  animation: lui-bounce 1.2s ease-in-out infinite;
}

.lui-matchmaking__dots span:nth-child(2) {
  animation-delay: 0.2s;
}

.lui-matchmaking__dots span:nth-child(3) {
  animation-delay: 0.4s;
}

.lui-matchmaking__requests {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.lui-matchmaking__request {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

.lui-matchmaking__request-name {
  flex: 1;
  text-align: left;
}

.lui-matchmaking__request-actions {
  display: flex;
  gap: var(--spacing-1);
}
</style>
