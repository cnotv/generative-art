import { markRaw } from 'vue'
import type { Component } from 'vue'
import {
  AudioWaveform,
  Bell,
  CircleDot,
  Cylinder,
  Disc,
  Drum,
  Guitar,
  Hand,
  Mic,
  Piano,
  Sparkles,
  Speaker,
  Zap
} from 'lucide-vue-next'

/** The icon each sample family shows in the picker and on a Samples step. */
export const STRUDEL_FLOW_SAMPLE_FAMILY_ICONS: Record<string, Component> = {
  kick: markRaw(Drum),
  snare: markRaw(CircleDot),
  hihat: markRaw(Sparkles),
  clap: markRaw(Hand),
  tom: markRaw(Cylinder),
  cymbal: markRaw(Disc),
  percussion: markRaw(Bell),
  bass: markRaw(Speaker),
  keys: markRaw(Piano),
  strings: markRaw(Guitar),
  voice: markRaw(Mic),
  fx: markRaw(Zap),
  other: markRaw(AudioWaveform)
}
