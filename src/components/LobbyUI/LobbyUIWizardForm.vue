<script setup lang="ts">
import { PLAYER_COLORS } from '@/utils/playerProfile'
import type { LobbyConfigField, LobbyPendingRequest, LobbyPlayer } from '@/types/lobbyWizard'
import LobbyUIRow from './LobbyUIRow.vue'
import LobbyUINameInput from './LobbyUINameInput.vue'
import LobbyUIColorSwatches from './LobbyUIColorSwatches.vue'
import LobbyUIPrivateToggle from './LobbyUIPrivateToggle.vue'
import LobbyUIPlayerList from './LobbyUIPlayerList.vue'
import LobbyUIButton from './LobbyUIButton.vue'
import LobbyUIConfigField from './LobbyUIConfigField.vue'
import LobbyUIWizardMatchmaking from './LobbyUIWizardMatchmaking.vue'

defineProps<{
  playerName: string
  playerColor: string
  isHost: boolean
  playerList: LobbyPlayer[]
  configFields: LobbyConfigField[]
  isPrivate: boolean
  canMatchmake: boolean
  isSearching: boolean
  pendingRequests: LobbyPendingRequest[]
  displayName: (peerId: string) => string
}>()

const emit = defineEmits<{
  'update:playerName': [value: string]
  'update:playerColor': [value: string]
  'update:isPrivate': [value: boolean]
  nameChange: []
  configChange: [key: string, value: string | number]
  accept: [entry: LobbyPendingRequest]
  ignore: [entry: LobbyPendingRequest]
  leaveRoom: []
}>()
</script>

<template>
  <LobbyUIRow label="Name">
    <LobbyUINameInput
      :model-value="playerName"
      :maxlength="20"
      placeholder="Your name"
      @update:model-value="emit('update:playerName', $event)"
      @change="emit('nameChange')"
      @blur="emit('nameChange')"
    />
  </LobbyUIRow>

  <LobbyUIRow label="Color">
    <LobbyUIColorSwatches
      :model-value="playerColor"
      :colors="PLAYER_COLORS"
      @update:model-value="emit('update:playerColor', $event)"
    />
  </LobbyUIRow>

  <slot name="profile-extra" />

  <LobbyUIRow v-for="field in configFields" :key="field.key" :label="field.label">
    <LobbyUIConfigField :field="field" @change="(key, value) => emit('configChange', key, value)" />
  </LobbyUIRow>

  <LobbyUIRow label="Private">
    <LobbyUIPrivateToggle
      :model-value="isPrivate"
      @update:model-value="emit('update:isPrivate', $event)"
    />
  </LobbyUIRow>

  <LobbyUIWizardMatchmaking
    v-if="canMatchmake && !isPrivate"
    :searching="isSearching"
    :requests="pendingRequests"
    :display-name="displayName"
    @accept="emit('accept', $event)"
    @ignore="emit('ignore', $event)"
  />

  <LobbyUIRow v-if="playerList.length > 1" label="Players">
    <LobbyUIPlayerList :players="playerList" :is-host="isHost" />
  </LobbyUIRow>

  <LobbyUIButton
    v-if="!isHost && playerList.length > 1"
    variant="ghost"
    class="lui-wizard-form__leave"
    @click="emit('leaveRoom')"
  >
    Leave room
  </LobbyUIButton>
</template>

<style scoped>
.lui-wizard-form__leave {
  align-self: flex-start;
}
</style>
