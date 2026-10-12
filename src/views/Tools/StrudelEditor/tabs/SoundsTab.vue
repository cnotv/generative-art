<script setup lang="ts">
import { ref } from 'vue'

const searchQuery = ref('')
const activeFilter = ref('all')

const filters = ['all', 'samples', 'drums', 'synths']

const sounds = ref<{ name: string; type: string; count: number }[]>([])

const filteredSounds = () => {
  const query = searchQuery.value.trim().toLowerCase()
  let result = sounds.value
  if (activeFilter.value === 'drums') {
    result = result.filter(
      (sound) => sound.type === 'sample' && sound.name.match(/^(bd|sd|hh|cp|rim)/)
    )
  } else if (activeFilter.value === 'synths') {
    result = result.filter((sound) => sound.type === 'synth')
  }
  if (query.length === 0) {
    return result
  }
  return result.filter((sound) => sound.name.toLowerCase().includes(query))
}

const onPreview = (soundName: string): void => {
  // Sound preview triggered by user click - would call into Strudel audio engine
  void soundName
}
</script>

<template>
  <div class="strudel-sounds">
    <input
      v-model="searchQuery"
      class="strudel-sounds__search"
      type="search"
      placeholder="Search sounds..."
      aria-label="Search sounds"
    />
    <div class="strudel-sounds__filters">
      <button
        v-for="filter in filters"
        :key="filter"
        class="strudel-sounds__filter"
        :class="{ 'strudel-sounds__filter--active': activeFilter === filter }"
        type="button"
        @click="activeFilter = filter"
      >
        {{ filter }}
      </button>
    </div>
    <p class="strudel-sounds__hint">Click a sound name to preview it</p>
    <ul class="strudel-sounds__list">
      <li v-for="sound in filteredSounds()" :key="sound.name" class="strudel-sounds__item">
        <button class="strudel-sounds__button" type="button" @click="onPreview(sound.name)">
          {{ sound.name }}
          <span class="strudel-sounds__count">({{ sound.count }})</span>
        </button>
      </li>
    </ul>
    <p v-if="filteredSounds().length === 0" class="strudel-sounds__empty">
      Sounds load after first Play press
    </p>
  </div>
</template>

<style scoped>
.strudel-sounds {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  padding: var(--spacing-4);
}

.strudel-sounds__search {
  width: 100%;
  padding: var(--spacing-2) var(--spacing-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background);
  color: var(--color-foreground);
  font-size: var(--font-size-md);
  box-sizing: border-box;
}

.strudel-sounds__filters {
  display: flex;
  gap: var(--spacing-1);
  flex-wrap: wrap;
}

.strudel-sounds__filter {
  padding: var(--spacing-1) var(--spacing-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background);
  color: var(--color-foreground);
  font-size: var(--font-size-sm);
  cursor: pointer;
  text-transform: capitalize;
}

.strudel-sounds__filter--active {
  background: var(--color-primary);
  color: var(--color-primary-foreground);
  border-color: var(--color-primary);
}

.strudel-sounds__hint {
  font-size: var(--font-size-sm);
  color: var(--color-muted-foreground);
  margin: 0;
}

.strudel-sounds__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.strudel-sounds__button {
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

.strudel-sounds__button:hover {
  background: var(--color-secondary);
}

.strudel-sounds__count {
  color: var(--color-muted-foreground);
  font-size: var(--font-size-sm);
}

.strudel-sounds__empty {
  color: var(--color-muted-foreground);
  font-size: var(--font-size-sm);
  text-align: center;
  padding: var(--spacing-4);
}
</style>
