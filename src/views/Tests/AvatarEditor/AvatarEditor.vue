<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { registerViewConfig, unregisterViewConfig, createReactiveConfig } from '@/stores/viewConfig'
import { useViewPanelsStore } from '@/stores/viewPanels'
import { usePanelsStore } from '@/stores/panels'
import { AvatarEditor } from '@/components/AvatarEditor'
import { createStickmanPartOffsets } from '@/utils/stickmanRig'
import type { AvatarEditorConfig } from '@/types/avatarEditor'
import { DEFAULT_CONFIG } from '@/views/Tests/MaterialsList/materialsListConfig'
import { AVATAR_CONFIG_CONTROLS, DEFAULT_MAP_STRENGTHS, DEFAULT_MATERIAL_TYPE } from './config'

const route = useRoute()
const { setViewPanels, clearViewPanels } = useViewPanelsStore()
const editor = ref<InstanceType<typeof AvatarEditor> | null>(null)

const reactiveConfig = createReactiveConfig<AvatarEditorConfig>({
  materialType: DEFAULT_MATERIAL_TYPE,
  strengths: { ...DEFAULT_MAP_STRENGTHS },
  materials: { ...DEFAULT_CONFIG },
  parts: createStickmanPartOffsets()
})

// Limb nudges are watched inside the editor and pushed straight onto the rig's
// own nodes, so only the material side needs rebuilding when a control moves.
const handleConfigChange = (): void => editor.value?.rebuildMaterial()

// Opened during setup rather than on mount: the editor teleports its painting
// toolbar into the config panel, and a child mounts before its parent, so
// waiting until onMounted leaves that panel with no DOM to teleport into.
setViewPanels({ showConfig: true })
usePanelsStore().openPanel('config')

onMounted(() => {
  registerViewConfig(
    route.name as string,
    reactiveConfig as never,
    AVATAR_CONFIG_CONTROLS,
    handleConfigChange
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
