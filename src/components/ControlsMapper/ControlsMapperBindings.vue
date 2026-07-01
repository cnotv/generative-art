<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useControlsMapperStore } from '@/stores/controlsMapper'
import type { ControlDevice } from '@webgamekit/controls'
import { MAPPER_ACTIONS, MAPPER_DEVICES, FAUX_PAD_DIRECTIONS } from './config'
import { useBindingCapture } from './useBindingCapture'

const store = useControlsMapperStore()
const { listeningDevice, capture, cancel } = useBindingCapture()

const captureDevices: ControlDevice[] = ['keyboard', 'gamepad']
const activeDevice = ref<ControlDevice>('keyboard')

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
    if (tab) activeDevice.value = tab
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

const actionOptions = [
  { value: NONE_OPTION, label: 'None' },
  ...MAPPER_ACTIONS.map((action) => ({ value: action.id, label: action.label }))
]

const fauxPadAction = (direction: string) => store.mapping['faux-pad']?.[direction] ?? NONE_OPTION

const setFauxPad = (direction: string, action: string) => {
  if (action === NONE_OPTION) {
    store.clearTrigger('faux-pad', direction)
  } else {
    store.bindTrigger('faux-pad', direction, action)
  }
}

const isListening = computed(() => listeningDevice.value !== null)
</script>

<template>
  <div class="mapper-bindings">
    <Tabs v-model="activeDevice" class="mapper-bindings__tabs">
      <TabsList>
        <TabsTrigger v-for="device in MAPPER_DEVICES" :key="device.id" :value="device.id">
          {{ device.label }}
        </TabsTrigger>
      </TabsList>

      <TabsContent
        v-for="device in captureDevices"
        :key="device"
        :value="device"
        class="mapper-bindings__panel"
      >
        <ul class="mapper-bindings__list">
          <li v-for="action in MAPPER_ACTIONS" :key="action.id" class="mapper-bindings__row">
            <span class="mapper-bindings__action">{{ action.label }}</span>
            <span class="mapper-bindings__trigger">
              {{ triggersForAction(device, action.id).map(formatTrigger).join(', ') || '—' }}
            </span>
            <Button
              variant="outline"
              :disabled="isListening"
              :title="`Listen for a ${device} input to bind to ${action.label}`"
              @click="listen(device, action.id)"
            >
              {{ listeningDevice === device ? 'Press…' : 'Listen' }}
            </Button>
            <Button
              variant="ghost"
              title="Clear all bindings for this action"
              @click="clearAction(device, action.id)"
            >
              Clear
            </Button>
          </li>
        </ul>
      </TabsContent>

      <TabsContent value="faux-pad" class="mapper-bindings__panel">
        <ul class="mapper-bindings__list">
          <li
            v-for="direction in FAUX_PAD_DIRECTIONS"
            :key="direction"
            class="mapper-bindings__row"
          >
            <span class="mapper-bindings__action">{{ direction }}</span>
            <Select
              class="mapper-bindings__select"
              :model-value="fauxPadAction(direction)"
              :options="actionOptions"
              @update:model-value="setFauxPad(direction, $event)"
            />
          </li>
        </ul>
      </TabsContent>

      <Button
        v-if="isListening"
        variant="secondary"
        title="Cancel listening"
        class="mapper-bindings__cancel"
        @click="cancel"
      >
        Cancel
      </Button>
    </Tabs>
  </div>
</template>

<style scoped>
.mapper-bindings__panel {
  overflow: visible;
}

.mapper-bindings__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.mapper-bindings__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-2);
}

.mapper-bindings__action {
  flex: 1 1 8rem;
}

.mapper-bindings__trigger {
  flex: 0 1 auto;
  min-width: 4rem;
  font-family: var(--font-mono);
  color: var(--color-foreground);
}

.mapper-bindings__select {
  flex: 1 1 8rem;
}

.mapper-bindings__cancel {
  margin-top: var(--spacing-2);
}
</style>
