<script setup lang="ts">
import { computed } from 'vue'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, useVueFlow } from '@vue-flow/core'
import type { EdgeProps } from '@vue-flow/core'
import { Unplug } from 'lucide-vue-next'

const props = defineProps<EdgeProps>()

const { removeEdges } = useVueFlow()

const path = computed(() =>
  getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition
  })
)
</script>

<template>
  <BaseEdge
    :id="id"
    :path="path[0]"
    :marker-end="markerEnd"
    :style="style"
    :interaction-width="24"
  />
  <EdgeLabelRenderer>
    <button
      type="button"
      class="strudel-flow-edge__remove nodrag nopan"
      :class="{ 'strudel-flow-edge__remove--selected': selected }"
      :style="{ transform: `translate(-50%, -50%) translate(${path[1]}px, ${path[2]}px)` }"
      aria-label="Disconnect"
      title="Disconnect"
      @click.stop="removeEdges([id])"
    >
      <Unplug aria-hidden="true" />
    </button>
  </EdgeLabelRenderer>
</template>
