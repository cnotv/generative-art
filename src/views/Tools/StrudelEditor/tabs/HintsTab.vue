<script setup lang="ts">
import { computed } from 'vue'
import { Plus } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { STRUDEL_STYLE_PICKER_DETECT } from '../config'
import type {
  StrudelHint,
  StrudelMusicStyle,
  StrudelMusicStyleId,
  StrudelStyleDetection,
  StrudelStyleSource
} from '../types'

const props = defineProps<{
  musicStyles: StrudelMusicStyle[]
  pickedStyleId: StrudelMusicStyleId | null
  detection: StrudelStyleDetection | null
  hints: StrudelHint[]
}>()

const emit = defineEmits<{
  pick: [styleId: StrudelMusicStyleId | null]
  apply: [hintId: string]
}>()

const SOURCE_DESCRIPTIONS: Record<StrudelStyleSource, string> = {
  picker: 'picked here',
  comment: 'from the first-line comment',
  code: 'guessed from the tempo and sounds. Name it in the first line, or pick one, to be sure'
}

const styleOptions = computed(() => [
  { value: STRUDEL_STYLE_PICKER_DETECT, label: 'Detect from the code' },
  ...props.musicStyles.map((style) => ({ value: style.id, label: style.label }))
])

const styleSummary = computed(() =>
  props.detection === null
    ? 'No style found yet.'
    : `${props.detection.style.label}, ${SOURCE_DESCRIPTIONS[props.detection.source]}.`
)

const onStylePicked = (value: string): void => {
  const pickedStyle = props.musicStyles.find((style) => style.id === value)
  emit('pick', pickedStyle?.id ?? null)
}
</script>

<template>
  <div class="strudel-hints">
    <h3 class="strudel-hints__heading">hints</h3>
    <div class="strudel-hints__picker">
      <span class="strudel-hints__picker-label">Style</span>
      <Select
        :model-value="pickedStyleId ?? STRUDEL_STYLE_PICKER_DETECT"
        :options="styleOptions"
        @update:model-value="onStylePicked"
      />
    </div>
    <p class="strudel-hints__style">{{ styleSummary }}</p>
    <p v-if="detection === null" class="strudel-hints__empty">
      Name a style in the first line, such as <code>// techno</code>, or pick one above.
    </p>
    <p v-else-if="hints.length === 0" class="strudel-hints__empty">
      Nothing missing: this pattern has the tempo, instruments and visuals
      {{ detection.style.label }} usually has.
    </p>
    <ul v-else class="strudel-hints__list">
      <li v-for="hint in hints" :key="hint.id" class="strudel-hints__item">
        <div class="strudel-hints__item-text">
          <p class="strudel-hints__title">{{ hint.title }}</p>
          <p class="strudel-hints__reason">{{ hint.reason }}</p>
          <code class="strudel-hints__snippet">{{ hint.snippet }}</code>
        </div>
        <Button
          size="sm"
          variant="secondary"
          :aria-label="`Add: ${hint.title}`"
          @click="emit('apply', hint.id)"
        >
          <Plus aria-hidden="true" />
          Add
        </Button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.strudel-hints {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  padding: var(--spacing-4);
  font-size: var(--font-size-md);
}

.strudel-hints__heading {
  font-size: var(--font-size-lg);
  font-weight: 700;
  margin: 0;
}

.strudel-hints__picker {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  align-items: center;
  gap: var(--spacing-2);
}

.strudel-hints__picker-label,
.strudel-hints__style,
.strudel-hints__reason {
  color: var(--color-muted-foreground);
}

.strudel-hints__style,
.strudel-hints__empty,
.strudel-hints__title,
.strudel-hints__reason {
  margin: 0;
}

.strudel-hints__list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.strudel-hints__item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-3);
  padding: var(--spacing-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.strudel-hints__item-text {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  min-width: 0;
}

.strudel-hints__title {
  font-weight: 600;
}

.strudel-hints__reason {
  font-size: var(--font-size-sm);
}

.strudel-hints__snippet {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  overflow-wrap: anywhere;
}
</style>
