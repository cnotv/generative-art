<script setup lang="ts">
import { computed, ref } from 'vue'
import type { StrudelExample } from '../types'

const props = defineProps<{
  examples: StrudelExample[]
  electroTunes: StrudelExample[]
  currentCode: string
}>()

const emit = defineEmits<{
  selectExample: [exampleId: string]
  selectTune: [tuneId: string]
  play: []
}>()

const searchQuery = ref('')

const matchesSearch = (pattern: StrudelExample, query: string): boolean =>
  query.length === 0 ||
  pattern.label.toLowerCase().includes(query) ||
  pattern.code.toLowerCase().includes(query)

const patternGroups = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  return [
    {
      id: 'examples',
      title: 'Examples',
      patterns: props.examples.filter((example) => matchesSearch(example, query)),
      select: (exampleId: string) => emit('selectExample', exampleId)
    },
    {
      id: 'tunes',
      title: 'Tunes',
      patterns: props.electroTunes.filter((tune) => matchesSearch(tune, query)),
      select: (tuneId: string) => emit('selectTune', tuneId)
    }
  ].filter((group) => group.patterns.length > 0)
})
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
    <section
      v-for="group in patternGroups"
      :key="group.id"
      class="strudel-patterns__group"
      :aria-labelledby="`strudel-patterns-${group.id}`"
    >
      <h3 :id="`strudel-patterns-${group.id}`" class="strudel-patterns__group-title">
        {{ group.title }}
      </h3>
      <ul class="strudel-patterns__list">
        <li
          v-for="pattern in group.patterns"
          :key="pattern.id"
          class="strudel-patterns__item"
          :class="{ 'strudel-patterns__item--active': pattern.code === currentCode }"
        >
          <button class="strudel-patterns__button" type="button" @click="group.select(pattern.id)">
            {{ pattern.label }}
          </button>
        </li>
      </ul>
    </section>
    <p v-if="patternGroups.length === 0" class="strudel-patterns__empty">No patterns found</p>
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

.strudel-patterns__group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.strudel-patterns__group-title {
  margin: 0;
  padding: 0 var(--spacing-3);
  color: var(--color-muted-foreground);
  font-size: var(--font-size-sm);
  text-transform: uppercase;
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
