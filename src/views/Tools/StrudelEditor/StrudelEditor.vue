<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch
} from 'vue'
import {
  Boxes,
  Cable,
  CircleHelp,
  Music,
  Save,
  Settings,
  Terminal,
  Volume2,
  X
} from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'
import IconButton from '@/components/IconButton.vue'
import ButtonSelector from '@/components/ui/button-selector/ButtonSelector.vue'
import { FLOW_SYNC_DELAY_MS, STRUDEL_LICENSE_NOTE } from './config'
import { STRUDEL_FLOW_EDITOR_MODE_OPTIONS } from '@webgamekit/strudel-flow'
import { findStrudelFlowNodeCode, useStrudelFlow } from '@webgamekit/strudel-flow'
import { useStrudelEditor } from './useStrudelEditor'
import { readLegacyStrudelAnchor, readStrudelAddress, writeStrudelAddress } from './strudelAddress'
import { useStrudelHints } from './hints/useStrudelHints'
import { readStrudelNoteBars } from './noteBars'
import { useStrudelSounds } from './useStrudelSounds'
import { previewStrudelSound } from './strudelPlayback'
import type { StrudelEditorMode, StrudelSoundEntry, StrudelTabId } from './types'
import FlowTab from './tabs/FlowTab.vue'
import HintsTab from './tabs/HintsTab.vue'
import PatternLibrary from './tabs/PatternLibrary.vue'
import SoundsTab from './tabs/SoundsTab.vue'
import ImportTab from './tabs/ImportTab.vue'
import MidiTab from './tabs/MidiTab.vue'
import StrudelCodeEditor from './StrudelCodeEditor.vue'
import ExportTab from './tabs/ExportTab.vue'
import ConsoleTab from './tabs/ConsoleTab.vue'
import SettingsTab from './tabs/SettingsTab.vue'
import StrudelTimeline from './timeline/StrudelTimeline.vue'

// Vue Flow is a large canvas library and only loads when the player opens flow mode.
const StrudelFlowEditor = defineAsyncComponent(() =>
  import('@webgamekit/strudel-flow').then((module) => module.StrudelFlowEditor)
)

const {
  patternCode,
  editorStatus,
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
  playLoadedPattern,
  stopPattern,
  setActiveTab,
  clearLogEntries,
  attachEditor,
  transcriptionStatus,
  transcriptionProgress,
  importedTranscriptions,
  transcribedCode,
  transcriptionWarnings,
  transcriptionError,
  addVisualizer,
  transcribeFiles,
  removeTranscription,
  addTranscription,
  exportStatus,
  exportError,
  exportPattern,
  repetitionCycles,
  measureRepetition,
  loadTranscription,
  playheadCycle,
  timelineBars,
  cyclesPerSecond,
  loopBars,
  loopMeasured,
  seekToCycle,
  holdPlayingPosition
} = useStrudelEditor()

const {
  nodes: flowNodes,
  edges: flowEdges,
  beatsPerMinute: flowBeatsPerMinute,
  beatsPerCycle: flowBeatsPerCycle,
  compilation: flowCompilation,
  resetPatch: resetFlowPatch,
  addNode: addFlowNode,
  updateNodeData: updateFlowNodeData,
  removeNode: removeFlowNode,
  connectNodes: connectFlowNodes,
  setBeatsPerMinute: setFlowBeatsPerMinute,
  setBeatsPerCycle: setFlowBeatsPerCycle,
  loadCode: loadFlowCode
} = useStrudelFlow()

const editorMode = ref<StrudelEditorMode>('code')
const { soundEntries, sampleGroups, voiceGroups, soundsStatus, loadSounds } = useStrudelSounds()

// The sound list registers the whole library, so it loads only once something shows it.
watch(
  [activeTab, editorMode],
  ([tabId, mode]) => {
    if (tabId === 'sounds' || mode === 'flow') {
      void loadSounds()
    }
  },
  { immediate: true }
)

const onSoundPreview = (soundEntry: StrudelSoundEntry): void => {
  // A sound that cannot play has nothing to recover; the click simply stays silent.
  previewStrudelSound(soundEntry.name, soundEntry.type).catch(() => undefined)
}
let replayTimer: number | null = null
let codeParseTimer: number | null = null

const clearTimer = (timer: number | null): null => {
  if (timer !== null) {
    window.clearTimeout(timer)
  }
  return null
}

const scheduleReplay = (): void => {
  replayTimer = clearTimer(replayTimer)
  replayTimer = window.setTimeout(() => {
    replayTimer = null
    if (editorStatus.value === 'playing' || editorStatus.value === 'error') {
      void playPattern()
    }
  }, FLOW_SYNC_DELAY_MS)
}

// Editing while the pattern sounds, or after it failed, plays the new code once typing pauses,
// as the canvas already does; a stopped pattern stays stopped.
watch(patternCode, scheduleReplay)

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
    scheduleReplay()
  }
)

const flowErrorMessage = computed(() =>
  editorMode.value === 'flow' ? flowCompilation.value.errorMessage : null
)

