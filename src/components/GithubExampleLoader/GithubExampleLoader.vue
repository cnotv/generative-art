<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { ExternalLink, X } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  searchRepositories,
  buildRunnerUrl,
  buildRepositoryUrl,
  buildCloneCommand,
  isRepositoryName
} from './githubExampleSearch'
import type { GithubRepository } from './types'

const SEARCH_DEBOUNCE_MS = 350
const MINIMUM_QUERY_LENGTH = 2
const RESULTS_DATALIST_ID = 'github-example-loader-results'

const emit = defineEmits<{ close: [] }>()

const query = ref('')
const results = ref<GithubRepository[]>([])
const loadedRepository = ref('')
const errorMessage = ref('')
const hasCopiedCommand = ref(false)
const debounceTimer = ref<ReturnType<typeof setTimeout>>()

const loadedDescription = computed(
  () =>
    results.value.find((repository) => repository.fullName === loadedRepository.value)
      ?.description ?? ''
)

const copyCloneCommand = async () => {
  await navigator.clipboard.writeText(buildCloneCommand(loadedRepository.value))
  hasCopiedCommand.value = true
}

const describeRepository = (repository: GithubRepository): string =>
  repository.description
    ? `${repository.description} (${repository.stars} stars)`
    : `${repository.stars} stars`

const runSearch = async (term: string) => {
  errorMessage.value = ''
  try {
    results.value = await searchRepositories(term)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'GitHub search failed'
    results.value = []
  }
}

watch(query, (term) => {
  clearTimeout(debounceTimer.value)
  hasCopiedCommand.value = false
  const candidate = term.trim()

  // Choosing a suggestion writes the whole "owner/repo" into the field, and that is the
  // only selection signal a native datalist gives, so a complete name is what loads.
  if (isRepositoryName(candidate)) {
    loadedRepository.value = candidate
    return
  }

  loadedRepository.value = ''
  if (candidate.length < MINIMUM_QUERY_LENGTH) {
    results.value = []
    return
  }

  debounceTimer.value = setTimeout(() => runSearch(candidate), SEARCH_DEBOUNCE_MS)
})

onUnmounted(() => clearTimeout(debounceTimer.value))
</script>

<template>
  <section class="github-example-loader" aria-label="Load an example from GitHub">
    <header class="github-example-loader__search">
      <Input
        v-model="query"
        class="github-example-loader__input"
        :list="RESULTS_DATALIST_ID"
        placeholder="Search GitHub, or paste owner/repository"
        aria-label="Search GitHub repositories"
        autofocus
        @keydown.esc="emit('close')"
      />
      <datalist :id="RESULTS_DATALIST_ID">
        <option
          v-for="repository in results"
          :key="repository.fullName"
          :value="repository.fullName"
          :label="describeRepository(repository)"
        />
      </datalist>

      <a
        v-if="loadedRepository"
        class="github-example-loader__link"
        :href="buildRepositoryUrl(loadedRepository)"
        target="_blank"
        rel="noopener noreferrer"
      >
        <span>{{ loadedRepository }}</span>
        <ExternalLink class="github-example-loader__icon" />
      </a>

      <Button
        variant="ghost"
        size="icon"
        aria-label="Close the example loader"
        @click="emit('close')"
      >
        <X class="github-example-loader__icon" />
      </Button>
    </header>

    <p v-if="errorMessage" class="github-example-loader__error" role="alert">
      {{ errorMessage }}
    </p>

    <div v-if="loadedRepository" class="github-example-loader__result">
      <h2 class="github-example-loader__name">{{ loadedRepository }}</h2>
      <p v-if="loadedDescription" class="github-example-loader__description">
        {{ loadedDescription }}
      </p>

      <p class="github-example-loader__label">Run it in the browser</p>
      <a
        class="github-example-loader__action"
        :href="buildRunnerUrl(loadedRepository)"
        target="_blank"
        rel="noopener noreferrer"
      >
        <span>Open on StackBlitz</span>
        <ExternalLink class="github-example-loader__icon" />
      </a>

      <p class="github-example-loader__label">Run it in your shell</p>
      <pre class="github-example-loader__command">{{ buildCloneCommand(loadedRepository) }}</pre>
      <Button variant="secondary" @click="copyCloneCommand">
        {{ hasCopiedCommand ? 'Copied' : 'Copy command' }}
      </Button>
    </div>
    <p v-else class="github-example-loader__message">
      Search GitHub, then pick a repository to get a one-line command that clones and runs it.
    </p>
  </section>
</template>

<style scoped>
.github-example-loader {
  position: fixed;
  inset: var(--nav-height) 0 0;
  z-index: var(--z-modal);
  display: grid;
  grid-template-areas: 'search' 'error' 'body';
  grid-template-rows: auto auto 1fr;
  background-color: var(--color-background);
  color: var(--color-foreground);
}

.github-example-loader__search {
  grid-area: search;
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-2) var(--spacing-3);
  border-bottom: var(--spacing-px) solid var(--color-border);
}

.github-example-loader__input {
  flex: 1;
}

.github-example-loader__link {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
  flex-shrink: 0;
  padding: 0 var(--spacing-2);
  color: var(--color-muted-foreground);
  font-size: var(--font-size-sm);
  text-decoration: none;
}

.github-example-loader__link:hover {
  color: var(--color-foreground);
}

.github-example-loader__icon {
  width: var(--spacing-5);
  height: var(--spacing-5);
}

.github-example-loader__error {
  grid-area: error;
  padding: var(--spacing-2) var(--spacing-3);
  color: var(--color-destructive);
  font-size: var(--font-size-sm);
}

.github-example-loader__message {
  grid-area: body;
  align-self: start;
  padding: var(--spacing-4) var(--spacing-3);
  color: var(--color-muted-foreground);
  font-size: var(--font-size-sm);
}

.github-example-loader__result {
  grid-area: body;
  align-self: start;
  justify-self: start;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-2);
  max-width: 100%;
  padding: var(--spacing-4) var(--spacing-3);
}

.github-example-loader__name {
  font-size: var(--font-size-lg);
  font-weight: 600;
}

.github-example-loader__description {
  color: var(--color-muted-foreground);
  font-size: var(--font-size-sm);
}

.github-example-loader__label {
  margin-top: var(--spacing-4);
  color: var(--color-muted-foreground);
  font-size: var(--font-size-xs);
  text-transform: uppercase;
}

.github-example-loader__action {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
  color: var(--color-foreground);
  font-size: var(--font-size-sm);
}

.github-example-loader__command {
  max-width: 100%;
  overflow-x: auto;
  padding: var(--spacing-2) var(--spacing-3);
  border-radius: var(--radius-md);
  background-color: var(--color-muted);
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
}
</style>
