<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import '@/assets/styles/lobby-ui.scss'
import {
  LobbyUIRow,
  LobbyUINameInput,
  LobbyUIColorSwatches,
  LobbyUIOptionToggle,
  LobbyUIImageGrid,
  LobbyUIPrivateToggle,
  LobbyUIPlayerList,
  LobbyUIButton,
  LobbyUIConfigField
} from '@/components/LobbyUI'
import { PLAYER_COLORS } from '@/utils/playerProfile'
import { MARBLE_OPTIONS } from '@/views/Games/MarbleMadness/config'
import { loadGoogleFont, removeGoogleFont } from '@/utils/ui'
import {
  useMenuNavigation,
  type MenuAction,
  type MenuSource
} from '@/composables/useMenuNavigation'
import type { LobbyConfigField, LobbyPlayer } from '@/types/lobbyWizard'

type Screen = 'lobby' | 'results'

const FONT_KEY = 'lobby-ui-showcase-font'

onMounted(() => {
  loadGoogleFont('https://fonts.googleapis.com/css2?family=Darumadrop+One&display=swap', FONT_KEY)
})

onUnmounted(() => {
  removeGoogleFont(FONT_KEY)
})

const screen = ref<Screen>('lobby')
const panelReference = ref<HTMLElement | null>(null)
const focusRow = ref(0)
const focusCol = ref(0)

const TEXT_INPUT_TYPES = new Set(['text', 'number', 'email', 'password', 'search', 'tel', 'url'])
const FOCUSABLE_SELECTOR =
  'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)'

const queryRows = (): HTMLElement[] => {
  if (!panelReference.value) return []
  return [...panelReference.value.querySelectorAll<HTMLElement>('[data-lui-row]')].filter(
    (row) => row.querySelectorAll(FOCUSABLE_SELECTOR).length > 0
  )
}

const queryFocusables = (row: HTMLElement): HTMLElement[] => [
  ...row.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
]

type HintRect = { top: number; left: number; width: number; height: number }
type HintPart = { glyph: string; label: string }

const focusedHint = ref<{ rect: HintRect; parts: HintPart[] } | null>(null)
type LocalInputSource = MenuSource | 'mouse'
const inputSource = ref<LocalInputSource | null>(null)
const editingElement = ref<HTMLElement | null>(null)

const HINT_GAP_PX = 12

const describeControl = (element: HTMLElement): HintPart[] => {
  const hasUpDownBehavior =
    (element instanceof HTMLInputElement && element.type === 'number') ||
    element instanceof HTMLSelectElement
  if (hasUpDownBehavior) {
    return editingElement.value === element
      ? [{ glyph: '✕', label: 'Confirm' }]
      : [{ glyph: '↕', label: 'Change' }]
  }
  if (element instanceof HTMLInputElement) {
    if (element.type === 'checkbox') return [{ glyph: '✕', label: 'Toggle' }]
    return [{ glyph: '✕', label: 'Edit' }]
  }
  return [{ glyph: '✕', label: 'Confirm' }]
}

const updateFocusedHint = (element: HTMLElement | null): void => {
  if (!element) {
    focusedHint.value = null
    return
  }
  const r = element.getBoundingClientRect()
  focusedHint.value = {
    rect: { top: r.top, left: r.left, width: r.width, height: r.height },
    parts: describeControl(element)
  }
}

const applyFocus = (): void => {
  const rows = queryRows()
  const row = rows[focusRow.value]
  if (!row) {
    updateFocusedHint(null)
    return
  }
  const focusables = queryFocusables(row)
  const target = focusables[Math.min(focusCol.value, focusables.length - 1)]
  target?.focus()
  updateFocusedHint(target ?? null)
}

const isTextInput = (element: Element | null): boolean =>
  element instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(element.type)

const isNumberInput = (element: Element | null): element is HTMLInputElement =>
  element instanceof HTMLInputElement && element.type === 'number'

const isSelect = (element: Element | null): element is HTMLSelectElement =>
  element instanceof HTMLSelectElement

