<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import GenericPanel from './GenericPanel.vue'
import SchemaControls from './ConfigControls.vue'
import ElementItem from './ElementItem.vue'
import ElementCamera from './ElementCamera.vue'
import ElementGroup from './ElementGroup.vue'
import ElementSpawn from './ElementSpawn.vue'
import ElementInstancedGroup from './ElementInstancedGroup.vue'
import ElementSpawnGroup from './ElementSpawnGroup.vue'
import ElementPathSection from './ElementPathSection.vue'
import IconButton from '@/components/IconButton.vue'
import { Box, Camera, CheckSquare, Image, Plus, Route, Square } from 'lucide-vue-next'
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
const { sceneElements, sceneGroups, spawns, instancedGroups, spawnGroups, paths } =
  storeToRefs(debugSceneStore)

const elementPropertiesStore = useElementPropertiesStore()
const { selectedElementName, activeProperties, selectionRequestNonce } =
  storeToRefs(elementPropertiesStore)
const { openElementProperties } = elementPropertiesStore
const textureStore = useTextureGroupsStore()

const expandedName = ref<string | null>(null)
const hiddenCategories = ref<Set<ElementCategory>>(new Set())

// Expand the element requested from outside the panel (e.g. a click in the scene).
watch(selectionRequestNonce, () => {
  if (selectedElementName.value) expandedName.value = selectedElementName.value
})

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

const handleSpawnGroupToggle = (groupId: string) => {
  expandedName.value = expandedName.value === groupId ? null : groupId
  if (expandedName.value) openElementProperties(groupId)
}

const pathByElement = computed(() => new Map(paths.value.map((p) => [p.elementName, p])))

const canHavePath = (element: SceneElement): boolean =>
  !!debugSceneStore.enablePathForElement &&
  getElementCategory(element) === 'mesh' &&
  !element.name.toLowerCase().includes('camera')

type AddElementType = 'camera' | 'mesh' | 'textureArea'

const addMenuOpen = ref(false)

const addElement = (type: AddElementType) => {
  addMenuOpen.value = false
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
  { type: 'camera', icon: Camera, label: 'Camera', title: 'Add Camera' },
  { type: 'mesh', icon: Box, label: 'Mesh', title: 'Add Mesh' },
  { type: 'textureArea', icon: Image, label: 'Texture', title: 'Add Texture Area' }
]

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
  () =>
    sceneElements.value.length > 0 ||
    textureStore.groups.length > 0 ||
    spawns.value.length > 0 ||
    instancedGroups.value.length > 0 ||
    spawnGroups.value.length > 0 ||
    paths.value.length > 0
)

const hasExpandedSchema = computed(
  () => Object.keys(activeProperties.value?.schema ?? {}).length > 0
)
</script>

