<script setup lang="ts">
import { onUnmounted } from 'vue'
import Button from '@/components/ui/button/Button.vue'
import { Select } from '@/components/ui/select'
import { STRUDEL_LICENSE_NOTE } from './config'
import { useStrudelEditor } from './useStrudelEditor'
import type { StrudelTabId } from './types'
import WelcomeTab from './tabs/WelcomeTab.vue'
import PatternsTab from './tabs/PatternsTab.vue'
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
  clearLogEntries
} = useStrudelEditor()

const onExampleSelected = (exampleId: string): void => {
  selectExample(exampleId)
}

const onElectroTuneSelected = (tuneId: string): void => {
  selectElectroTune(tuneId)
}

const onCodeInput = (inputEvent: Event): void => {
  const textArea = inputEvent.target as HTMLTextAreaElement | null
  if (textArea === null) {
    return
  }
  updatePatternCode(textArea.value)
}

const onPlayRequested = (): void => {
  void playPattern()
}

const onStopRequested = (): void => {
  void stopPattern()
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

    <label class="strudel-editor__label" for="strudel-code">Live code pattern</label>
    <textarea
      id="strudel-code"
      class="strudel-editor__code"
      :value="patternCode"
      spellcheck="false"
      rows="6"
      @input="onCodeInput"
    />

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
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-muted-foreground);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.strudel-editor__code {
  width: 100%;
  box-sizing: border-box;
  min-height: 10rem;
  padding: var(--spacing-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background);
  color: var(--color-foreground);
  font-family: var(--font-mono);
  font-size: var(--font-size-md);
  line-height: 1.5;
  resize: vertical;
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
