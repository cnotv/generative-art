<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import GenericPanel from './GenericPanel.vue'
import SchemaControls from './ConfigControls.vue'
import ElementItem from './ElementItem.vue'
import ElementCamera from './ElementCamera.vue'
import ElementGroup from './ElementGroup.vue'
import ElementSpawn from './ElementSpawn.vue'
import IconButton from '@/components/IconButton.vue'
import { Button } from '@/components/ui/button'
import { Box, Camera, CheckSquare, ChevronDown, ChevronRight, Image, Square } from 'lucide-vue-next'
import type { Component } from 'vue'
import { useDebugSceneStore } from '@/stores/debugScene'
import { useElementPropertiesStore } from '@/stores/elementProperties'
import { storeToRefs } from 'pinia'
import { useTextureGroupsStore } from '@/stores/textureGroups'
import type { SceneElement } from '@/stores/debugScene'
import { ELEMENT_CATEGORIES, getElementCategory } from './elementUtilities'
import type { ElementCategory } from './elementUtilities'

interface Properties {
  isRecording?: boolean
  minDurationMs?: number
  maxDurationMs?: number
}

interface Emits {
  (e: 'start', durationMs: number): void
  (e: 'stop'): void
}

defineProps<Properties>()
const emit = defineEmits<Emits>()

const debugSceneStore = useDebugSceneStore()
const { sceneElements, sceneGroups, spawns } = storeToRefs(debugSceneStore)

const elementPropertiesStore = useElementPropertiesStore()
const { selectedElementName, activeProperties } = storeToRefs(elementPropertiesStore)
const { openElementProperties } = elementPropertiesStore
const textureStore = useTextureGroupsStore()

const expandedName = ref<string | null>(null)
const hiddenCategories = ref<Set<ElementCategory>>(new Set())

const allVisible = computed(() => hiddenCategories.value.size === 0)

const toggleCategory = (category: ElementCategory) => {
  const next = new Set(hiddenCategories.value)
  if (next.has(category)) {
    next.delete(category)
  } else {
    next.add(category)
  }
  hiddenCategories.value = next
}

const showAllCategories = () => {
  hiddenCategories.value = new Set()
}

const hideAllCategories = () => {
  hiddenCategories.value = new Set(ELEMENT_CATEGORIES.map((c) => c.category))
}

const isElementVisible = (element: SceneElement): boolean =>
  !hiddenCategories.value.has(getElementCategory(element)) && element.spawnId === undefined

const triggerFileUpload = (onchange: (event: Event) => void) => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = onchange
  input.click()
}

const handleElementClick = (element: SceneElement) => {
  expandedName.value = expandedName.value === element.name ? null : element.name
  if (expandedName.value) openElementProperties(element.name)
}

const handleGroupToggle = (groupId: string) => {
  expandedName.value = expandedName.value === groupId ? null : groupId
  if (expandedName.value) {
    openElementProperties(groupId)
    textureStore.handlers?.onSelectGroup(groupId)
  }
}

type AddElementType = 'camera' | 'mesh' | 'textureArea'

const addElement = (type: AddElementType) => {
  if (type === 'textureArea') {
    triggerFileUpload((e) => textureStore.handlers?.onAddNewGroup(e))
  } else {
    textureStore.handlers?.onAddElement(type)
  }
}

interface AddButton {
  type: AddElementType
  icon: Component
  label: string
  title: string
}

const addButtons: AddButton[] = [
  { type: 'camera', icon: Camera, label: 'New camera', title: 'Add a camera to the scene' },
  { type: 'mesh', icon: Box, label: 'Add model', title: 'Add a 3D model' },
  { type: 'textureArea', icon: Image, label: 'Add image', title: 'Load an image for stamping' }
]

const stampGroupId = ref<string | null>(null)
const isListOpen = ref(false)

const toggleStampGroup = (groupId: string) => {
  stampGroupId.value = stampGroupId.value === groupId ? null : groupId
  textureStore.handlers?.onStampGroupSelect?.(stampGroupId.value)
}

watch(
  () => textureStore.groups.length,
  () => {
    if (stampGroupId.value && !textureStore.groups.some((g) => g.id === stampGroupId.value)) {
      stampGroupId.value = null
      textureStore.handlers?.onStampGroupSelect?.(null)
    }
  }
)

const isCameraExpanded = computed(() => {
  if (!expandedName.value) return false
  if (activeProperties.value?.type === 'camera') return true
  return (
    sceneElements.value.find((e) => e.name === expandedName.value)?.type.includes('Camera') ?? false
  )
})

const grouped = computed(() => {
  const filtered = sceneElements.value.filter(isElementVisible)
  const ungrouped: SceneElement[] = []
  const meshGroups = new Map<string, SceneElement[]>()

  filtered.forEach((element) => {
    if (element.groupId !== undefined) {
      const existing = meshGroups.get(element.groupId) ?? []
      meshGroups.set(element.groupId, [...existing, element])
    } else {
      ungrouped.push(element)
    }
  })

  return { ungrouped, meshGroups }
})

const hasContent = computed(
  () => sceneElements.value.length > 0 || textureStore.groups.length > 0 || spawns.value.length > 0
)