const { musicStyles, pickedStyleId, styleDetection, hints, pickStyle, applyHint } = useStrudelHints(
  patternCode,
  updatePatternCode
)

const route = useRoute()
const router = useRouter()

const findTab = (tabName: string | undefined): StrudelTabId | undefined =>
  tabList.find((tab) => tab.id === tabName)?.id

// The address names a pattern and a drawer tab apart, so a link can open both, and Back steps
// through them. Each is applied only when it changes, so moving between tabs never reloads
// the pattern over edits made since it was picked.
const loadAddressedTab = (tabName: string | undefined): void => {
  setActiveTab(findTab(tabName) ?? null)
}

const loadAddressedPattern = (patternId: string | undefined): void => {
  if (patternId !== undefined && selectPattern(patternId)) {
    editorMode.value = 'code'
  }
}

watch(() => readStrudelAddress(route.query).tabName, loadAddressedTab)
watch(() => readStrudelAddress(route.query).patternId, loadAddressedPattern)

// Replaced rather than pushed, so the toolbar never fills Back with drawers opened and closed.
watch(activeTab, (tabId) => {
  void router.replace({ query: writeStrudelAddress(route.query, { tabName: tabId ?? undefined }) })
})

const loadAddress = (): void => {
  const legacyAddress = readLegacyStrudelAnchor(
    route.hash,
    tabList.map((tab) => tab.id)
  )
  if (legacyAddress !== null) {
    void router.replace({ query: writeStrudelAddress(route.query, legacyAddress), hash: '' })
    return
  }
  const { patternId, tabName } = readStrudelAddress(route.query)
  loadAddressedTab(tabName)
  loadAddressedPattern(patternId)
}

const onPatternSelected = (patternId: string): void => {
  if (selectPattern(patternId)) {
    editorMode.value = 'code'
    void playLoadedPattern()
  }
}

onMounted(loadAddress)

const onPlayRequested = (): void => {
  if (flowErrorMessage.value !== null) {
    return
  }
  void playPattern()
}

const onStopRequested = (): void => {
  void stopPattern()
}

// A pause is a stop that keeps where it was, so the next Play carries on from there.
const onPauseRequested = (): void => {
  holdPlayingPosition()
  onStopRequested()
}

const onFilesChosen = (chosenFiles: File[]): void => {
  void transcribeFiles(chosenFiles)
}

const onEditorModeChange = (mode: string): void => {
  if (mode === 'flow') {
    openFlowMode()
    return
  }
  editorMode.value = 'code'
  if (activeTab.value === 'flow') {
    setActiveTab(null)
  }
}

const toggleDrawer = (tabId: StrudelTabId): void => {
  setActiveTab(activeTab.value === tabId ? null : tabId)
}

const toolbarTools = [
  { id: 'import', label: 'Import', icon: Music },
  { id: 'export', label: 'Export', icon: Save },
  { id: 'midi', label: 'MIDI', icon: Cable },
  { id: 'sounds', label: 'Sounds', icon: Volume2 },
  { id: 'console', label: 'Console', icon: Terminal },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'flow', label: 'Nodes', icon: Boxes },
  { id: 'hints', label: 'Hints', icon: CircleHelp }
] as const satisfies { id: StrudelTabId; label: string; icon: unknown }[]

const visibleTools = computed(() =>
  toolbarTools.filter((tool) => tool.id !== 'flow' || editorMode.value === 'flow')
)

const drawerTitle = computed(() => tabList.find((tab) => tab.id === activeTab.value)?.label ?? '')

const codeEditor = ref<InstanceType<typeof StrudelCodeEditor> | null>(null)

// The flow keeps its graph, so switching back after looking at the code shows the same patch.
const onShowNodeCode = async (nodeId: string): Promise<void> => {
  const range = findStrudelFlowNodeCode(patternCode.value, flowNodes.value, flowEdges.value, nodeId)
  onEditorModeChange('code')
  await nextTick()
  if (range !== null) {
    codeEditor.value?.selectRange(range.from, range.to)
  }
}

const onFlowNodesConnected = (sourceNodeId: string, targetNodeId: string): void => {
  connectFlowNodes(sourceNodeId, targetNodeId)
}

// Before unmounting, while the code editor and its canvas are still there to clear.
onBeforeUnmount(() => {
  replayTimer = clearTimer(replayTimer)
  codeParseTimer = clearTimer(codeParseTimer)
  void stopPattern()
})
</script>