<template>
  <GenericPanel panel-type="elements" side="left" title="Elements">
    <!-- Filter bar -->
    <div class="elements-panel__filter-bar">
      <IconButton
        size="xs"
        panel-colors
        :active="allVisible"
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
        size="xs"
        panel-colors
        :active="!hiddenCategories.has(cat.category)"
        :title="hiddenCategories.has(cat.category) ? `Show ${cat.label}` : `Hide ${cat.label}`"
        @click="toggleCategory(cat.category)"
      >
        <component :is="cat.icon" />
      </IconButton>

      <div class="elements-panel__add">
        <IconButton
          size="xs"
          panel-colors
          :active="addMenuOpen"
          title="Add element"
          @click="addMenuOpen = !addMenuOpen"
        >
          <Plus />
        </IconButton>
        <template v-if="addMenuOpen">
          <button
            class="elements-panel__add-backdrop"
            aria-label="Close add menu"
            @click="addMenuOpen = false"
          />
          <div class="elements-panel__add-menu">
            <button
              v-for="btn in addButtons"
              :key="btn.type"
              class="elements-panel__add-option"
              :title="btn.title"
              @click="addElement(btn.type)"
            >
              <component :is="btn.icon" class="elements-panel__add-option-icon" />
              <span>{{ btn.label }}</span>
            </button>
          </div>
        </template>
      </div>
    </div>

    <p v-if="!hasContent" class="elements-panel__empty">No scene elements.</p>

    <div v-else class="elements-panel__list">
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
          :has-path="pathByElement.has(element.name)"
          @click="handleElementClick(element)"
          @toggle-visibility="debugSceneStore.handleToggleVisibility(element.name)"
          @remove="debugSceneStore.handleRemove(element.name)"
        />

        <div
          v-if="expandedName === element.name"
          class="elements-panel__item-content"
          :class="`elements-panel__item-content--${element.type.toLowerCase()}`"
        >
          <p class="elements-panel__type-description">{{ element.type }}</p>
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
            <p v-else-if="!pathByElement.has(element.name)" class="elements-panel__no-props">
              No configurable properties.
            </p>
          </template>

          <ElementPathSection
            v-if="pathByElement.has(element.name)"
            :path="pathByElement.get(element.name)!"
          />
          <button
            v-else-if="canHavePath(element)"
            class="elements-panel__enable-path"
            @click="debugSceneStore.enablePathForElement(element.name)"
          >
            <Route class="elements-panel__enable-path-icon" />
            <span>Enable path</span>
          </button>
        </div>
      </div>

      <!-- Instanced mesh groups -->
      <ElementInstancedGroup
        v-for="group in instancedGroups"
        :key="group.id"
        :group="group"
        :is-expanded="expandedName === group.id"
        @toggle="expandedName = expandedName === group.id ? null : group.id"
      />

      <!-- Spawn groups -->
      <ElementSpawnGroup
        v-for="group in spawnGroups"
        :key="group.id"
        :group="group"
        :is-expanded="expandedName === group.id"
        @toggle="handleSpawnGroupToggle(group.id)"
      />

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
.elements-panel__filter-bar {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
  padding: var(--spacing-1);
  margin-bottom: var(--spacing-1-5);
  background: var(--panel-item-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.elements-panel__filter-separator {
  width: 1px;
  height: var(--btn-xs-height);
  background: var(--color-border);
  flex-shrink: 0;
}

.elements-panel__add {
  position: relative;
  margin-left: auto;
}

.elements-panel__add-backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--z-dropdown);
  background: transparent;
  border: none;
  padding: 0;
  cursor: default;
}

.elements-panel__add-menu {
  position: absolute;
  top: calc(100% + var(--spacing-1));
  right: 0;
  z-index: var(--z-dropdown);
  display: flex;
  flex-direction: column;
  min-width: var(--dropdown-min-width);
  padding: var(--spacing-1);
  gap: var(--spacing-0-5);
  background: var(--panel-content-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-lg);
}

.elements-panel__add-option {
  display: flex;
  align-items: center;
  gap: var(--spacing-1-5);
  padding: var(--spacing-1) var(--spacing-1-5);
  font-size: var(--font-size-xs);
  color: var(--color-foreground);
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  text-align: left;
  transition: background-color 100ms;
}

.elements-panel__add-option:hover {
  background-color: var(--panel-item-bg-hover);
}

.elements-panel__add-option-icon {
  width: var(--font-size-md);
  height: var(--font-size-md);
  flex-shrink: 0;
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

.elements-panel__enable-path {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-1);
  width: 100%;
  margin-top: var(--spacing-2);
  padding: var(--spacing-1);
  font-size: var(--font-size-xs);
  color: var(--color-muted-foreground);
  background: transparent;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background-color 100ms;
}

.elements-panel__enable-path:hover {
  background-color: var(--panel-item-bg-hover);
  color: var(--color-foreground);
}

.elements-panel__enable-path-icon {
  width: var(--font-size-sm);
  height: var(--font-size-sm);
  flex-shrink: 0;
}

.elements-panel__list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-0-5);
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
