<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import ButtonSelector from '@/components/ui/button-selector/ButtonSelector.vue'
import { STRUDEL_SOUND_FILTERS } from '../config'
import { matchesStrudelSoundFilter } from '../strudelSoundLibrary'
import type { StrudelSoundEntry, StrudelSoundFilter, StrudelSoundsStatus } from '../types'

const props = defineProps<{
  soundEntries: StrudelSoundEntry[]
  soundsStatus: StrudelSoundsStatus
}>()

const emit = defineEmits<{
  preview: [soundEntry: StrudelSoundEntry]
}>()

const searchQuery = ref('')
const activeFilter = ref<StrudelSoundFilter>('all')

const isSoundFilter = (filterId: string): filterId is StrudelSoundFilter =>
  STRUDEL_SOUND_FILTERS.some((soundFilter) => soundFilter.id === filterId)

const setFilter = (filterId: string): void => {
  if (isSoundFilter(filterId)) {
    activeFilter.value = filterId
  }
}

const setSearchQuery = (query: string | number): void => {
  searchQuery.value = String(query)
}

const visibleSounds = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  return props.soundEntries.filter(
    (soundEntry) =>
      matchesStrudelSoundFilter(soundEntry, activeFilter.value) &&
      soundEntry.name.toLowerCase().includes(query)
  )
})

const emptyMessage = computed(() => {
  const statusMessages: Record<StrudelSoundsStatus, string> = {
    idle: 'Loading sounds...',
    loading: 'Loading sounds...',
    error: 'The sounds failed to load. Check the connection and open this tab again.',
    ready: 'No sound matches.'
  }
  return statusMessages[props.soundsStatus]
})
</script>

<template>
  <div class="strudel-sounds">
    <Input
      :model-value="searchQuery"
      placeholder="Search sounds..."
      aria-label="Search sounds"
      @update:model-value="setSearchQuery"
    />
    <ButtonSelector
      :model-value="activeFilter"
      :options="STRUDEL_SOUND_FILTERS.map(({ id, label }) => ({ value: id, label }))"
      @update:model-value="setFilter"
    />
    <p class="strudel-sounds__hint">
      Click a sound to hear it, then play it with <code>s("name")</code>; the number is how many
      variations <code>n</code> picks from.
    </p>
    <ul v-if="visibleSounds.length > 0" class="strudel-sounds__list" aria-label="Sounds">
      <li v-for="soundEntry in visibleSounds" :key="soundEntry.name">
        <Button
          size="sm"
          variant="ghost"
          :aria-label="`Preview ${soundEntry.name}`"
          @click="emit('preview', soundEntry)"
        >
          {{ soundEntry.name }}
          <span v-if="soundEntry.sampleCount > 1" class="strudel-sounds__count">
            ({{ soundEntry.sampleCount }})
          </span>
        </Button>
      </li>
    </ul>
    <p v-else class="strudel-sounds__empty">{{ emptyMessage }}</p>
  </div>
</template>

<style scoped>
.strudel-sounds {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  padding: var(--spacing-4);
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
  flex-wrap: wrap;
  gap: var(--spacing-1);
}

.strudel-sounds__count {
  margin-inline-start: var(--spacing-1);
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
