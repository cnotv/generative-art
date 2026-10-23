<script setup lang="ts">
import { computed, ref } from 'vue'
import type { StrudelExample } from '../types'

const props = defineProps<{
  examples: StrudelExample[]
  electroTunes: StrudelExample[]
  currentCode: string
}>()

const emit = defineEmits<{
  select: [patternId: string]
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
      patterns: props.examples.filter((example) => matchesSearch(example, query))
    },
    {
      id: 'tunes',
      title: 'Tunes',
      patterns: props.electroTunes.filter((tune) => matchesSearch(tune, query))
    }
  ].filter((group) => group.patterns.length > 0)
})

// The link's own navigation sets the anchor; loading here as well reloads a pattern whose
// anchor is already in the address, which would otherwise not change. A modified or middle
// click is left to the browser, to open the pattern in a new tab.
const onPatternClick = (event: MouseEvent, patternId: string): void => {
  const opensElsewhere =
    event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
  if (!opensElsewhere) {
    emit('select', patternId)
  }
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
        <li v-for="pattern in group.patterns" :key="pattern.id" class="strudel-patterns__item">
          <a
            class="strudel-patterns__link"
            :href="`#${pattern.id}`"
            :aria-current="pattern.code === currentCode ? 'true' : undefined"
            @click="onPatternClick($event, pattern.id)"
          >
            {{ pattern.label }}
          </a>
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

.strudel-patterns__link {
  display: block;
  padding: var(--spacing-2) var(--spacing-3);
  border-radius: var(--radius-md);
  color: var(--color-foreground);
  font-size: var(--font-size-md);
  text-decoration: none;
  transition: background-color 0.15s;
}

.strudel-patterns__link:hover,
.strudel-patterns__link[aria-current='true'] {
  background: var(--color-secondary);
}

.strudel-patterns__link:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--color-ring);
}

.strudel-patterns__empty {
  color: var(--color-muted-foreground);
  font-size: var(--font-size-sm);
  text-align: center;
  padding: var(--spacing-4);
}
</style>
