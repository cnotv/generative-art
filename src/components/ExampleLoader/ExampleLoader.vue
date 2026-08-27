<script setup lang="ts">
import { ref, computed } from 'vue'
import { ExternalLink, X } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { playableExamples, buildExampleUrl } from './exampleCatalogue'

const emit = defineEmits<{ close: [] }>()

const selectedSlug = ref(playableExamples[0].slug)

const selectedExample = computed(
  () =>
    playableExamples.find((example) => example.slug === selectedSlug.value) ?? playableExamples[0]
)
const selectedUrl = computed(() => buildExampleUrl(selectedSlug.value))
</script>

<template>
  <section class="example-loader" aria-label="Examples">
    <header class="example-loader__header">
      <h2 class="example-loader__title">Examples</h2>

      <nav class="example-loader__list">
        <Button
          v-for="example in playableExamples"
          :key="example.slug"
          variant="ghost"
          size="sm"
          class="example-loader__entry"
          :class="{ 'example-loader__entry--active': example.slug === selectedSlug }"
          :aria-current="example.slug === selectedSlug"
          @click="selectedSlug = example.slug"
        >
          {{ example.title }}
        </Button>
      </nav>

      <a class="example-loader__link" :href="selectedUrl" target="_blank" rel="noopener noreferrer">
        <span>Open in a tab</span>
        <ExternalLink class="example-loader__icon" />
      </a>

      <Button variant="ghost" size="icon" aria-label="Close the examples" @click="emit('close')">
        <X class="example-loader__icon" />
      </Button>
    </header>

    <p class="example-loader__description">{{ selectedExample.description }}</p>

    <iframe
      :key="selectedSlug"
      class="example-loader__frame"
      :src="selectedUrl"
      :title="selectedExample.title"
    />
  </section>
</template>

<style scoped>
.example-loader {
  position: fixed;
  inset: var(--nav-height) 0 0;
  z-index: var(--z-modal);
  display: grid;
  grid-template-rows: auto auto 1fr;
  background-color: var(--color-background);
  color: var(--color-foreground);
}

.example-loader__header {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-2) var(--spacing-3);
  border-bottom: var(--spacing-px) solid var(--color-border);
}

.example-loader__title {
  font-size: var(--font-size-sm);
  font-weight: 600;
  text-transform: uppercase;
  color: var(--color-muted-foreground);
}

.example-loader__list {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
}

.example-loader__entry--active {
  background-color: var(--color-muted);
}

.example-loader__link {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
  flex-shrink: 0;
  padding: 0 var(--spacing-2);
  color: var(--color-muted-foreground);
  font-size: var(--font-size-sm);
  text-decoration: none;
}

.example-loader__link:hover {
  color: var(--color-foreground);
}

.example-loader__icon {
  width: var(--spacing-5);
  height: var(--spacing-5);
}

.example-loader__description {
  padding: var(--spacing-2) var(--spacing-3);
  color: var(--color-muted-foreground);
  font-size: var(--font-size-sm);
}

.example-loader__frame {
  width: 100%;
  height: 100%;
  border: none;
}
</style>
