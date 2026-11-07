<script setup lang="ts">
import type { StrudelFlowVoicingData } from '../../types'

defineProps<{
  data: StrudelFlowVoicingData
}>()
</script>

<template>
  <p class="strudel-flow-field__label">Chord symbols play as voiced notes.</p>
</template>
