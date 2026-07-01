<script setup lang="ts">
import { computed, watch } from 'vue'
import {
  LobbyUIRow,
  LobbyUIButton,
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

const deviceOptions = MAPPER_DEVICES.map((device) => ({ value: device.id, label: device.label }))

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
        @update:model-value="setDevice"
      />
    </div>

    <template v-if="activeDevice !== 'faux-pad'">
      <LobbyUIRow v-for="action in MAPPER_ACTIONS" :key="action.id" :label="action.label">
        <span class="mapper-bindings__trigger">
          {{ triggersForAction(activeDevice, action.id).map(formatTrigger).join(', ') || '—' }}
        </span>
        <LobbyUIButton
          variant="primary"
          :disabled="isListening"
          @click="listen(activeDevice, action.id)"
        >
          {{ listeningDevice === activeDevice ? 'Press…' : 'Listen' }}
        </LobbyUIButton>
        <LobbyUIButton variant="ghost" @click="clearAction(activeDevice, action.id)">
          Clear
        </LobbyUIButton>
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

.mapper-bindings__trigger {
  font-family: var(--lui-font);
  font-weight: 900;
  font-size: var(--lui-text-medium);
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
  text-transform: uppercase;
}
</style>
