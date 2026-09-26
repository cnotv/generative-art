<script setup lang="ts">
import { computed } from 'vue'
import { readShader } from './glsl'

const props = defineProps<{
  /** The shader source, read from the material so it is the code actually compiled. */
  source: string
  /** Current value of each uniform a control drives, keyed by the name the shader declares. */
  values?: Record<string, number>
  /** The uniform whose control was touched last, whose lines are marked. */
  active?: string
  label?: string
}>()

const reading = computed(() => readShader(props.source))

/**
 * What a uniform's declaration says about where its value comes from. A uniform with no control
 * is not a gap: `time` counts the clock and `tDiffuse` holds the reflection, and saying so is
 * the point of the panel.
 * @param name The uniform the line declares
 * @returns The note to show after the declaration
 */
const annotationFor = (name: string): string => {
  const value = props.values?.[name]
  return value === undefined ? '// set in code' : `// ${value}`
}

const lines = computed(() =>
  reading.value.lines.map((line, index) => ({
    key: index,
    tokens: line.tokens,
    annotation: line.declares ? annotationFor(line.declares) : '',
    active: Boolean(
      props.active && (line.declares === props.active || line.uses.includes(props.active))
    )
  }))
)

const activeLineCount = computed(() => lines.value.filter((line) => line.active).length)
</script>

<template>
  <figure class="shader-code">
    <figcaption class="shader-code__caption">
      {{ label ?? 'Shader' }}
      <span v-if="active" class="shader-code__active">
        {{ active }} reaches {{ activeLineCount }}
        {{ activeLineCount === 1 ? 'line' : 'lines' }}
      </span>
    </figcaption>

    <div class="shader-code__scroll">
      <pre class="shader-code__source"><code
      ><span
          v-for="line in lines"
          :key="line.key"
          class="shader-code__line"
          :class="{ 'shader-code__line--active': line.active }"
        ><span
            v-for="(token, index) in line.tokens"
            :key="index"
            :class="`shader-code__token--${token.kind}`"
          >{{ token.text }}</span><span
            v-if="line.annotation"
            class="shader-code__annotation"
          > {{ line.annotation }}</span>
</span></code></pre>
    </div>
  </figure>
</template>

<style scoped>
.shader-code {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  margin: 0;
}

.shader-code__caption {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-2);
  align-items: baseline;
  justify-content: space-between;
  font-size: var(--font-size-xs);
  font-weight: 500;
}

.shader-code__active {
  font-family: var(--font-mono);
  font-size: var(--font-size-2xs);
  color: var(--code-annotation);
}

/* The scroller is its own element: the source inside carries a highlight that a boundary on
   the same element would clip. */
.shader-code__scroll {
  max-height: 20rem;
  overflow: auto;
  background: var(--code-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.shader-code__source {
  width: max-content;
  min-width: 100%;
  padding: var(--spacing-2) 0;
  margin: 0;
  font-family: var(--font-mono);
  font-size: var(--font-size-2xs);
  line-height: 1.55;
  color: var(--code-foreground);
}

.shader-code__line {
  display: block;
  padding: 0 var(--spacing-2);
}

.shader-code__line--active {
  background: var(--code-line-active);
}

.shader-code__annotation {
  color: var(--code-annotation);
}

.shader-code__token--preprocessor {
  color: var(--code-keyword);
}

.shader-code__token--comment {
  color: var(--code-comment);
}

.shader-code__token--keyword {
  color: var(--code-keyword);
}

.shader-code__token--type {
  color: var(--code-type);
}

.shader-code__token--builtin {
  color: var(--code-builtin);
}

.shader-code__token--number {
  color: var(--code-number);
}

.shader-code__token--uniform {
  color: var(--code-uniform);
  font-weight: 600;
}
</style>
