import { markRaw } from 'vue'
import type { Component } from 'vue'
import {
  AudioWaveform,
  Bell,
  Circle,
  CircleDashed,
  CircleDot,
  Cylinder,
  Dices,
  Disc,
  Drum,
  FastForward,
  Guitar,
  Hand,
  Hourglass,
  Mic,
  MoveHorizontal,
  Piano,
  Repeat,
  Sparkles,
  Speaker,
  Zap
} from 'lucide-vue-next'
import type { StrudelFlowSampleModifierKind } from '../types'

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

/** The icon beside a Samples step's modifier, so its effect reads at a glance. */
export const STRUDEL_FLOW_SAMPLE_MODIFIER_ICONS: Record<StrudelFlowSampleModifierKind, Component> =
  {
    once: markRaw(Circle),
    faster: markRaw(FastForward),
    repeat: markRaw(Repeat),
    hold: markRaw(MoveHorizontal),
    slower: markRaw(Hourglass),
    chance: markRaw(Dices),
    rhythm: markRaw(CircleDashed)
  }
