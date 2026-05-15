<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  values: number[]
  color: string
}>()

const WIDTH = 100
const HEIGHT = 28
const MIN_MAX = 1

const points = computed(() => {
  const vals = props.values
  if (vals.length < 2) return ''
  const max = Math.max(...vals, MIN_MAX)
  const step = WIDTH / (vals.length - 1)
  return vals
    .map((v, i) => {
      const x = i * step
      const y = HEIGHT - (v / max) * HEIGHT
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
})
</script>

<template>
  <svg
    v-if="values.length >= 2"
    class="perf-chart"
    :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    <polyline :points="points" :stroke="color" fill="none" stroke-width="0.75" />
  </svg>
</template>

<style scoped>
.perf-chart {
  display: block;
  width: 100%;
  height: 28px;
  overflow: hidden;
}
</style>