<template>
  <div class="strudel-editor pt-nav" :class="{ 'strudel-editor--drawer-open': activeTab !== null }">
    <section class="strudel-editor__code" aria-label="Code">
      <header class="strudel-editor__code-header">
        <div class="strudel-editor__toolbar" role="toolbar" aria-label="Editor tools">
          <IconButton
            v-for="tool in visibleTools"
            :key="tool.id"
            size="md"
            variant="ghost"
            :active="activeTab === tool.id"
            :title="tool.label"
            :aria-label="tool.label"
            :aria-pressed="activeTab === tool.id"
            @click="toggleDrawer(tool.id)"
          >
            <component :is="tool.icon" aria-hidden="true" />
          </IconButton>
        </div>
        <slot name="actions" />
        <div class="strudel-editor__mode" role="group" aria-label="Editor mode">
          <ButtonSelector
            :model-value="editorMode"
            :options="STRUDEL_FLOW_EDITOR_MODE_OPTIONS"
            @update:model-value="onEditorModeChange"
          />
        </div>
      </header>
      <StrudelCodeEditor
        v-show="editorMode === 'code'"
        ref="codeEditor"
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
          :note-reader="readStrudelNoteBars"
          :sample-groups="sampleGroups"
          :voice-groups="voiceGroups"
          @connect="onFlowNodesConnected"
          @update-node="updateFlowNodeData"
          @remove-node="removeFlowNode"
          @show-code="onShowNodeCode"
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
      <StrudelTimeline
        :playhead-cycle="playheadCycle"
        :timeline-bars="timelineBars"
        :cycles-per-second="cyclesPerSecond"
        :loop-bars="loopBars"
        :loop-measured="loopMeasured"
        :is-playing="editorStatus === 'playing'"
        @seek="seekToCycle"
        @play="onPlayRequested"
        @pause="onPauseRequested"
      />
    </section>

    <aside v-if="activeTab !== null" class="strudel-editor__drawer" :aria-label="drawerTitle">
      <header class="strudel-editor__drawer-header">
        <h2 class="strudel-editor__drawer-title">{{ drawerTitle }}</h2>
        <IconButton
          size="sm"
          variant="ghost"
          title="Close"
          aria-label="Close"
          @click="setActiveTab(null)"
        >
          <X aria-hidden="true" />
        </IconButton>
      </header>
      <div class="strudel-editor__drawer-content">
        <HintsTab
          v-if="activeTab === 'hints'"
          :music-styles="musicStyles"
          :picked-style-id="pickedStyleId"
          :detection="styleDetection"
          :hints="hints"
          @pick="pickStyle"
          @apply="applyHint"
        />
        <template v-else-if="activeTab === 'import'">
          <PatternLibrary
            :saved-patterns="savedPatterns"
            :examples="examples"
            :songs="electroTunes"
            :current-code="patternCode"
            @select="onPatternSelected"
            @delete="deleteSavedPattern"
          />
          <ImportTab
            :status="transcriptionStatus"
            :progress="transcriptionProgress"
            :transcriptions="importedTranscriptions"
            :code="transcribedCode"
            :warnings="transcriptionWarnings"
            :error-message="transcriptionError"
            v-model:add-visualizer="addVisualizer"
            @files="onFilesChosen"
            @load="loadTranscription"
            @add="addTranscription"
            @remove="removeTranscription"
          />
        </template>
        <SoundsTab
          v-else-if="activeTab === 'sounds'"
          :sound-entries="soundEntries"
          :sounds-status="soundsStatus"
          @preview="onSoundPreview"
        />
        <MidiTab v-else-if="activeTab === 'midi'" @code="updatePatternCode" />
        <ExportTab
          v-else-if="activeTab === 'export'"
          :status="exportStatus"
          :error-message="exportError"
          :repetition-cycles="repetitionCycles"
          @export="exportPattern"
          @measure-repetition="measureRepetition"
          @save="savePattern"
        />
        <ConsoleTab
          v-else-if="activeTab === 'console'"
          :log-entries="logEntries"
          @clear="clearLogEntries"
        />
        <FlowTab v-else-if="activeTab === 'flow'" @add-node="addFlowNode" @reset="resetFlowPatch" />
        <SettingsTab v-else />
      </div>
      <p class="strudel-editor__license">{{ STRUDEL_LICENSE_NOTE }}</p>
    </aside>
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
  padding-inline: var(--spacing-4);
  padding-bottom: var(--spacing-4);
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-areas: 'code';
  gap: var(--spacing-4);
}

.strudel-editor--drawer-open {
  grid-template-columns: minmax(0, 1fr) clamp(18rem, 28vw, 26rem);
  grid-template-areas: 'code drawer';
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

@media (width <= 900px) {
  .strudel-editor,
  .strudel-editor--drawer-open {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: 70dvh max-content;
    grid-template-areas:
      'code'
      'drawer';
    overflow-y: auto;
  }
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
  gap: var(--spacing-3);
}

.strudel-editor__toolbar {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
}

.strudel-editor__mode {
  margin-left: auto;
}

.strudel-editor__drawer {
  grid-area: drawer;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  margin-top: var(--spacing-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.strudel-editor__drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-2) var(--spacing-3);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-secondary);
}

.strudel-editor__drawer-title {
  margin: 0;
  font-size: var(--font-size-md);
}

.strudel-editor__drawer-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  padding: var(--spacing-4);
  overflow-y: auto;
}

.strudel-editor__license {
  margin: 0;
  padding: var(--spacing-2) var(--spacing-3);
  font-size: var(--font-size-sm);
  color: var(--color-muted-foreground);
  border-top: 1px solid var(--color-border);
}
</style>
