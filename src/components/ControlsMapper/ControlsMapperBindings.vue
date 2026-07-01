<script setup lang="ts">
import { ref, computed } from 'vue'
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

const actionOptions = [
  { value: '', label: 'None' },
  ...MAPPER_ACTIONS.map((action) => ({ value: action.id, label: action.label }))
]

const fauxPadAction = (direction: string) => store.mapping['faux-pad']?.[direction] ?? ''

const setFauxPad = (direction: string, action: string) => {
  if (action) {
    store.bindTrigger('faux-pad', direction, action)
  } else {
    store.clearTrigger('faux-pad', direction)
  }
}

const isListening = computed(() => listeningDevice.value !== null)
</script>

<template>
  <Tabs v-model="activeDevice" class="mapper-bindings">
    <TabsList>
      <TabsTrigger v-for="device in MAPPER_DEVICES" :key="device.id" :value="device.id">
        {{ device.label }}
      </TabsTrigger>
    </TabsList>

    <TabsContent v-for="device in captureDevices" :key="device" :value="device">
      <ul class="mapper-bindings__list">
        <li v-for="action in MAPPER_ACTIONS" :key="action.id" class="mapper-bindings__row">
          <span class="mapper-bindings__action">{{ action.label }}</span>
          <span class="mapper-bindings__trigger">
            {{ triggersForAction(device, action.id).map(formatTrigger).join(', ') || '—' }}
          </span>
          <Button
            variant="outline"
            size="sm"
            :disabled="isListening"
            :title="`Listen for a ${device} input to bind to ${action.label}`"
            @click="listen(device, action.id)"
          >
            {{ listeningDevice === device ? 'Press…' : 'Listen' }}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            title="Clear all bindings for this action"
            @click="clearAction(device, action.id)"
          >
            Clear
          </Button>
        </li>
      </ul>
    </TabsContent>

    <TabsContent value="faux-pad">
      <ul class="mapper-bindings__list">
        <li v-for="direction in FAUX_PAD_DIRECTIONS" :key="direction" class="mapper-bindings__row">
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
      size="sm"
      title="Cancel listening"
      class="mapper-bindings__cancel"
      @click="cancel"
    >
      Cancel
    </Button>
  </Tabs>
</template>

<style scoped>
.mapper-bindings {
  gap: var(--spacing-3);
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
  display: grid;
  grid-template-columns: 1fr auto auto auto;
  align-items: center;
  gap: var(--spacing-2);
}

.mapper-bindings__trigger {
  font-family: var(--font-mono);
  color: var(--color-foreground);
}

.mapper-bindings__select {
  min-width: 10rem;
}

.mapper-bindings__cancel {
  margin-top: var(--spacing-2);
}
</style>
