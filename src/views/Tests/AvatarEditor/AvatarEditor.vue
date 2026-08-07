<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { registerViewConfig, unregisterViewConfig, createReactiveConfig } from '@/stores/viewConfig'
import { useViewPanelsStore } from '@/stores/viewPanels'
import { usePanelsStore } from '@/stores/panels'
import { AvatarEditor } from '@/components/AvatarEditor'
import { createStickmanPartOffsets } from '@/utils/stickmanRig'
import type { AvatarEditorConfig } from '@/types/avatarEditor'
import { AVATAR_CONFIG_CONTROLS } from './config'

const route = useRoute()
const { setViewPanels, clearViewPanels } = useViewPanelsStore()
const editor = ref<InstanceType<typeof AvatarEditor> | null>(null)

const defaultConfig = (): AvatarEditorConfig => ({
  opacity: 1,
  showGuide: true,
  parts: createStickmanPartOffsets()
})

const reactiveConfig = createReactiveConfig<AvatarEditorConfig>(defaultConfig())

// Limb nudges live here while the painted maps live in the editor, so putting
// them both back is the only thing that genuinely spans the two.
const discardChanges = (): void => {
  reactiveConfig.value = defaultConfig()
  editor.value?.discardPaintedTextures()
}

// Opened during setup rather than on mount: the editor teleports its painting
// toolbar into the config panel, and a child mounts before its parent, so
// waiting until onMounted leaves that panel with no DOM to teleport into.
setViewPanels({ showConfig: true })
usePanelsStore().openPanel('config')

onMounted(() => {
  // Every value here is watched inside the editor and pushed straight onto the
  // rig, so there is no change handler rebuilding anything.
  registerViewConfig(
    route.name as string,
    reactiveConfig as never,
    AVATAR_CONFIG_CONTROLS,
    () => {},
    {
      toggleWalk: () => editor.value?.toggleWalk(),
      discardChanges
    }
  )
})

onBeforeUnmount(() => {
  clearViewPanels()
  unregisterViewConfig(route.name as string)
})
</script>

<template>
  <AvatarEditor ref="editor" :config="reactiveConfig" />
</template>
