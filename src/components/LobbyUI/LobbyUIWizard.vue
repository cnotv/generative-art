<script setup lang="ts">
import { ref, computed, watch, onMounted, inject, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useGameLobby } from '@/composables/useGameLobby'
import { useMenuNavigation, type MenuAction } from '@/composables/useMenuNavigation'
import { useGamepadHint } from '@/composables/useGamepadHint'
import { PLAYER_COLORS } from '@/utils/playerProfile'
import type { LobbyConfigField, LobbyPlayer } from '@/types/lobbyWizard'
import '@/assets/styles/lobby-ui.scss'
import LobbyUIRow from './LobbyUIRow.vue'
import LobbyUINameInput from './LobbyUINameInput.vue'
import LobbyUIColorSwatches from './LobbyUIColorSwatches.vue'
import LobbyUIPrivateToggle from './LobbyUIPrivateToggle.vue'
import LobbyUIPlayerList from './LobbyUIPlayerList.vue'
import LobbyUIButton from './LobbyUIButton.vue'
import LobbyUIConfigField from './LobbyUIConfigField.vue'

const props = withDefaults(
  defineProps<{
    playerName: string
    playerColor: string
    isHost: boolean
    playerList: LobbyPlayer[]
    roomId: string
    matchmakerRoom: string
    configFields: LobbyConfigField[]
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

const handleAccept = (entry: Parameters<typeof acceptRequest>[0]): void => {
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

onMounted(() => {
  if (!props.showResults && !fromLobby.value && !isPrivate.value) startSearching()
  nextTick(() => jumpToAutofocus())
})

const wizardRoot = ref<HTMLElement | null>(null)
const focusRow = ref(0)
const focusCol = ref(0)
const editingElement = ref<HTMLElement | null>(null)

const HINT_GAP_PX = 12
const { focusedHint, inputSource, updateFocusedHint, onInputSource } =
  useGamepadHint(editingElement)

const FOCUSABLE_SELECTOR =
  'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)'

const isTextInput = (element: Element | null): boolean =>
  element instanceof HTMLInputElement &&
  new Set(['text', 'number', 'email', 'password']).has(element.type)

const isNumberInput = (element: Element | null): element is HTMLInputElement =>
  element instanceof HTMLInputElement && element.type === 'number'

const isSelectElement = (element: Element | null): element is HTMLSelectElement =>
  element instanceof HTMLSelectElement

const queryRows = (): HTMLElement[] => {
  if (!wizardRoot.value) return []
  return [...wizardRoot.value.querySelectorAll<HTMLElement>('[data-lui-row]')].filter(
    (row) => row.querySelectorAll(FOCUSABLE_SELECTOR).length > 0
  )
}

const queryFocusables = (row: HTMLElement): HTMLElement[] => [
  ...row.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
]

const applyFocus = (): void => {
  const rows = queryRows()
  const row = rows[focusRow.value]
  if (!row) return
  const items = queryFocusables(row)
  const target = items[Math.min(focusCol.value, items.length - 1)]
  target?.focus()
  updateFocusedHint(target ?? null)
}

const jumpToAutofocus = (): void => {
  if (!wizardRoot.value) return
  const autofocused = wizardRoot.value.querySelector<HTMLElement>('[autofocus]')
  if (!autofocused) return
  const rows = queryRows()
  const rowIndex = rows.findIndex((row) => row.contains(autofocused))
  if (rowIndex === -1) return
  focusRow.value = rowIndex
  const items = queryFocusables(rows[rowIndex])
  focusCol.value = items.indexOf(autofocused)
  autofocused.focus()
}

const bumpControl = (element: HTMLElement, direction: 1 | -1): void => {
  if (isNumberInput(element)) {
    if (direction === 1) element.stepUp()
    else element.stepDown()
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
  } else if (isSelectElement(element)) {
    const next = Math.max(
      0,
      Math.min(element.options.length - 1, element.selectedIndex + direction)
    )
    if (next !== element.selectedIndex) {
      element.selectedIndex = next
      element.dispatchEvent(new Event('change', { bubbles: true }))
    }
  }
}

const handleCyclableControl = (
  active: HTMLElement,
  action: MenuAction,
  rowCount: number
): boolean => {
  const isEditing = editingElement.value === active

  if (!isEditing) {
    if (action === 'activate') {
      editingElement.value = active
      updateFocusedHint(active)
      return true
    }
    return false
  }

  if (action === 'up' || action === 'down') {
    bumpControl(active, action === 'up' ? 1 : -1)
    return true
  }
  if (action === 'activate') {
    editingElement.value = null
    focusRow.value = Math.min(rowCount - 1, focusRow.value + 1)
    focusCol.value = 0
    applyFocus()
    return true
  }
  return false
}

const handleRowNavClearEdit = (): void => {
  editingElement.value = null
}

const handleRowNav = (action: MenuAction, rows: HTMLElement[], active: Element | null): void => {
  const handlers: Partial<Record<MenuAction, () => void>> = {
    up: () => {
      handleRowNavClearEdit()
      focusRow.value = Math.max(0, focusRow.value - 1)
      focusCol.value = 0
      applyFocus()
    },
    down: () => {
      editingElement.value = null
      focusRow.value = Math.min(rows.length - 1, focusRow.value + 1)
      focusCol.value = 0
      applyFocus()
    },
    left: () => {
      if (!rows[focusRow.value]) return
      focusCol.value = Math.max(0, focusCol.value - 1)
      applyFocus()
    },
    right: () => {
      const row = rows[focusRow.value]
      if (!row) return
      focusCol.value = Math.min(queryFocusables(row).length - 1, focusCol.value + 1)
      applyFocus()
    },
    activate: () => {
      if (active instanceof HTMLElement && !isTextInput(active)) active.click()
    },
    cancel: () => (active as HTMLElement | null)?.blur?.()
  }
  handlers[action]?.()
}

const handleWizardAction = (
  action: MenuAction,
  source: Parameters<typeof onInputSource>[0]
): void => {
  onInputSource(source)
  const rows = queryRows()
  if (!rows.length) return
  const active = document.activeElement
  if (isTextInput(active) && (action === 'left' || action === 'right')) return
  if (
    active instanceof HTMLElement &&
    (isNumberInput(active) || isSelectElement(active)) &&
    handleCyclableControl(active, action, rows.length)
  )
    return
  handleRowNav(action, rows, active)
}

useMenuNavigation(handleWizardAction)
</script>

<template>
  <teleport to="body">
    <div
      v-if="focusedHint && inputSource === 'gamepad'"
      class="lui-wizard__hint"
      aria-hidden="true"
      :style="{
        top: `${focusedHint.rect.top + focusedHint.rect.height / 2}px`,
        left: `${focusedHint.rect.left + focusedHint.rect.width + HINT_GAP_PX}px`
      }"
    >
      <span v-for="part in focusedHint.parts" :key="part.glyph" class="lui-wizard__hint-part">
        <span class="lui-wizard__hint-glyph">{{ part.glyph }}</span>
        {{ part.label }}
      </span>
    </div>
  </teleport>

  <section ref="wizardRoot" class="lui-wizard">
    <div v-if="!showResults" class="lui-wizard__body">
      <h2 class="lui-wizard__title">Profile</h2>

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
        <LobbyUIConfigField
          :field="field"
          @change="(key, value) => emit('configChange', key, value)"
        />
      </LobbyUIRow>

      <LobbyUIRow label="Private">
        <LobbyUIPrivateToggle v-model="isPrivate" />
      </LobbyUIRow>

      <template v-if="!fromLobby && !isPrivate">
        <div v-if="isSearching" class="lui-wizard__searching">
          Looking for players
          <span class="lui-wizard__dots" aria-hidden="true"
            ><span>.</span><span>.</span><span>.</span></span
          >
        </div>
        <ul v-if="pendingRequests.length" class="lui-wizard__requests">
          <li
            v-for="entry in pendingRequests"
            :key="entry.request.requestId"
            class="lui-wizard__request"
          >
            <span class="lui-wizard__request-name">
              {{ displayName(entry.fromPeerId) }} wants to play
            </span>
            <div class="lui-wizard__request-actions">
              <LobbyUIButton @click="handleAccept(entry)">Join</LobbyUIButton>
              <LobbyUIButton variant="ghost" @click="ignoreRequest(entry)">Ignore</LobbyUIButton>
            </div>
          </li>
        </ul>
      </template>

      <LobbyUIRow v-if="playerList.length > 1" label="Players">
        <LobbyUIPlayerList :players="playerList" :is-host="isHost" />
      </LobbyUIRow>

      <LobbyUIButton
        v-if="!isHost && playerList.length > 1"
        variant="ghost"
        class="lui-wizard__leave"
        @click="emit('leaveRoom')"
      >
        Leave room
      </LobbyUIButton>

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
  min-width: min(360px, 100%);
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

.lui-wizard__title {
  margin: 0;
  font-family: var(--lui-font);
  font-weight: 900;
  font-size: var(--lui-text-important);
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  text-align: left;
  line-height: 1;
}

.lui-wizard__searching,
.lui-wizard__request-name {
  font-family: var(--lui-font);
  font-weight: 900;
  font-size: var(--lui-text-medium);
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
}

.lui-wizard__searching {
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

.lui-wizard__dots span {
  display: inline-block;
  animation: lui-bounce 1.2s ease-in-out infinite;
}

.lui-wizard__dots span:nth-child(2) {
  animation-delay: 0.2s;
}

.lui-wizard__dots span:nth-child(3) {
  animation-delay: 0.4s;
}

.lui-wizard__requests {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.lui-wizard__request {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

.lui-wizard__request-name {
  flex: 1;
  text-align: left;
}

.lui-wizard__request-actions {
  display: flex;
  gap: var(--spacing-1);
}

.lui-wizard__leave {
  align-self: flex-start;
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

<style>
/* Teleported hint chip — outside scoped because it renders in <body> */
.lui-wizard__hint {
  position: fixed;
  z-index: 9999;
  transform: translateY(-50%);
  pointer-events: none;
  font-family: var(--lui-font);
  font-size: var(--lui-text-small);
  line-height: 1;
  color: #000;
  background: var(--lui-focus-color, #ffd700);
  padding-inline: 0.7em;
  padding-block: 0.4em;
  border-radius: 999px;
  letter-spacing: 0.04em;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 0.9em;
}

.lui-wizard__hint-part {
  display: inline-flex;
  align-items: center;
  gap: 0.25em;
}

.lui-wizard__hint-glyph {
  font-weight: 900;
}
</style>
