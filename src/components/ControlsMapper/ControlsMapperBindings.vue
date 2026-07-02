<script setup lang="ts">
import { computed, watch, type Component } from 'vue'
import { Pencil, Undo2, Keyboard, Gamepad2, Joystick } from 'lucide-vue-next'
import {
  LobbyUIRow,
  LobbyUIButton,
  LobbyUIIconButton,
  LobbyUIOptionToggle,
  LobbyUIConfigField
} from '@/components/LobbyUI'
import { useControlsMapperStore } from '@/stores/controlsMapper'
import type { ControlDevice } from '@webgamekit/controls'
import type { LobbyConfigField } from '@/types/lobbyWizard'
import { MAPPER_ACTIONS, MAPPER_DEVICES, FAUX_PAD_DIRECTIONS } from './config'
import { useBindingCapture } from './useBindingCapture'

const store = useControlsMapperStore()
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

const toDeviceTab = (device: string): ControlDevice | null => {
  if (device === 'keyboard') return 'keyboard'
  if (device.startsWith('gamepad')) return 'gamepad'
  if (device === 'faux-pad') return 'faux-pad'
  return null
}

watch(
  () => store.lastDevice,
  (device) => {
    const tab = toDeviceTab(device)
    if (tab) store.setActiveDevice(tab)
  }
)

const formatTrigger = (trigger: string): string => (trigger === ' ' ? 'Space' : trigger)

const triggersForAction = (device: ControlDevice, actionId: string): string[] =>
  Object.entries(store.mapping[device] ?? {})
    .filter(([, action]) => action === actionId)
    .map(([trigger]) => trigger)

const listen = async (device: ControlDevice, actionId: string) => {
  try {
    const trigger = await capture(device)
    store.bindTrigger(device, trigger, actionId)
  } catch {
    // capture cancelled — nothing to bind
  }
}

const clearAction = (device: ControlDevice, actionId: string) => {
  triggersForAction(device, actionId).forEach((trigger) => store.clearTrigger(device, trigger))
}

const NONE_OPTION = 'none'

const fauxPadField = (direction: string): LobbyConfigField => ({
  type: 'select',
  key: direction,
  label: direction,
  value: store.mapping['faux-pad']?.[direction] ?? NONE_OPTION,
  options: [
    { value: NONE_OPTION, label: 'None' },
    ...MAPPER_ACTIONS.map((action) => ({ value: action.id, label: action.label }))
  ]
})

const setFauxPad = (direction: string, value: string | number) => {
  const action = String(value)
  if (action === NONE_OPTION) store.clearTrigger('faux-pad', direction)
  else store.bindTrigger('faux-pad', direction, action)
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

    <template v-if="activeDevice !== 'faux-pad'">
      <LobbyUIRow v-for="action in MAPPER_ACTIONS" :key="action.id" :label="action.label">
        <span class="mapper-bindings__trigger">
          {{ triggersForAction(activeDevice, action.id).map(formatTrigger).join(', ') || '—' }}
        </span>
        <LobbyUIIconButton
          variant="ghost"
          :disabled="isListening"
          :title="`Listen for a ${activeDevice} input to bind to ${action.label}`"
          @click="listen(activeDevice, action.id)"
        >
          <Pencil class="mapper-bindings__icon" />
        </LobbyUIIconButton>
        <LobbyUIIconButton
          variant="ghost"
          :title="`Clear ${action.label}`"
          @click="clearAction(activeDevice, action.id)"
        >
          <Undo2 class="mapper-bindings__icon" />
        </LobbyUIIconButton>
      </LobbyUIRow>
    </template>

    <template v-else>
      <LobbyUIRow v-for="direction in FAUX_PAD_DIRECTIONS" :key="direction" :label="direction">
        <LobbyUIConfigField :field="fauxPadField(direction)" @change="setFauxPad" />
      </LobbyUIRow>
    </template>

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

.mapper-bindings__trigger {
  margin-right: auto;
  font-family: var(--lui-font);
  font-weight: 900;
  font-size: var(--lui-text-medium);
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
  text-transform: uppercase;
}

.mapper-bindings__icon {
  width: 1.3em;
  height: 1.3em;
  filter: drop-shadow(2px 2px 0 #000);
}
</style>
