<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { PanelRightClose, PanelRightOpen, Play, RefreshCw, Square } from 'lucide-vue-next'
import IconButton from '@/components/IconButton.vue'
import ButtonSelector from '@/components/ui/button-selector/ButtonSelector.vue'
import { FLOW_SYNC_DELAY_MS, STRUDEL_LICENSE_NOTE } from './config'
import { STRUDEL_FLOW_EDITOR_MODE_OPTIONS } from '@webgamekit/strudel-flow'
import { useStrudelFlow } from '@webgamekit/strudel-flow'
import { useStrudelEditor } from './useStrudelEditor'
import { useStrudelHints } from './hints/useStrudelHints'
import type { StrudelEditorMode, StrudelTabId } from './types'
import HintsTab from './tabs/HintsTab.vue'
import WelcomeTab from './tabs/WelcomeTab.vue'
import PatternsTab from './tabs/PatternsTab.vue'
import ImportTab from './tabs/ImportTab.vue'
import MidiTab from './tabs/MidiTab.vue'
import StrudelCodeEditor from './StrudelCodeEditor.vue'
import ReferenceTab from './tabs/ReferenceTab.vue'
import ExportTab from './tabs/ExportTab.vue'
import ConsoleTab from './tabs/ConsoleTab.vue'
import SettingsTab from './tabs/SettingsTab.vue'
import FlowTab from './tabs/FlowTab.vue'

// Vue Flow is a large canvas library and only loads when the player opens flow mode.
const StrudelFlowEditor = defineAsyncComponent(() =>
  import('@webgamekit/strudel-flow').then((module) => module.StrudelFlowEditor)
)

const {
  patternCode,
  editorStatus,
  hasUnplayedChanges,
  errorMessage,
  examples,
  electroTunes,
  logEntries,
  activeTab,
  tabList,
  selectPattern,
  savedPatterns,
  savePattern,
  deleteSavedPattern,
  updatePatternCode,
  playPattern,
  stopPattern,
  setActiveTab,
  clearLogEntries,
  attachEditor,
  transcriptionStatus,
  transcriptionProgress,
  transcriptionResult,
  transcribedCode,
  transcriptionError,
  transcribeFile,
  exportStatus,
  exportError,
  exportPattern,
  repetitionCycles,
  measureRepetition,
  loadTranscription
} = useStrudelEditor()

const {
  nodes: flowNodes,
  edges: flowEdges,
  beatsPerMinute: flowBeatsPerMinute,
  beatsPerCycle: flowBeatsPerCycle,
  compilation: flowCompilation,
  addNode: addFlowNode,
  updateNodeData: updateFlowNodeData,
  removeNode: removeFlowNode,
  connectNodes: connectFlowNodes,
  setBeatsPerMinute: setFlowBeatsPerMinute,
  setBeatsPerCycle: setFlowBeatsPerCycle,
  resetPatch: resetFlowPatch,
  loadCode: loadFlowCode
} = useStrudelFlow()

const editorMode = ref<StrudelEditorMode>('code')
const sidePanelCollapsed = ref(false)
let flowPlaybackTimer: number | null = null
let codeParseTimer: number | null = null

const clearTimer = (timer: number | null): null => {
  if (timer !== null) {
    window.clearTimeout(timer)
  }
  return null
}

const scheduleFlowPlayback = (): void => {
  flowPlaybackTimer = clearTimer(flowPlaybackTimer)
  flowPlaybackTimer = window.setTimeout(() => {
    flowPlaybackTimer = null
    if (editorStatus.value === 'playing') {
      void playPattern()
    }
  }, FLOW_SYNC_DELAY_MS)
}

// The flow writes its compilation into the code; that text is already the graph.
const isFlowEcho = (code: string): boolean => code === flowCompilation.value.code

// Code is the source of truth: once typing pauses on code that parses, the graph follows it.
loadFlowCode(patternCode.value)
watch(patternCode, (code) => {
  codeParseTimer = clearTimer(codeParseTimer)
  if (isFlowEcho(code)) {
    return
  }
  codeParseTimer = window.setTimeout(() => {
    codeParseTimer = null
    loadFlowCode(code)
  }, FLOW_SYNC_DELAY_MS)
})

