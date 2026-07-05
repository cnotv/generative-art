<script setup lang="ts">
import { computed, ref, type Component } from 'vue'
import { X, Keyboard, Gamepad2, Joystick } from 'lucide-vue-next'
import {
  LobbyUIButton,
  LobbyUIIconButton,
  LobbyUIOptionToggle,
  LobbyUIConfigField
} from '@/components/LobbyUI'
import { useControlsMapperStore } from '@/stores/controlsMapper'
import type { ControlDevice } from '@webgamekit/controls'
import type { LobbyConfigField } from '@/types/lobbyWizard'
import { MAPPER_ACTIONS, MAPPER_DEVICES, FAUX_PAD_DIRECTIONS } from './config'
import type { MapperActionConfig } from './types'
import { useBindingCapture } from './useBindingCapture'

const props = withDefaults(defineProps<{ gameId?: string; actions?: MapperActionConfig[] }>(), {
  actions: () => MAPPER_ACTIONS
})

const store = useControlsMapperStore(props.gameId)
const actions = computed(() => props.actions)
const { listeningDevice, capture, cancel } = useBindingCapture()

const captureDevices: ControlDevice[] = ['keyboard', 'gamepad']

const DEVICE_ICONS: Record<string, Component> = {
  keyboard: Keyboard,
  gamepad: Gamepad2,
  'faux-pad': Joystick
}

const deviceOptions = MAPPER_DEVICES.map((device) => ({
  value: device.id,
  label: device.label,
  icon: DEVICE_ICONS[device.id]
}))

const activeDevice = computed(() => store.activeDevice)
const setDevice = (device: string) => store.setActiveDevice(device as ControlDevice)

const listeningActionId = ref<string | null>(null)

const formatTrigger = (trigger: string): string => (trigger === ' ' ? 'Space' : trigger)

const triggersForAction = (device: ControlDevice, actionId: string): string[] =>
  Object.entries(store.mapping[device] ?? {})
    .filter(([, action]) => action === actionId)
    .map(([trigger]) => trigger)

const displayTrigger = (device: ControlDevice, actionId: string): string =>
  triggersForAction(device, actionId).map(formatTrigger).join(', ') || '—'

const listen = async (device: ControlDevice, actionId: string) => {
  listeningActionId.value = actionId
  store.setCapturing(true)
  try {
    const trigger = await capture(device)
    store.bindTrigger(device, trigger, actionId)
  } catch {
    // capture cancelled — nothing to bind
  } finally {
    store.setCapturing(false)
    if (listeningActionId.value === actionId) listeningActionId.value = null
  }
}

const resetAction = (device: ControlDevice, actionId: string) => {
  triggersForAction(device, actionId).forEach((trigger) => store.clearTrigger(device, trigger))
}

const NONE_OPTION = 'none'
const BUTTON_OPTION = 'button'
const isDirectional = (actionId: string): boolean =>
  props.actions.find((action) => action.id === actionId)?.directional ?? false

const DIRECTION_OPTIONS = [
  { value: NONE_OPTION, label: 'None' },
  ...FAUX_PAD_DIRECTIONS.map((direction) => ({ value: direction, label: direction }))
]
const BUTTON_OPTIONS = [
  { value: NONE_OPTION, label: 'None' },
  { value: BUTTON_OPTION, label: 'Button' }
]

// The faux-pad key bound to a movement action is its direction; a non-directional
// action (e.g. jump) is bound to a same-named on-screen button instead.
const fauxDirectionForAction = (actionId: string): string => {
  const entry = Object.entries(store.mapping['faux-pad'] ?? {}).find(
    ([, action]) => action === actionId
  )
  return entry ? entry[0] : NONE_OPTION
}

const fauxPadValue = ({ id }: { id: string }): string => {
  if (isDirectional(id)) return fauxDirectionForAction(id)
  return store.mapping['faux-pad']?.[id] ? BUTTON_OPTION : NONE_OPTION
}