const hasExpandedSchema = computed(
  () => Object.keys(activeProperties.value?.schema ?? {}).length > 0
)
</script>

<template>
  <GenericPanel panel-type="elements" side="left" title="Elements">
    <!-- Add bar -->
    <div class="elements-panel__add-bar">
      <Button
        v-for="btn in addButtons"
        :key="btn.type"
        variant="outline"
        size="sm"
        class="elements-panel__add-btn"
        :title="btn.title"
        @click="addElement(btn.type)"
      >
        <component :is="btn.icon" class="elements-panel__add-icon" />{{ btn.label }}
      </Button>
    </div>

    <!-- Filter bar -->
    <div class="elements-panel__filter-bar">
      <IconButton
        size="sm"
        variant="ghost"
        :class="{ 'elements-panel__filter-btn--active': allVisible }"
        :title="allVisible ? 'Hide all' : 'Show all'"
        @click="allVisible ? hideAllCategories() : showAllCategories()"
      >
        <CheckSquare v-if="allVisible" />
        <Square v-else />
      </IconButton>
      <span class="elements-panel__filter-separator" />
      <IconButton
        v-for="cat in ELEMENT_CATEGORIES"
        :key="cat.category"
        size="sm"
        variant="ghost"
        :class="{ 'elements-panel__filter-btn--active': !hiddenCategories.has(cat.category) }"
        :title="hiddenCategories.has(cat.category) ? `Show ${cat.label}` : `Hide ${cat.label}`"
        @click="toggleCategory(cat.category)"
      >
        <component :is="cat.icon" />
      </IconButton>
    </div>

    <!-- Image stamp palette -->
    <div v-if="textureStore.groups.length > 0" class="elements-panel__palette">
      <p class="elements-panel__palette-label">Stamp</p>
      <div class="elements-panel__palette-items">
        <button
          v-for="group in textureStore.groups"
          :key="group.id"
          class="elements-panel__palette-item"
          :class="{ 'elements-panel__palette-item--active': stampGroupId === group.id }"
          :title="
            stampGroupId === group.id ? `Cancel stamp: ${group.name}` : `Stamp: ${group.name}`
          "
          @click="toggleStampGroup(group.id)"
        >
          <img
            v-if="group.textures[0]"
            :src="group.textures[0].url"
            :alt="group.name"
            class="elements-panel__palette-thumb"
          />
          <span class="elements-panel__palette-name">{{ group.name }}</span>
        </button>
      </div>
    </div>

    <!-- Collapsible element list header -->
    <div
      class="elements-panel__list-header"
      role="button"
      tabindex="0"
      @click="isListOpen = !isListOpen"
      @keydown.enter.space.prevent="isListOpen = !isListOpen"
    >
      <component
        :is="isListOpen ? ChevronDown : ChevronRight"
        class="elements-panel__list-chevron"
      />
      <span class="elements-panel__list-title">Elements</span>
    </div>

    <p v-if="isListOpen && !hasContent" class="elements-panel__empty">No scene elements.</p>

    <div v-if="isListOpen && hasContent" class="elements-panel__list">
      <!-- Ungrouped scene elements -->
      <div
        v-for="(element, index) in grouped.ungrouped"
        :key="index"
        class="elements-panel__item"
        :class="[
          `elements-panel__item--${element.type.toLowerCase()}`,
          { 'opacity-50': element.hidden }
        ]"
      >
        <ElementItem
          :element="element"
          :selected="selectedElementName === element.name || expandedName === element.name"
          @click="handleElementClick(element)"
          @toggle-visibility="debugSceneStore.handleToggleVisibility(element.name)"
          @remove="debugSceneStore.handleRemove(element.name)"
        />

        <div
          v-if="expandedName === element.name"
          class="elements-panel__item-content"
          :class="`elements-panel__item-content--${element.type.toLowerCase()}`"
        >
          <p v-if="element.type === 'TextureArea'" class="elements-panel__type-description">
            Texture Area
          </p>

          <!-- Stamp billboard → area toggler -->
          <div v-if="element.type === 'Stamp'" class="elements-panel__stamp-convert">
            <span class="elements-panel__stamp-convert-label">Billboard</span>
            <button
              class="elements-panel__stamp-convert-btn"
              title="Convert to area distribution"
              @click="textureStore.handlers?.onConvertStampToArea?.(element.name)"
            >
              Convert to area
            </button>
          </div>

          <ElementCamera
            v-if="isCameraExpanded"
            :is-recording="isRecording"
            :min-duration-ms="minDurationMs"
            :max-duration-ms="maxDurationMs"
            @start="(ms: number) => emit('start', ms)"
            @stop="emit('stop')"
          />
          <template v-else>
            <SchemaControls
              v-if="hasExpandedSchema"
              :schema="activeProperties!.schema"
              :get-value="activeProperties!.getValue"
              :on-update="activeProperties!.updateValue"
            />
            <p v-else class="elements-panel__no-props">No configurable properties.</p>
          </template>
        </div>
      </div>

      <!-- Texture groups -->
      <ElementGroup
        v-for="[groupId] in grouped.meshGroups"
        :key="groupId"
        :group-id="groupId"
        :label="sceneGroups[groupId] ?? `Group ${groupId.slice(0, 6)}`"
        :is-expanded="expandedName === groupId"
        :is-selected="selectedElementName === groupId"
        @toggle="handleGroupToggle(groupId)"
      />

      <!-- Spawns -->
      <ElementSpawn
        v-for="spawn in spawns"
        :key="spawn.id"
        :spawn-id="spawn.id"
        :label="spawn.label"
        :is-expanded="expandedName === spawn.id"
        :is-selected="selectedElementName === spawn.id"
        :hidden="spawn.hidden ?? false"
        @toggle="
          expandedName === spawn.id
            ? (expandedName = null)
            : ((expandedName = spawn.id), openElementProperties(spawn.id))
        "
      />
    </div>
  </GenericPanel>