// Opening the canvas mid-pause shows the code as typed, never a graph a moment behind it.
const openFlowMode = (): void => {
  if (codeParseTimer !== null) {
    codeParseTimer = clearTimer(codeParseTimer)
    loadFlowCode(patternCode.value)
  }
  editorMode.value = 'flow'
}

// Every change made on the canvas, keyboard deletes included, writes the code and re-plays it.
// A patch that cannot compile keeps the last playable code and shows its error instead.
watch(
  () => flowCompilation.value.code,
  (compiledCode) => {
    if (editorMode.value !== 'flow' || compiledCode.length === 0) {
      return
    }
    codeParseTimer = clearTimer(codeParseTimer)
    if (compiledCode !== patternCode.value) {
      updatePatternCode(compiledCode)
    }
    scheduleFlowPlayback()
  }
)

const flowErrorMessage = computed(() =>
  editorMode.value === 'flow' ? flowCompilation.value.errorMessage : null
)

const { musicStyles, pickedStyleId, styleDetection, hints, pickStyle, applyHint } = useStrudelHints(
  patternCode,
  updatePatternCode
)

const readAnchor = (): string => decodeURIComponent(window.location.hash.slice(1))

const findTab = (anchor: string): StrudelTabId | undefined =>
  tabList.find((tab) => tab.id === anchor)?.id

// Every tab and every pattern has its own anchor, so either can be linked to, and Back steps
// through them. Tab ids never collide with pattern ids, which saved patterns prefix.
const loadAnchor = (): void => {
  const anchor = readAnchor()
  const tabId = findTab(anchor)
  if (tabId !== undefined) {
    onTabSelected(tabId)
    return
  }
  if (selectPattern(anchor)) {
    editorMode.value = 'code'
  }
}

const onPatternSelected = (patternId: string): void => {
  if (selectPattern(patternId)) {
    editorMode.value = 'code'
  }
}

onMounted(() => {
  loadAnchor()
  window.addEventListener('hashchange', loadAnchor)
})

const onPlayRequested = (): void => {
  if (flowErrorMessage.value !== null) {
    return
  }
  void playPattern()
}

const onStopRequested = (): void => {
  void stopPattern()
}

// One button above the editor: Play when idle, Stop while playing, and Update once the code has
// changed since it started, which swaps the old pattern for the new one.
const playButtonAction = computed(() => {
  if (editorStatus.value !== 'playing') {
    return 'Play'
  }
  return hasUnplayedChanges.value ? 'Update' : 'Stop'
})

const onPlayButtonPressed = (): void => {
  if (playButtonAction.value === 'Stop') {
    onStopRequested()
    return
  }
  onPlayRequested()
}

const onFileChosen = (chosenFile: File): void => {
  void transcribeFile(chosenFile)
}

const onEditorModeChange = (mode: string): void => {
  if (mode !== 'flow') {
    editorMode.value = 'code'
    return
  }
  openFlowMode()
  setActiveTab('flow')
}

const onTabSelected = (tabId: StrudelTabId): void => {
  setActiveTab(tabId)
  if (tabId === 'flow') {
    openFlowMode()
  }
}

const onFlowNodesConnected = (sourceNodeId: string, targetNodeId: string): void => {
  connectFlowNodes(sourceNodeId, targetNodeId)
}

// Before unmounting, while the code editor and its canvas are still there to clear.
onBeforeUnmount(() => {
  window.removeEventListener('hashchange', loadAnchor)
  flowPlaybackTimer = clearTimer(flowPlaybackTimer)
  codeParseTimer = clearTimer(codeParseTimer)
  void stopPattern()
})
</script>

