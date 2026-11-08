<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { STRUDEL_AI_MODEL_OPTIONS } from '../ai/config'
import { useAiSettings } from '../ai/useAiSettings'

const aiSettings = useAiSettings()
const { apiKey, composeModel, soundModel } = storeToRefs(aiSettings)

const theme = ref<'light' | 'dark'>('dark')
const panelPosition = ref<'bottom' | 'right'>('bottom')
const autoStart = ref(false)
const showLineNumbers = ref(true)
const enableAutoComplete = ref(true)

const themes: { value: 'light' | 'dark'; label: string }[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' }
]

const positions: { value: 'bottom' | 'right'; label: string }[] = [
  { value: 'bottom', label: 'Bottom' },
  { value: 'right', label: 'Right' }
]
</script>

<template>
  <div class="strudel-settings">
    <section class="strudel-settings__field" aria-label="AI">
      <h3 class="strudel-settings__label">AI</h3>
      <Input
        v-model="apiKey"
        type="password"
        autocomplete="off"
        placeholder="OpenRouter key"
        aria-label="OpenRouter key"
      />
      <p class="strudel-settings__hint">
        The key is kept only in this browser's local storage, on this device. It is sent to
        OpenRouter and nowhere else.
      </p>
      <div class="strudel-settings__actions">
        <Button
          variant="outline"
          size="sm"
          :disabled="apiKey.length === 0"
          @click="aiSettings.forgetApiKey"
        >
          Forget key
        </Button>
      </div>
      <span class="strudel-settings__hint">Compose model</span>
      <Select v-model="composeModel" :options="STRUDEL_AI_MODEL_OPTIONS" />
      <span class="strudel-settings__hint">Sound model, for the Instruments tab's AI tone</span>
      <Select v-model="soundModel" :options="STRUDEL_AI_MODEL_OPTIONS" />
    </section>

    <div class="strudel-settings__field">
      <label class="strudel-settings__label">Theme</label>
      <div class="strudel-settings__options">
        <button
          v-for="option in themes"
          :key="option.value"
          class="strudel-settings__option"
          :class="{ 'strudel-settings__option--active': theme === option.value }"
          type="button"
          @click="theme = option.value"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <div class="strudel-settings__field">
      <label class="strudel-settings__label">Panel position</label>
      <div class="strudel-settings__options">
        <button
          v-for="option in positions"
          :key="option.value"
          class="strudel-settings__option"
          :class="{ 'strudel-settings__option--active': panelPosition === option.value }"
          type="button"
          @click="panelPosition = option.value"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <div class="strudel-settings__field">
      <label class="strudel-settings__label">Playback</label>
      <div class="strudel-settings__checkboxes">
        <label class="strudel-settings__checkbox">
          <input v-model="autoStart" type="checkbox" />
          Auto-start pattern on change
        </label>
      </div>
    </div>

    <div class="strudel-settings__field">
      <label class="strudel-settings__label">Editor</label>
      <div class="strudel-settings__checkboxes">
        <label class="strudel-settings__checkbox">
          <input v-model="showLineNumbers" type="checkbox" />
          Show line numbers
        </label>
        <label class="strudel-settings__checkbox">
          <input v-model="enableAutoComplete" type="checkbox" />
          Enable auto-complete
        </label>
      </div>
    </div>

    <div class="strudel-settings__field">
      <label class="strudel-settings__label">Audio</label>
      <p class="strudel-settings__hint">
        Audio device and engine target settings are managed by the browser and Strudel engine.
      </p>
    </div>
  </div>
</template>

<style scoped>
.strudel-settings {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
  padding: var(--spacing-4);
}

.strudel-settings__field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.strudel-settings__label {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-muted-foreground);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.strudel-settings__options {
  display: flex;
  gap: var(--spacing-1);
}

.strudel-settings__option {
  padding: var(--spacing-1) var(--spacing-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background);
  color: var(--color-foreground);
  font-size: var(--font-size-md);
  cursor: pointer;
}

.strudel-settings__option--active {
  background: var(--color-primary);
  color: var(--color-primary-foreground);
  border-color: var(--color-primary);
}

.strudel-settings__checkboxes {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.strudel-settings__checkbox {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  font-size: var(--font-size-md);
  cursor: pointer;
}

.strudel-settings__checkbox input {
  accent-color: var(--color-primary);
}

.strudel-settings__actions {
  display: flex;
  gap: var(--spacing-2);
}

.strudel-settings__hint {
  font-size: var(--font-size-sm);
  color: var(--color-muted-foreground);
  margin: 0;
}
</style>
