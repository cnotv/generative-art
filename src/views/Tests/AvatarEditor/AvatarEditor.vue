<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'
import { useViewPanelsStore } from '@/stores/viewPanels'
import { AvatarEditor } from '@/components/AvatarEditor'

const { setViewPanels, clearViewPanels } = useViewPanelsStore()

// The editor carries its own controls, so nothing is registered here. The
// config panel stays available all the same: the global scene settings live in
// it and belong to every view, not to this one.
onMounted(() => setViewPanels({ showConfig: true }))
onBeforeUnmount(() => clearViewPanels())
</script>

<template>
  <AvatarEditor />
</template>
