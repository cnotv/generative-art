<script setup lang="ts">
import { computed } from 'vue'
import { useInputDevice } from '@/composables/useInputDevice'

const props = defineProps<{
  keyboard?: string[]
  gamepad?: string[]
}>()

const { device } = useInputDevice()

// Only the bindings for the device the player is actually using are shown;
// a pill with no binding for that device renders nothing.
const visibleKeys = computed(() =>
  device.value === 'gamepad' ? (props.gamepad ?? []) : (props.keyboard ?? [])
)
</script>

<template>
  <span v-if="visibleKeys.length" class="lui-key-pill" aria-hidden="true">
    <kbd v-for="keyName in visibleKeys" :key="keyName" class="lui-key-pill__key">{{ keyName }}</kbd>
  </span>
</template>

<style scoped>
.lui-key-pill {
  display: inline-flex;
  gap: 0.25em;
  align-items: center;
  pointer-events: none;
}

.lui-key-pill__key {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.6em;
  padding: 0.15em 0.4em;
  font-family: var(--lui-font);
  font-size: var(--lui-text-micro);
  font-weight: 900;
  line-height: 1;
  color: var(--lui-text-color-inverted);
  text-transform: uppercase;
  text-shadow: none;
  background: var(--lui-bg-key);
  border: none;
  border-radius: var(--lui-radius-sketch-small, 0.5em);
  box-shadow: none;
}
</style>
