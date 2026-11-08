<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { STONER_GUITAR_KNOB_LABELS, STONER_GUITAR_USAGE_HINT } from '../guitar/config'
import { useStonerGuitar } from '../guitar/useStonerGuitar'

const guitarStore = useStonerGuitar()
const {
  tone,
  status,
  errorMessage,
  apiKey,
  model,
  assistantBusy,
  assistantExplanation,
  assistantError
} = storeToRefs(guitarStore)
const { setKnob, resetTone, forgetApiKey, askAssistant } = guitarStore

const description = ref('')

const statusMessage = computed(() => {
  const messages = {
    idle: 'Waiting for the sound library.',
    rendering: 'Rendering the guitar sounds...',
    ready: 'Ready. Play it with the name below.',
    error: `Could not render the guitar: ${errorMessage.value}`
  }
  return messages[status.value]
})

const canAsk = computed(
  () => !assistantBusy.value && apiKey.value.length > 0 && description.value.trim().length > 0
)

const onAsk = (): void => {
  void askAssistant(description.value.trim())
}
</script>

<template>
  <div class="strudel-guitar">
    <p class="strudel-guitar__status" role="status">{{ statusMessage }}</p>
    <p class="strudel-guitar__hint">
      Sounds <code>stoner_chord</code>, <code>stoner_mute</code> and <code>stoner_note</code>:
      <code>{{ STONER_GUITAR_USAGE_HINT }}</code>
    </p>

    <div v-for="knob in STONER_GUITAR_KNOB_LABELS" :key="knob.id" class="strudel-guitar__knob">
      <label class="strudel-guitar__label">
        <span>{{ knob.label }}</span>
        <span class="strudel-guitar__knob-hint">{{ knob.hint }}</span>
      </label>
      <Slider
        :model-value="[tone[knob.id]]"
        :min="0"
        :max="1"
        :step="0.01"
        :label="knob.label"
        @update:model-value="setKnob(knob.id, $event[0] ?? 0)"
      />
    </div>
    <Button variant="outline" size="sm" @click="resetTone">Reset</Button>

    <section class="strudel-guitar__assistant" aria-label="AI tone">
      <h4 class="strudel-guitar__title">AI tone</h4>
      <Input
        v-model="description"
        placeholder="Dry desert fuzz, scooped mids"
        aria-label="Describe the tone"
      />
      <Input
        v-model="apiKey"
        type="password"
        autocomplete="off"
        placeholder="OpenRouter key"
        aria-label="OpenRouter key"
      />
      <p class="strudel-guitar__hint">
        The key is kept only in this browser's local storage, on this device. It is sent to
        OpenRouter and nowhere else.
      </p>
      <Input v-model="model" placeholder="Model" aria-label="OpenRouter model" />
      <div class="strudel-guitar__actions">
        <Button size="sm" :disabled="!canAsk" @click="onAsk">
          {{ assistantBusy ? 'Asking...' : 'Ask' }}
        </Button>
        <Button variant="outline" size="sm" :disabled="apiKey.length === 0" @click="forgetApiKey">
          Forget key
        </Button>
      </div>
      <p v-if="assistantError" class="strudel-guitar__error" role="alert">{{ assistantError }}</p>
      <p v-else-if="assistantExplanation" class="strudel-guitar__hint">
        {{ assistantExplanation }}
      </p>
    </section>
  </div>
</template>

<style scoped>
.strudel-guitar {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  padding: var(--spacing-4);
}

.strudel-guitar__status,
.strudel-guitar__hint {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-muted-foreground);
}

.strudel-guitar__knob {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.strudel-guitar__label {
  display: flex;
  justify-content: space-between;
  font-size: var(--font-size-sm);
  color: var(--color-foreground);
}

.strudel-guitar__knob-hint {
  color: var(--color-muted-foreground);
}

.strudel-guitar__assistant {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.strudel-guitar__title {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-foreground);
}

.strudel-guitar__actions {
  display: flex;
  gap: var(--spacing-2);
}

.strudel-guitar__error {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-destructive);
}
</style>
