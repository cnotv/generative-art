<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Button from '@/components/ui/button/Button.vue'

const midiAccess = ref<any>(null)
const inputs = ref<string[]>([])

const initMidi = async () => {
  try {
    midiAccess.value = await (navigator as any).requestMIDIAccess?.()
    if (midiAccess.value) {
      const it = midiAccess.value.inputs.values()
      for (const input of it) {
        inputs.value.push(input.name)
      }
    }
  } catch {
    // WebMIDI not available
  }
}

onMounted(initMidi)
</script>

<template>
  <section class="midi-tab">
    <h2>MIDI input & output</h2>
    <p>Use <code>midin()</code> or <code>midikeys()</code> to capture notes from a MIDI keyboard.</p>
    <pre>n("c3").midin("test")
// or
midikeys("midi")</pre>
    <p>Connected MIDI inputs: {{ inputs.length || 'none detected' }}</p>
    <ul v-if="inputs.length">
      <li v-for="name in inputs" :key="name">{{ name }}</li>
    </ul>
    <p>For MIDI output: <code>.midi("test")</code> sends pattern notes to a MIDI device.</p>
  </section>
</template>

<style scoped>
.midi-tab { padding: var(--spacing-4); }
.midi-tab h2 { font-size: var(--font-size-lg); margin-bottom: var(--spacing-2); }
.midi-tab pre { background: var(--color-background); padding: var(--spacing-2); border-radius: var(--radius-md); overflow: auto; }
</style>