const bumpNumberInput = (input: HTMLInputElement, direction: 1 | -1): void => {
  if (direction === 1) input.stepUp()
  else input.stepDown()
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

const cycleSelect = (select: HTMLSelectElement, direction: 1 | -1): void => {
  const next = Math.max(0, Math.min(select.options.length - 1, select.selectedIndex + direction))
  if (next === select.selectedIndex) return
  select.selectedIndex = next
  select.dispatchEvent(new Event('change', { bubbles: true }))
}

const moveRow = (delta: number, rowCount: number): void => {
  editingElement.value = null
  focusRow.value = Math.min(Math.max(focusRow.value + delta, 0), rowCount - 1)
  focusCol.value = 0
  applyFocus()
}

const moveCol = (delta: number, row: HTMLElement | undefined): void => {
  if (!row) return
  const focusables = queryFocusables(row)
  focusCol.value = Math.min(Math.max(focusCol.value + delta, 0), focusables.length - 1)
  applyFocus()
}

const activate = (active: Element | null): void => {
  if (isTextInput(active)) return
  if (active instanceof HTMLElement) active.click()
}

const lastAction = ref<MenuAction | '—'>('—')
const lastActionCount = ref(0)
const gamepadStatus = ref<string>('not connected')
const rowCount = ref(0)
const colCount = ref(0)
const activeTag = ref<string>('—')

const refreshDiagnostics = (): void => {
  const rows = queryRows()
  rowCount.value = rows.length
  const row = rows[focusRow.value]
  colCount.value = row ? queryFocusables(row).length : 0
  const active = document.activeElement
  if (active instanceof HTMLElement) {
    activeTag.value = `${active.tagName.toLowerCase()}.${active.className.split(' ')[0] || '?'}`
  } else {
    activeTag.value = '—'
  }
}

const refreshHint = (element: HTMLElement): void => {
  const r = element.getBoundingClientRect()
  focusedHint.value = {
    rect: { top: r.top, left: r.left, width: r.width, height: r.height },
    parts: describeControl(element)
  }
}

const handleNumberAction = (
  input: HTMLInputElement,
  action: MenuAction,
  rowCount: number
): boolean => {
  if (action === 'activate') {
    if (editingElement.value !== input) {
      editingElement.value = input
      refreshHint(input)
      return true
    }
    editingElement.value = null
    moveRow(1, rowCount)
    return true
  }
  if ((action === 'up' || action === 'down') && editingElement.value === input) {
    bumpNumberInput(input, action === 'up' ? 1 : -1)
    return true
  }
  return false
}

const handleSelectAction = (
  select: HTMLSelectElement,
  action: MenuAction,
  rowCount: number
): boolean => {
  if (action === 'activate') {
    if (editingElement.value !== select) {
      editingElement.value = select
      refreshHint(select)
      return true
    }
    editingElement.value = null
    moveRow(1, rowCount)
    return true
  }
  if ((action === 'up' || action === 'down') && editingElement.value === select) {
    cycleSelect(select, action === 'down' ? 1 : -1)
    return true
  }
  return false
}

/**
 * Returns true if the action was consumed by control-specific handling and the
 * row/col navigation should be skipped.
 */
const handleControlAction = (
  active: Element | null,
  action: MenuAction,
  rowCount: number
): boolean => {
  if (isTextInput(active) && (action === 'left' || action === 'right')) return true
  if (isNumberInput(active)) return handleNumberAction(active, action, rowCount)
  if (isSelect(active)) return handleSelectAction(active, action, rowCount)
  return false
}

const handleMenu = (action: MenuAction, source: MenuSource): void => {
  inputSource.value = source
  lastAction.value = action
  lastActionCount.value += 1
  const active = document.activeElement
  const rows = queryRows()
  if (!rows.length || handleControlAction(active, action, rows.length)) {
    refreshDiagnostics()
    return
  }

  const handlers: Record<MenuAction, () => void> = {
    up: () => moveRow(-1, rows.length),
    down: () => moveRow(1, rows.length),
    left: () => moveCol(-1, rows[focusRow.value]),
    right: () => moveCol(1, rows[focusRow.value]),
    activate: () => activate(active),
    decrease: () => undefined,
    cancel: () => (active as HTMLElement | null)?.blur?.()
  }
  handlers[action]()
  refreshDiagnostics()
}

const onGamepadConnected = (event: Event): void => {
  const gp = (event as GamepadEvent).gamepad
  gamepadStatus.value = `${gp.id} (idx ${gp.index})`
}

const onGamepadDisconnected = (): void => {
  gamepadStatus.value = 'disconnected'
}

const onWindowBlur = (): void => {
  focusedHint.value = null
  editingElement.value = null
}

const onFocusOut = (event: FocusEvent): void => {
  if (event.relatedTarget instanceof Element && panelReference.value?.contains(event.relatedTarget))
    return
  focusedHint.value = null
  editingElement.value = null
}

const onWindowFocus = (): void => {
  const active = document.activeElement
  if (active instanceof HTMLElement) updateFocusedHint(active)
}

const onMouseActivity = (): void => {
  inputSource.value = 'mouse'
}

onMounted(() => {
  window.addEventListener('gamepadconnected', onGamepadConnected)
  window.addEventListener('gamepaddisconnected', onGamepadDisconnected)
  window.addEventListener('blur', onWindowBlur)
  window.addEventListener('focus', onWindowFocus)
  window.addEventListener('mousedown', onMouseActivity)
  window.addEventListener('mousemove', onMouseActivity, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('gamepadconnected', onGamepadConnected)
  window.removeEventListener('gamepaddisconnected', onGamepadDisconnected)
  window.removeEventListener('blur', onWindowBlur)
  window.removeEventListener('focus', onWindowFocus)
  window.removeEventListener('mousedown', onMouseActivity)
  window.removeEventListener('mousemove', onMouseActivity)
})

useMenuNavigation(handleMenu)

const focusFirst = async (): Promise<void> => {
  focusRow.value = 0
  focusCol.value = 0
  await nextTick()
  applyFocus()
  refreshDiagnostics()
}

onMounted(focusFirst)
watch(screen, focusFirst)
const playerName = ref('Player 1')
const playerColor = ref<string>(PLAYER_COLORS[0])
const mode = ref('race')
const playerMarble = ref(MARBLE_OPTIONS[0]?.id ?? '')
const isPrivate = ref(false)
const matchesPlayed = ref(0)

const MODE_OPTIONS = [
  { value: 'race', label: 'Race' },
  { value: 'rush', label: 'Rush' }
]

const trackField = ref<LobbyConfigField>({
  type: 'select',
  key: 'trackIndex',
  label: 'Track',
  value: 0,
  options: [
    { value: 0, label: 'Long Road' },
    { value: 1, label: 'Slopes' },
    { value: 2, label: 'Switchback' },
    { value: 3, label: 'Gauntlet' },
    { value: 4, label: 'Speed Run' }
  ]
})

const lapsField = ref<LobbyConfigField>({
  type: 'number',
  key: 'laps',
  label: 'Laps',
  value: 3,
  min: 1,
  max: 9
})

const configFields = computed<LobbyConfigField[]>(() =>
  mode.value === 'race' ? [trackField.value, lapsField.value] : []
)

const players = ref<LobbyPlayer[]>([
  { id: 'me', name: 'Player 1', color: PLAYER_COLORS[0] },
  { id: 'p2', name: 'Ada', color: PLAYER_COLORS[2] },
  { id: 'p3', name: 'Kai', color: PLAYER_COLORS[4] }
])

const onFieldChange = (key: string, value: string | number): void => {
  if (key === 'trackIndex' && trackField.value.type === 'select') {
    trackField.value = { ...trackField.value, value }
  } else if (key === 'laps' && lapsField.value.type === 'number') {
    lapsField.value = { ...lapsField.value, value: value as number }
  }
}

const startGame = (): void => {
  matchesPlayed.value += 1
  screen.value = 'results'
}

const playAgain = (): void => {
  screen.value = 'lobby'
}

const leaveRoom = (): void => {
  screen.value = 'lobby'
  players.value = players.value.filter((p) => p.id === 'me')
}

const isMarbleAvailable = (_id: string): boolean => true
</script>

<template>
  <div class="lui-showcase">
    <div class="lui-showcase__backdrop" aria-hidden="true">
      <div class="lui-showcase__sky" />
      <div class="lui-showcase__ground" />
      <span
        v-for="i in 6"
        :key="`cloud-${i}`"
        class="lui-showcase__cloud"
        :style="{
          top: `${5 + ((i * 11) % 50)}%`,
          left: `${(i * 23) % 90}%`,
          animationDelay: `${i * 1.8}s`,
          width: `${120 + (i % 3) * 60}px`
        }"
      />
    </div>

    <aside class="lui-showcase__debug" aria-live="polite">
      <div>Gamepad: {{ gamepadStatus }}</div>
      <div>Last action: {{ lastAction }} ({{ lastActionCount }})</div>
      <div>Row {{ focusRow }} / {{ rowCount - 1 }} · Col {{ focusCol }} / {{ colCount - 1 }}</div>
      <div>Active: {{ activeTag }}</div>
    </aside>

    <main class="lui-showcase__stage">
      <section
        v-if="screen === 'lobby'"
        ref="panelReference"
        class="lui-showcase__panel"
        @focusout="onFocusOut"
      >
        <h1 class="lui-showcase__title">Lobby</h1>

        <LobbyUIRow label="Name">
          <LobbyUINameInput v-model="playerName" :maxlength="20" placeholder="Your name" />
        </LobbyUIRow>

        <LobbyUIRow label="Color">
          <LobbyUIColorSwatches v-model="playerColor" :colors="PLAYER_COLORS" />
        </LobbyUIRow>

        <LobbyUIRow label="Mode">
          <LobbyUIOptionToggle v-model="mode" :options="MODE_OPTIONS" />
        </LobbyUIRow>

        <LobbyUIRow label="Marble">
          <LobbyUIImageGrid
            v-model="playerMarble"
            :items="MARBLE_OPTIONS"
            :is-item-disabled="(id) => !isMarbleAvailable(id)"
          />
        </LobbyUIRow>

        <LobbyUIRow v-for="field in configFields" :key="field.key" :label="field.label">
          <LobbyUIConfigField :field="field" @change="onFieldChange" />
        </LobbyUIRow>

        <LobbyUIRow label="Private">
          <LobbyUIPrivateToggle v-model="isPrivate" />
        </LobbyUIRow>

        <LobbyUIRow label="Players">
          <LobbyUIPlayerList :players="players" :is-host="true" />
        </LobbyUIRow>

        <div class="lui-showcase__nav" data-lui-row>
          <LobbyUIButton variant="cta" :autofocus="true" @click="startGame">Start</LobbyUIButton>
        </div>
      </section>

      <section v-else ref="panelReference" class="lui-showcase__panel" @focusout="onFocusOut">
        <h1 class="lui-showcase__title">Round Complete</h1>

        <LobbyUIRow label="Match">
          <span class="lui-showcase__value">{{ matchesPlayed }}</span>
        </LobbyUIRow>

        <LobbyUIRow label="Winner">
          <span class="lui-showcase__value">{{ playerName || 'You' }}</span>
        </LobbyUIRow>

        <LobbyUIRow label="Players">
          <LobbyUIPlayerList :players="players" :is-host="true" />
        </LobbyUIRow>

        <div class="lui-showcase__nav lui-showcase__nav--split" data-lui-row>
          <LobbyUIButton variant="ghost" @click="leaveRoom">← Leave</LobbyUIButton>
          <LobbyUIButton variant="cta" :autofocus="true" @click="playAgain"
            >Play Again</LobbyUIButton
          >
        </div>
      </section>
    </main>

    <div
      v-if="focusedHint && inputSource === 'gamepad'"
      class="lui-showcase__hint"
      aria-hidden="true"
      :style="{
        top: `${focusedHint.rect.top + focusedHint.rect.height / 2}px`,
        left: `${focusedHint.rect.left + focusedHint.rect.width + HINT_GAP_PX}px`
      }"
    >
      <span v-for="part in focusedHint.parts" :key="part.glyph" class="lui-showcase__hint-part">
        <span class="lui-showcase__hint-glyph">{{ part.glyph }}</span>
        {{ part.label }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.lui-showcase {
  position: relative;
  min-height: 100vh;
  padding-top: var(--nav-height);
  overflow: hidden;
  color: var(--lui-text-color);
  font-family: var(--lui-font);
}

.lui-showcase__backdrop {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

.lui-showcase__sky {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, #6cb8e6 0%, #b0d8f0 60%, #d6efe3 100%);
}

.lui-showcase__ground {
  position: absolute;
  left: -10%;
  right: -10%;
  bottom: -20%;
  height: 60%;
  background: radial-gradient(ellipse at 50% 0%, #4a7a3a 0%, #2c4a23 70%, transparent 100%);
  border-radius: 50% 50% 0 0 / 30% 30% 0 0;
}

@keyframes lui-cloud-drift {
  from {
    transform: translateX(-20vw);
  }

  to {
    transform: translateX(120vw);
  }
}

.lui-showcase__cloud {
  position: absolute;
  height: 36px;
  background:
    radial-gradient(circle at 30% 60%, #fff 0%, transparent 60%),
    radial-gradient(circle at 55% 50%, #fff 0%, transparent 65%),
    radial-gradient(circle at 75% 60%, #fff 0%, transparent 60%);
  opacity: 0.85;
  animation: lui-cloud-drift 60s linear infinite;
}

.lui-showcase__stage {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--spacing-4);
  min-height: calc(100vh - var(--nav-height));
  box-sizing: border-box;
}

.lui-showcase__debug {
  position: fixed;
  top: calc(var(--nav-height) + var(--spacing-2));
  right: var(--spacing-2);
  z-index: 2;
  padding: var(--spacing-2) var(--spacing-3);
  background: rgb(0 0 0 / 0.6);
  color: #fff;
  font:
    400 0.85rem ui-monospace,
    monospace;
  border-radius: var(--radius-sm, 0.25rem);
  display: flex;
  flex-direction: column;
  gap: 2px;
  pointer-events: none;
}

.lui-showcase__panel {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  width: 100%;
  max-width: 36rem;
  padding: var(--spacing-4);
  box-sizing: border-box;
}

/* Yellow rounded chip with a small gap from the focused control's right edge.
   Vertically centered on the element via translateY(-50%), so the inline
   `top` coordinate can use the element's vertical center directly. Fixed
   height (line-height + padding-block) keeps the chip the same size for
   every control. */
.lui-showcase__hint {
  position: fixed;
  z-index: 3;
  transform: translateY(-50%);
  pointer-events: none;
  font-family: var(--lui-font);
  font-size: var(--lui-text-small);
  line-height: 1;
  color: #000;
  background: var(--lui-focus-color);
  padding-inline: 0.7em;
  padding-block: 0.4em;
  border-radius: 999px;
  letter-spacing: 0.04em;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 0.9em;
  box-sizing: border-box;
}

.lui-showcase__hint-part {
  display: inline-flex;
  align-items: center;
  gap: 0.25em;
}

.lui-showcase__hint-glyph {
  font-weight: 900;
}

.lui-showcase__title {
  margin: 0 0 var(--spacing-2);
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

.lui-showcase__value {
  font-family: var(--lui-font);
  font-weight: 900;
  font-size: var(--lui-text-medium);
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.lui-showcase__nav {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--spacing-2);
  padding-top: var(--spacing-3);
}

.lui-showcase__nav--split {
  justify-content: space-between;
}

@media (width <= 720px) {
  .lui-showcase__panel {
    padding: var(--spacing-3);
  }
}
</style>
