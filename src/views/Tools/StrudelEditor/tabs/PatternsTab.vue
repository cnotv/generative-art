<script setup lang="ts">
import { computed, ref } from 'vue'
import type { StrudelExample } from '../types'

const props = defineProps<{
  electroTunes: StrudelExample[]
  currentCode: string
}>()

const emit = defineEmits<{
  select: [tuneId: string]
  play: []
}>()

const searchQuery = ref('')

const filteredTunes = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (query.length === 0) {
    return props.electroTunes
  }
  return props.electroTunes.filter(
    (tune) => tune.label.toLowerCase().includes(query) || tune.code.toLowerCase().includes(query)
  )
})

const onTuneClick = (tuneId: string): void => {
  emit('select', tuneId)
}
</script>

<template>
  <div class="strudel-patterns">
    <input
      v-model="searchQuery"
      class="strudel-patterns__search"
      type="search"
      placeholder="Search patterns..."
      aria-label="Search patterns"
    />
    <ul class="strudel-patterns__list">
      <li
        v-for="tune in filteredTunes"
        :key="tune.id"
        class="strudel-patterns__item"
        :class="{ 'strudel-patterns__item--active': tune.code === currentCode }"
      >
        <button class="strudel-patterns__button" type="button" @click="onTuneClick(tune.id)">
          {{ tune.label }}
        </button>
      </li>
    </ul>
    <p v-if="filteredTunes.length === 0" class="strudel-patterns__empty">No patterns found</p>
  </div>
</template>

<style scoped>
.strudel-patterns {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  padding: var(--spacing-4);
}

.strudel-patterns__search {
  width: 100%;
  padding: var(--spacing-2) var(--spacing-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background);
  color: var(--color-foreground);
  font-size: var(--font-size-md);
  box-sizing: border-box;
}

.strudel-patterns__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.strudel-patterns__item {
  border-radius: var(--radius-md);
  transition: background-color 0.15s;
}

.strudel-patterns__item--active {
  background: var(--color-secondary);
}

.strudel-patterns__button {
  width: 100%;
  text-align: left;
  padding: var(--spacing-2) var(--spacing-3);
  border: none;
  background: transparent;
  color: var(--color-foreground);
  font-size: var(--font-size-md);
  cursor: pointer;
  border-radius: var(--radius-md);
}

.strudel-patterns__button:hover {
  background: var(--color-secondary);
}

.strudel-patterns__empty {
  color: var(--color-muted-foreground);
  font-size: var(--font-size-sm);
  text-align: center;
  padding: var(--spacing-4);
}
</style>