const fauxPadField = (action: { id: string; label: string }): LobbyConfigField => ({
  type: 'select',
  key: action.id,
  label: action.label,
  value: fauxPadValue(action),
  options: isDirectional(action.id) ? DIRECTION_OPTIONS : BUTTON_OPTIONS
})

const setFauxPad = (actionId: string, value: string | number) => {
  const choice = String(value)
  if (isDirectional(actionId)) {
    if (choice === NONE_OPTION) {
      const current = fauxDirectionForAction(actionId)
      if (current !== NONE_OPTION) store.clearTrigger('faux-pad', current)
    } else {
      store.bindTrigger('faux-pad', choice, actionId)
    }
  } else if (choice === NONE_OPTION) {
    store.clearTrigger('faux-pad', actionId)
  } else {
    store.bindTrigger('faux-pad', actionId, actionId)
  }
}

const isListening = computed(() => listeningDevice.value !== null)
</script>

<template>
  <div class="mapper-bindings">
    <div class="mapper-bindings__tabs" data-lui-row>
      <LobbyUIOptionToggle
        :model-value="activeDevice"
        :options="deviceOptions"
        hide-label-on-mobile
        @update:model-value="setDevice"
      />
    </div>

    <div v-if="activeDevice !== 'faux-pad'" class="mapper-bindings__grid">
      <div v-for="action in actions" :key="action.id" class="mapper-bindings__row" data-lui-row>
        <span class="mapper-bindings__label">{{ action.label }}</span>
        <button
          class="mapper-bindings__value"
          :class="{ 'mapper-bindings__value--listening': listeningActionId === action.id }"
          type="button"
          :title="`Change ${action.label}, then press an input to set it`"
          @click="listen(activeDevice, action.id)"
        >
          {{ listeningActionId === action.id ? 'Press…' : displayTrigger(activeDevice, action.id) }}
        </button>
        <LobbyUIIconButton
          variant="ghost"
          :title="`Reset ${action.label}`"
          @click="resetAction(activeDevice, action.id)"
        >
          <X class="mapper-bindings__icon" />
        </LobbyUIIconButton>
      </div>
    </div>

    <div v-else class="mapper-bindings__grid mapper-bindings__grid--faux">
      <div v-for="action in actions" :key="action.id" class="mapper-bindings__row" data-lui-row>
        <span class="mapper-bindings__label">{{ action.label }}</span>
        <LobbyUIConfigField :field="fauxPadField(action)" @change="setFauxPad" />
      </div>
    </div>

    <div v-if="isListening" class="mapper-bindings__cancel" data-lui-row>
      <LobbyUIButton variant="ghost" @click="cancel">Cancel</LobbyUIButton>
    </div>
  </div>
</template>

<style scoped>
.mapper-bindings {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}

.mapper-bindings__tabs {
  margin-bottom: var(--spacing-6);
}

.mapper-bindings__grid {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: var(--spacing-2) var(--spacing-3);
}

.mapper-bindings__grid--faux {
  grid-template-columns: auto 1fr;
}

.mapper-bindings__row {
  display: contents;
}

.mapper-bindings__label {
  font-family: var(--lui-font);
  font-weight: 900;
  font-size: var(--lui-text-small);
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
  text-transform: uppercase;
}

.mapper-bindings__value {
  justify-self: start;
  padding: var(--spacing-1) var(--spacing-2);
  border: 2px solid transparent;
  border-radius: var(--radius-md);
  background: transparent;
  font-family: var(--lui-font);
  font-weight: 900;
  font-size: var(--lui-text-medium);
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
  text-transform: uppercase;
  text-align: left;
  cursor: pointer;
}

.mapper-bindings__value:hover,
.mapper-bindings__value:focus,
.mapper-bindings__value:focus-visible {
  outline: none;
  color: var(--lui-focus-color);
  border-color: var(--lui-focus-color);
}

.mapper-bindings__value--listening {
  color: var(--lui-focus-color);
  border-color: var(--lui-focus-color);
}

.mapper-bindings__icon {
  width: 1.3em;
  height: 1.3em;
  filter: drop-shadow(2px 2px 0 #000);
}
</style>
