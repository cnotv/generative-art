<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { useControlsMapperStore } from '@/stores/controlsMapper'
import type { ControlDevice } from '@webgamekit/controls'
import { MAPPER_ACTIONS, FAUX_PAD_DIRECTIONS } from './config'
import { useBindingCapture } from './useBindingCapture'

const store = useControlsMapperStore()
const { listeningDevice, capture, cancel } = useBindingCapture()

const captureDevices: ControlDevice[] = ['keyboard', 'gamepad']

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
  <div class="mapper-bindings">
    <section v-for="device in captureDevices" :key="device" class="mapper-bindings__device">
      <h3 class="mapper-bindings__heading">{{ device }}</h3>
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
            @click="
              triggersForAction(device, action.id).forEach((t) => store.clearTrigger(device, t))
            "
          >
            Clear
          </Button>
        </li>
      </ul>
    </section>

    <section class="mapper-bindings__device">
      <h3 class="mapper-bindings__heading">Faux-pad</h3>
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
    </section>

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
  </div>
</template>

<style scoped>
.mapper-bindings {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
}

.mapper-bindings__heading {
  margin: 0 0 var(--spacing-2);
  font-size: var(--font-size-sm);
  text-transform: capitalize;
  color: var(--color-muted-foreground);
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
</style>