<template>
  <div class="strudel-editor" :class="{ 'strudel-editor--side-collapsed': sidePanelCollapsed }">
    <section class="strudel-editor__code" aria-label="Code">
      <header class="strudel-editor__code-header">
        <p class="strudel-editor__label">
          {{ editorMode === 'flow' ? 'Flow patch' : 'Live code pattern' }}
        </p>
        <div class="strudel-editor__code-actions">
          <div class="strudel-editor__mode" role="group" aria-label="Editor mode">
            <ButtonSelector
              :model-value="editorMode"
              :options="STRUDEL_FLOW_EDITOR_MODE_OPTIONS"
              @update:model-value="onEditorModeChange"
            />
          </div>
          <IconButton
            size="md"
            variant="ghost"
            :title="sidePanelCollapsed ? 'Show side panel' : 'Hide side panel'"
            :aria-label="sidePanelCollapsed ? 'Show side panel' : 'Hide side panel'"
            @click="sidePanelCollapsed = !sidePanelCollapsed"
          >
            <PanelRightOpen v-if="sidePanelCollapsed" aria-hidden="true" />
            <PanelRightClose v-else aria-hidden="true" />
          </IconButton>
          <IconButton
            class="strudel-editor__play"
            size="md"
            variant="default"
            :title="playButtonAction"
            :aria-label="playButtonAction"
            @click="onPlayButtonPressed"
          >
            <Square v-if="playButtonAction === 'Stop'" aria-hidden="true" />
            <RefreshCw v-else-if="playButtonAction === 'Update'" aria-hidden="true" />
            <Play v-else aria-hidden="true" />
          </IconButton>
        </div>
      </header>
      <StrudelCodeEditor
        v-show="editorMode === 'code'"
        class="strudel-editor__code-editor"
        :code="patternCode"
        @update:code="updatePatternCode"
        @evaluate="onPlayRequested"
        @stop="onStopRequested"
        @ready="attachEditor"
      />
      <div v-if="editorMode === 'flow'" class="strudel-editor__flow">
        <StrudelFlowEditor
          v-model:nodes="flowNodes"
          v-model:edges="flowEdges"
          :beats-per-minute="flowBeatsPerMinute"
          :beats-per-cycle="flowBeatsPerCycle"
          @connect="onFlowNodesConnected"
          @update-node="updateFlowNodeData"
          @remove-node="removeFlowNode"
          @add-node="addFlowNode"
          @update:beats-per-minute="setFlowBeatsPerMinute"
          @update:beats-per-cycle="setFlowBeatsPerCycle"
        />
      </div>
      <p v-if="editorMode === 'code'" class="strudel-editor__hint">
        Ctrl+Enter plays the code, Ctrl+. stops it.
      </p>
      <p v-else class="strudel-editor__hint">
        Drag a node by its header to arrange it; drag from an output dot into an effect input to
        route it.
      </p>
      <p v-if="flowErrorMessage !== null" class="strudel-editor__error" role="alert">
        {{ flowErrorMessage }}
      </p>
      <p v-if="editorStatus === 'error'" class="strudel-editor__error" role="alert">
        {{ errorMessage || 'Pattern failed to evaluate.' }}
      </p>
    </section>

    <section class="strudel-editor__side" aria-label="Player">
      <div class="strudel-editor__panel">
        <div class="strudel-editor__tabs" role="tablist">
          <a
            v-for="tab in tabList"
            :key="tab.id"
            class="strudel-editor__tab"
            :class="{ 'strudel-editor__tab--active': activeTab === tab.id }"
            role="tab"
            :aria-selected="activeTab === tab.id"
            :href="`#${tab.id}`"
            @click="onTabSelected(tab.id)"
          >
            {{ tab.label }}
          </a>
        </div>
        <div class="strudel-editor__panel-content">
          <HintsTab
            v-if="activeTab === 'hints'"
            :music-styles="musicStyles"
            :picked-style-id="pickedStyleId"
            :detection="styleDetection"
            :hints="hints"
            @pick="pickStyle"
            @apply="applyHint"
          />
          <WelcomeTab v-else-if="activeTab === 'welcome'" />
          <PatternsTab
            v-else-if="activeTab === 'patterns'"
            :saved-patterns="savedPatterns"
            :examples="examples"
            :electro-tunes="electroTunes"
            :current-code="patternCode"
            @select="onPatternSelected"
            @save="savePattern"
            @delete="deleteSavedPattern"
          />
          <ImportTab
            v-else-if="activeTab === 'import'"
            :status="transcriptionStatus"
            :progress="transcriptionProgress"
            :result="transcriptionResult"
            :code="transcribedCode"
            :error-message="transcriptionError"
            @file="onFileChosen"
            @load="loadTranscription"
          />
          <MidiTab v-else-if="activeTab === 'midi'" @code="updatePatternCode" />
          <ReferenceTab v-else-if="activeTab === 'reference'" />
          <ExportTab
            v-else-if="activeTab === 'export'"
            :status="exportStatus"
            :error-message="exportError"
            :repetition-cycles="repetitionCycles"
            @export="exportPattern"
            @measure-repetition="measureRepetition"
          />
          <ConsoleTab
            v-else-if="activeTab === 'console'"
            :log-entries="logEntries"
            @clear="clearLogEntries"
          />
          <FlowTab
            v-else-if="activeTab === 'flow'"
            @add-node="addFlowNode"
            @reset="resetFlowPatch"
          />
          <SettingsTab v-else />
        </div>
      </div>

      <p class="strudel-editor__license">{{ STRUDEL_LICENSE_NOTE }}</p>
    </section>
  </div>
