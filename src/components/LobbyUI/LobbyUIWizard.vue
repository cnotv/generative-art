<script setup lang="ts">
import { ref, computed, watch, onMounted, inject, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useGameLobby } from '@/composables/useGameLobby'
import { useControlsMapperStore } from '@/stores/controlsMapper'
import type { LobbyConfigField, LobbyPendingRequest, LobbyPlayer } from '@/types/lobbyWizard'
import type { ControlsMapperGameConfig } from '@/components/ControlsMapper/types'
import ControlsMapperConfig from '@/components/ControlsMapper/ControlsMapperConfig.vue'
import '@/assets/styles/lobby-ui.scss'
import LobbyUIButton from './LobbyUIButton.vue'
import LobbyUIOptionToggle from './LobbyUIOptionToggle.vue'
import LobbyUIFocusHint from './LobbyUIFocusHint.vue'
import LobbyUIWizardForm from './LobbyUIWizardForm.vue'
import { useLobbyWizardFocus } from './useLobbyWizardFocus'

const props = withDefaults(
  defineProps<{
    playerName: string
    playerColor: string
    isHost: boolean
    playerList: LobbyPlayer[]
    roomId: string
    matchmakerRoom: string
    configFields: LobbyConfigField[]
    controls?: ControlsMapperGameConfig
    showResults?: boolean
    canStart?: boolean
  }>(),
  { canStart: true }
)

const emit = defineEmits<{
  'update:playerName': [value: string]
  'update:playerColor': [value: string]
  nameChange: []
  configChange: [key: string, value: string | number]
  startGame: []
  matchFound: [roomId: string]
  leaveRoom: []
  playAgain: []
}>()

const mapperStore = props.controls
  ? useControlsMapperStore(props.controls.gameId, props.controls.defaultMapping)
  : null

type WizardTab = 'game' | 'controls'
const wizardTab = ref<WizardTab>('game')
const WIZARD_TAB_OPTIONS = [
  { value: 'game', label: 'Game' },
  { value: 'controls', label: 'Controls' }
]
const setWizardTab = (value: string) => {
  wizardTab.value = value as WizardTab
}

const route = useRoute()
const fromLobby = computed(() => !!route.query.game)

const isPrivate = ref(false)

const {
  isSearching,
  pendingRequests,
  startSearching,
  stopSearching,
  acceptRequest,
  ignoreRequest,
  displayName
} = useGameLobby({
  matchmakerRoom: props.matchmakerRoom,
  getRoomId: () => props.roomId,
  getPlayerName: () => props.playerName,
  onMatchAccepted: () => emit('matchFound', props.roomId)
})

const handleAccept = (entry: LobbyPendingRequest): void => {
  const gameRoomId = acceptRequest(entry)
  if (gameRoomId) emit('matchFound', gameRoomId)
}

const setRoomHidden = inject<((hidden: boolean) => void) | undefined>('setRoomHidden', undefined)

watch(isPrivate, (priv) => {
  setRoomHidden?.(priv)
  if (priv) stopSearching()
  else if (!fromLobby.value) startSearching()
})

watch(
  () => props.isHost,
  (isHost) => {
    if (!isHost) stopSearching()
  }
)

const wizardRoot = ref<HTMLElement | null>(null)
const MOUNT_DEBOUNCE_MS = 150
const readyForInput = ref(false)

// Ignore wizard navigation while a controls-binding capture is listening for input.
const isWizardInputBlocked = (): boolean => !readyForInput.value || mapperStore?.capturing === true

const { focusedHint, inputSource, jumpToAutofocus } = useLobbyWizardFocus(
  wizardRoot,
  isWizardInputBlocked
)

onMounted(() => {
  if (!props.showResults && !fromLobby.value && !isPrivate.value) startSearching()
  nextTick(() => jumpToAutofocus())
  setTimeout(() => {
    readyForInput.value = true
  }, MOUNT_DEBOUNCE_MS)
})
</script>

<template>
  <LobbyUIFocusHint :hint="focusedHint" :visible="inputSource === 'gamepad'" />

  <section ref="wizardRoot" class="lui-wizard">
    <div v-if="!showResults" class="lui-wizard__body">
      <div v-if="controls" class="lui-wizard__tabs" data-lui-row>
        <LobbyUIOptionToggle
          :model-value="wizardTab"
          :options="WIZARD_TAB_OPTIONS"
          @update:model-value="setWizardTab"
        />
      </div>

      <ControlsMapperConfig
        v-if="controls && wizardTab === 'controls'"
        :game-id="controls.gameId"
        :actions="controls.actions"
        :default-mapping="controls.defaultMapping"
      />

      <LobbyUIWizardForm
        v-else
        :player-name="playerName"
        :player-color="playerColor"
        :is-host="isHost"
        :player-list="playerList"
        :config-fields="configFields"
        :is-private="isPrivate"
        :can-matchmake="!fromLobby"
        :is-searching="isSearching"
        :pending-requests="pendingRequests"
        :display-name="displayName"
        @update:player-name="emit('update:playerName', $event)"
        @update:player-color="emit('update:playerColor', $event)"
        @update:is-private="isPrivate = $event"
        @name-change="emit('nameChange')"
        @config-change="(key, value) => emit('configChange', key, value)"
        @accept="handleAccept"
        @ignore="ignoreRequest"
        @leave-room="emit('leaveRoom')"
      >
        <template #profile-extra>
          <slot name="profile-extra" />
        </template>
      </LobbyUIWizardForm>

      <div class="lui-wizard__nav" data-lui-row>
        <LobbyUIButton
          v-if="isHost"
          variant="cta"
          :autofocus="true"
          :disabled="props.canStart === false"
          @click="emit('startGame')"
        >
          Start
        </LobbyUIButton>
      </div>
    </div>

    <div v-else class="lui-wizard__results">
      <slot name="summary" />
      <div class="lui-wizard__nav lui-wizard__nav--results" data-lui-row>
        <LobbyUIButton variant="ghost" @click="emit('leaveRoom')">← Leave</LobbyUIButton>
        <LobbyUIButton variant="cta" @click="emit('playAgain')">Play Again</LobbyUIButton>
      </div>
    </div>
  </section>
</template>

<style scoped>
.lui-wizard {
  grid-area: main;
  display: flex;
  flex-direction: column;
  align-items: stretch;

  /* Fixed width so the wizard does not resize when switching tabs. */
  width: min(36rem, 100%);
  max-width: 100%;
}

.lui-wizard__body,
.lui-wizard__results {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  width: 100%;
  max-width: 36rem;
  margin: 0 auto;
  padding: var(--spacing-4);
  box-sizing: border-box;
}

.lui-wizard__tabs {
  display: flex;
  gap: var(--spacing-2);
}

.lui-wizard__nav {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--spacing-2);
  padding-top: var(--spacing-3);
}

.lui-wizard__nav--results {
  justify-content: space-between;
}

@media (width <= 720px) {
  .lui-wizard__body,
  .lui-wizard__results {
    padding: var(--spacing-3);
  }
}
</style>