</template>

<style scoped>
.elements-panel__add-bar {
  display: flex;
  align-items: center;
  gap: var(--spacing-1-5);
  padding-bottom: var(--spacing-2);
  border-bottom: 1px solid var(--color-border);
  margin-bottom: var(--spacing-1-5);
  flex-wrap: wrap;
}

.elements-panel__add-btn {
  height: var(--btn-sm-height);
  padding: 0 var(--spacing-2);
  font-size: var(--font-size-xs);
  gap: var(--spacing-1);
}

.elements-panel__add-icon {
  width: var(--font-size-sm);
  height: var(--font-size-sm);
  flex-shrink: 0;
}

.elements-panel__filter-bar {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
  padding-bottom: var(--spacing-2);
  border-bottom: 1px solid var(--color-border);
  margin-bottom: var(--spacing-1-5);
}

.elements-panel__filter-separator {
  width: 1px;
  height: var(--btn-sm-height);
  background: var(--color-border);
  flex-shrink: 0;
}

.elements-panel__filter-btn--active {
  color: var(--color-foreground);
  opacity: 1;
}

.elements-panel__filter-bar .icon-btn:not(.elements-panel__filter-btn--active) {
  opacity: var(--opacity-muted);
}

.elements-panel__palette {
  padding-bottom: var(--spacing-2);
  border-bottom: 1px solid var(--color-border);
  margin-bottom: var(--spacing-1-5);
}

.elements-panel__palette-label {
  font-size: var(--font-size-xs);
  color: var(--color-muted-foreground);
  margin: 0 0 var(--spacing-1);
}

.elements-panel__palette-items {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-1);
}

.elements-panel__palette-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-0-5);
  padding: var(--spacing-1);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-secondary);
  cursor: pointer;
  width: 4rem;
}

.elements-panel__palette-item:hover {
  border-color: var(--color-muted-foreground);
}

.elements-panel__palette-item--active {
  border-color: var(--color-primary);
  background: var(--color-muted);
}

.elements-panel__palette-thumb {
  width: 3rem;
  height: 3rem;
  object-fit: cover;
  border-radius: var(--radius-xs, 2px);
}

.elements-panel__palette-name {
  font-size: var(--font-size-xs);
  color: var(--color-muted-foreground);
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  width: 100%;
  text-align: center;
}

.elements-panel__list-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
  padding: var(--spacing-1) 0;
  cursor: pointer;
  user-select: none;
  color: var(--color-muted-foreground);
  font-size: var(--font-size-xs);
  font-weight: 500;
}

.elements-panel__list-header:hover {
  color: var(--color-foreground);
}

.elements-panel__list-chevron {
  width: var(--font-size-sm);
  height: var(--font-size-sm);
  flex-shrink: 0;
}

.elements-panel__list-title {
  flex: 1;
}

.elements-panel__stamp-convert {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-2);
  padding: var(--spacing-1) 0;
}

.elements-panel__stamp-convert-label {
  font-size: var(--font-size-xs);
  color: var(--color-muted-foreground);
}

.elements-panel__stamp-convert-btn {
  font-size: var(--font-size-xs);
  padding: var(--spacing-1) var(--spacing-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-secondary);
  color: var(--color-foreground);
  cursor: pointer;
}

.elements-panel__stamp-convert-btn:hover {
  background: var(--color-muted);
  border-color: var(--color-primary);
}

.elements-panel__empty {
  font-size: var(--font-size-base);
  color: var(--color-foreground);
  opacity: var(--opacity-muted);
  margin: 0;
  padding: var(--spacing-2) 0;
}

.elements-panel__no-props {
  font-size: var(--font-size-sm);
  color: var(--color-foreground);
  opacity: var(--opacity-muted);
  padding: var(--spacing-2) var(--spacing-1);
  margin: 0;
}

.elements-panel__list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.elements-panel__item {
  border-radius: var(--radius);
  border: 1px solid var(--color-border);
  overflow: hidden;
}

.elements-panel__item-content {
  border-top: 1px solid var(--color-border);
  padding: var(--spacing-2);
  background: var(--panel-content-bg);
}

.elements-panel__type-description {
  font-size: var(--font-size-xs);
  color: var(--color-muted-foreground);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 var(--spacing-2);
}
</style>
