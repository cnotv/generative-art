<script setup lang="ts">
import { useControlsMapperStore } from '@/stores/controlsMapper'

const store = useControlsMapperStore()

const formatTrigger = (trigger: string): string => (trigger === ' ' ? 'Space' : trigger)
</script>

<template>
  <div class="mapper-tester">
    <div class="mapper-tester__active">
      <span class="mapper-tester__label">Active</span>
      <div class="mapper-tester__chips">
        <span v-for="action in store.liveActions" :key="action" class="mapper-tester__chip">
          {{ action }}
        </span>
        <span v-if="!store.liveActions.length" class="mapper-tester__idle">
          Press keys, gamepad buttons, or drag the pad…
        </span>
      </div>
    </div>

    <ul class="mapper-tester__log">
      <li
        v-for="(event, index) in store.recentEvents"
        :key="`${event.timestamp}-${index}`"
        class="mapper-tester__event"
        :class="`mapper-tester__event--${event.type}`"
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
}

.mapper-tester__active {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.mapper-tester__label {
  font-size: var(--font-size-base);
  color: var(--color-muted-foreground);
}

.mapper-tester__chips {
  display: flex;
  gap: var(--spacing-2);
  flex-wrap: wrap;
  min-height: 2rem;
  align-items: center;
}

.mapper-tester__chip {
  padding: var(--spacing-1) var(--spacing-2);
  border-radius: var(--radius-full);
  background-color: var(--color-primary);
  color: var(--color-primary-foreground);
  font-size: var(--font-size-base);
}

.mapper-tester__idle {
  color: var(--color-muted-foreground);
  font-size: var(--font-size-base);
}

.mapper-tester__log {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  max-height: 12rem;
  overflow-y: auto;
}

.mapper-tester__event {
  display: grid;
  grid-template-columns: 4rem 1fr auto;
  gap: var(--spacing-2);
  font-family: var(--font-mono);
  font-size: var(--font-size-base);
}

.mapper-tester__event-type {
  text-transform: uppercase;
  color: var(--color-muted-foreground);
}

.mapper-tester__event--action .mapper-tester__event-type {
  color: var(--color-primary);
}
</style>