</template>

<style scoped>
/*
 * html and body never scroll in this app (src/style.css, for the full-screen 3D views), so
 * the view fills the viewport and each column scrolls on its own.
 */
.strudel-editor {
  box-sizing: border-box;
  height: 100dvh;
  padding: var(--nav-height) var(--spacing-4) var(--spacing-4);
  display: grid;
  grid-template-columns: minmax(0, 1fr) clamp(17rem, 24vw, 22rem);
  grid-template-areas: 'code side';
  gap: var(--spacing-4);
}

.strudel-editor__code {
  grid-area: code;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  min-height: 0;
  padding-top: var(--spacing-4);
}

.strudel-editor__code-editor {
  flex: 1;
  min-height: 0;
}

.strudel-editor__flow {
  display: grid;
  grid-template-rows: minmax(0, 1fr);
  grid-template-columns: minmax(0, 1fr);
  flex: 1;
  min-height: 0;
}

.strudel-editor__side {
  grid-area: side;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
  min-width: 0;
  min-height: 0;
  padding-top: var(--spacing-4);
  overflow-y: auto;
}

@media (width <= 900px) {
  .strudel-editor {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: 70dvh max-content;
    grid-template-areas:
      'code'
      'side';
    overflow-y: auto;
  }

  .strudel-editor__side {
    overflow-y: visible;
  }
}

.strudel-editor--side-collapsed {
  grid-template-columns: minmax(0, 1fr) 0;
  gap: 0;
}

.strudel-editor--side-collapsed .strudel-editor__side {
  display: none;
}

@media (width <= 900px) {
  .strudel-editor--side-collapsed {
    grid-template-rows: minmax(0, 1fr);
  }
}

.strudel-editor__label {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-muted-foreground);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.strudel-editor__hint {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-muted-foreground);
}

.strudel-editor__error {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-destructive);
}

.strudel-editor__code-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-2);
}

.strudel-editor__code-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

.strudel-editor__play {
  border-radius: var(--radius-full);
}

.strudel-editor__panel {
  flex: 1 0 auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 20rem;
}

.strudel-editor__tabs {
  display: flex;
  flex-wrap: wrap;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-secondary);
}

.strudel-editor__tab {
  padding: var(--spacing-2) var(--spacing-3);
  text-decoration: none;
  border: none;
  background: transparent;
  color: var(--color-muted-foreground);
  font-size: var(--font-size-md);
  cursor: pointer;
  white-space: nowrap;
  border-bottom: 2px solid transparent;
}

.strudel-editor__tab--active {
  color: var(--color-foreground);
  border-bottom-color: var(--color-primary);
}

.strudel-editor__tab:hover {
  color: var(--color-foreground);
}

.strudel-editor__panel-content {
  flex: 1;
  overflow-y: auto;
}

.strudel-editor__license {
  font-size: var(--font-size-sm);
  color: var(--color-muted-foreground);
  margin: 0;
}
</style>
