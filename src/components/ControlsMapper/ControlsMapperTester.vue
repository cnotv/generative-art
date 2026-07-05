<script setup lang="ts">
import { LobbyUIRow } from '@/components/LobbyUI'
import { useControlsMapperStore } from '@/stores/controlsMapper'

const props = defineProps<{ gameId?: string }>()

const store = useControlsMapperStore(props.gameId)

const formatTrigger = (trigger: string): string => (trigger === ' ' ? 'Space' : trigger)
</script>

<template>
  <div class="mapper-tester">
    <LobbyUIRow label="Active">
      <div class="mapper-tester__chips">
        <span v-for="action in store.liveActions" :key="action" class="mapper-tester__chip">
          {{ action }}
        </span>
        <span v-if="!store.liveActions.length" class="mapper-tester__idle">
          Press keys, gamepad buttons, or drag the pad…
        </span>
      </div>
    </LobbyUIRow>

    <ul class="mapper-tester__log">
      <li
        v-for="(event, index) in store.recentEvents"
        :key="`${event.timestamp}-${index}`"
        class="mapper-tester__event"
      >
        <span class="mapper-tester__event-type">{{ event.type }}</span>
        <span class="mapper-tester__event-action">{{ event.action }}</span>
        <span class="mapper-tester__event-trigger">
          {{ event.device ? `${event.device}:${formatTrigger(event.trigger)}` : '' }}
        </span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.mapper-tester {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  font-family: var(--lui-font);
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
}

.mapper-tester__chips {
  display: flex;
  gap: var(--spacing-2);
  flex-wrap: wrap;
  align-items: center;
  min-height: 2rem;
  justify-content: flex-end;
}

.mapper-tester__chip {
  padding: var(--spacing-1) var(--spacing-3);
  border: 2px solid var(--lui-stroke);
  box-shadow: var(--lui-border-shadow);
  border-radius: var(--radius-xl, 1.25rem);
  font-size: var(--lui-text-small);
  text-transform: uppercase;
}

.mapper-tester__idle {
  font-size: var(--lui-text-small);
  opacity: 0.7;
}

.mapper-tester__log {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  max-height: 10rem;
  overflow-y: auto;
}

.mapper-tester__event {
  display: grid;
  grid-template-columns: 5rem 1fr auto;
  gap: var(--spacing-2);
  font-size: var(--lui-text-small);
}

.mapper-tester__event-type {
  text-transform: uppercase;
  opacity: 0.7;
}
</style>
