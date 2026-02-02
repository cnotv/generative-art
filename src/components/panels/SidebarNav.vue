<script setup lang="ts">
import { ref, computed } from 'vue';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { usePanels } from '@/composables/usePanels';
import { Menu, Circle, Square } from 'lucide-vue-next';

const { isSidebarOpen, togglePanel, closePanel } = usePanels();

const isRecording = ref(false);
const recordingDuration = ref(10);

const handleToggle = () => {
  togglePanel('sidebar');
};

const handleOpenChange = (open: boolean) => {
  if (!open) {
    closePanel();
  }
};

const toggleRecording = () => {
  isRecording.value = !isRecording.value;
};

const recordingButtonClass = computed(() =>
  isRecording.value
    ? 'bg-red-500 hover:bg-red-600 text-white'
    : 'bg-green-500 hover:bg-green-600 text-white'
);
</script>

<template>
  <div class="sidebar-nav">
    <Button
      variant="ghost"
      size="icon"
      class="sidebar-nav__trigger fixed left-4 top-4 z-40 bg-black/50 hover:bg-black/70"
      @click="handleToggle"
    >
      <Menu class="h-5 w-5 text-white" />
    </Button>

    <Sheet :open="isSidebarOpen" side="left" @update:open="handleOpenChange">
      <div class="sidebar-nav__content flex flex-col gap-6">
        <h2 class="text-lg font-semibold">Navigation</h2>

        <nav class="sidebar-nav__links flex flex-col gap-2">
          <slot name="navigation" />
        </nav>

        <div class="sidebar-nav__recording mt-auto border-t pt-6">
          <h3 class="mb-4 text-sm font-medium">Recording</h3>

          <div class="flex flex-col gap-4">
            <div class="flex items-center gap-2">
              <label for="duration" class="text-sm">Duration (s):</label>
              <input
                id="duration"
                v-model.number="recordingDuration"
                type="number"
                min="1"
                max="300"
                class="w-20 rounded border bg-background px-2 py-1 text-sm"
              />
            </div>

            <Button :class="recordingButtonClass" @click="toggleRecording">
              <component :is="isRecording ? Square : Circle" class="mr-2 h-4 w-4" />
              {{ isRecording ? 'Stop Recording' : 'Start Recording' }}
            </Button>
          </div>
        </div>
      </div>
    </Sheet>
  </div>
</template>

<style scoped>
.sidebar-nav__content {
  height: 100%;
}
</style>
