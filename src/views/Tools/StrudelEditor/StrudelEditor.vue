<script setup lang="ts">
import { onUnmounted } from 'vue'
import Button from '@/components/ui/button/Button.vue'
import { Select } from '@/components/ui/select'
import { STRUDEL_LICENSE_NOTE } from './config'
import { useStrudelEditor } from './useStrudelEditor'
import type { StrudelTabId } from './types'
import WelcomeTab from './tabs/WelcomeTab.vue'
import PatternsTab from './tabs/PatternsTab.vue'
import ImportTab from './tabs/ImportTab.vue'
import StrudelCodeEditor from './StrudelCodeEditor.vue'
import SoundsTab from './tabs/SoundsTab.vue'
import ReferenceTab from './tabs/ReferenceTab.vue'
import ExportTab from './tabs/ExportTab.vue'
import ConsoleTab from './tabs/ConsoleTab.vue'
import SettingsTab from './tabs/SettingsTab.vue'

const {
  selectedExampleId,
  patternCode,
  editorStatus,
  errorMessage,
  exampleOptions,
  electroTunes,
  logEntries,
  activeTab,
  tabList,
  selectExample,
  selectElectroTune,
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
  transcribeAudioFile,
  loadTranscription
} = useStrudelEditor()

const onExampleSelected = (exampleId: string): void => {
  selectExample(exampleId)
}

const onElectroTuneSelected = (tuneId: string): void => {
  selectElectroTune(tuneId)
}

const onPlayRequested = (): void => {
  void playPattern()
}

const onStopRequested = (): void => {
  void stopPattern()
}

const onAudioFileChosen = (audioFile: File): void => {
  void transcribeAudioFile(audioFile)
}

const onTabSelected = (tabId: string): void => {
  setActiveTab(tabId as StrudelTabId)
}

onUnmounted(() => {
  void stopPattern()
})
</script>

<template>
  <div class="strudel-editor">
    <div class="strudel-editor__toolbar">
      <label class="strudel-editor__label" for="strudel-example">Example pattern</label>
      <Select
        :model-value="selectedExampleId"
        :options="exampleOptions"
        placeholder="Choose a pattern"
        @update:model-value="onExampleSelected"
      />
      <div class="strudel-editor__actions">
        <Button :disabled="editorStatus === 'playing'" @click="onPlayRequested">Play</Button>
        <Button variant="outline" :disabled="editorStatus !== 'playing'" @click="onStopRequested">
          Stop
        </Button>
      </div>
    </div>

    <p class="strudel-editor__label">Live code pattern</p>
    <StrudelCodeEditor
      :code="patternCode"
      @update:code="updatePatternCode"
      @evaluate="onPlayRequested"
      @stop="onStopRequested"
      @ready="attachEditor"
    />
    <p class="strudel-editor__hint">Ctrl+Enter plays the code, Ctrl+. stops it.</p>

    <p class="strudel-editor__status" role="status">
      <template v-if="editorStatus === 'playing'">Playing the current pattern.</template>
      <template v-else-if="editorStatus === 'error'">
        {{ errorMessage || 'Pattern failed to evaluate.' }}
      </template>
      <template v-else>Idle. Choose a pattern and press Play.</template>
    </p>

    <div class="strudel-editor__panel">
      <div class="strudel-editor__tabs" role="tablist">
        <button
          v-for="tab in tabList"
          :key="tab.id"
          class="strudel-editor__tab"
          :class="{ 'strudel-editor__tab--active': activeTab === tab.id }"
          role="tab"
          :aria-selected="activeTab === tab.id"
          type="button"
          @click="onTabSelected(tab.id)"
        >
          {{ tab.label }}
        </button>
      </div>
      <div class="strudel-editor__panel-content">
        <WelcomeTab v-if="activeTab === 'welcome'" />
        <PatternsTab
          v-else-if="activeTab === 'patterns'"
          :electro-tunes="electroTunes"
          :current-code="patternCode"
          @select="onElectroTuneSelected"
        />
        <ImportTab
          v-else-if="activeTab === 'import'"
          :status="transcriptionStatus"
          :progress="transcriptionProgress"
          :result="transcriptionResult"
          :code="transcribedCode"
          :error-message="transcriptionError"
          @file="onAudioFileChosen"
          @load="loadTranscription"
        />
        <SoundsTab v-else-if="activeTab === 'sounds'" />
        <ReferenceTab v-else-if="activeTab === 'reference'" />
        <ExportTab v-else-if="activeTab === 'export'" />
        <ConsoleTab
          v-else-if="activeTab === 'console'"
          :log-entries="logEntries"
          @clear="clearLogEntries"
        />
        <SettingsTab v-else />
      </div>
    </div>

    <p class="strudel-editor__license">{{ STRUDEL_LICENSE_NOTE }}</p>
  </div>
</template>

<style scoped>
.strudel-editor {
  padding-top: var(--nav-height);
  min-height: 100vh;
  max-width: 56rem;
  margin: 0 auto;
  padding-inline: var(--spacing-4);
  padding-bottom: var(--spacing-10);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
}

.strudel-editor__toolbar {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  padding: var(--spacing-4);
  background: var(--color-secondary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
}

.strudel-editor__actions {
  display: flex;
  gap: var(--spacing-2);
  flex-wrap: wrap;
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

.strudel-editor__status {
  font-size: var(--font-size-md);
  color: var(--color-muted-foreground);
  margin: 0;
}

.strudel-editor__panel {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 20rem;
}

.strudel-editor__tabs {
  display: flex;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-secondary);
  overflow-x: auto;
}

.strudel-editor__tab {
  padding: var(--spacing-2) var(--spacing-3);
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
