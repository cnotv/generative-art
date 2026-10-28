<script setup lang="ts">
import { computed } from 'vue'
import {
  STRUDEL_FLOW_TAB_BEAM_THICKNESS,
  STRUDEL_FLOW_TAB_BRACKET_LABEL_SIZE,
  STRUDEL_FLOW_TAB_DIGIT_BASELINE,
  STRUDEL_FLOW_TAB_DIGIT_SIZE,
  STRUDEL_FLOW_TAB_STEM_WIDTH,
  STRUDEL_FLOW_TAB_STROKE_WIDTH
} from '../../config'
import { layoutStrudelFlowTab } from '../../tabLayout'
import type { StrudelFlowNoteBar, StrudelFlowTabInstrument } from '../../types'

const props = defineProps<{
  bars: StrudelFlowNoteBar[]
  instrument: StrudelFlowTabInstrument
  beatsPerBar: number
}>()

// Arial first: the tab import's digit templates were sampled from it, so the drawing reads back.
const FRET_FONT = 'Arial, Helvetica, sans-serif'

const layout = computed(() => layoutStrudelFlowTab(props.bars, props.instrument, props.beatsPerBar))
const strokeWidth = computed(() => STRUDEL_FLOW_TAB_STROKE_WIDTH * layout.value.lineGap)
const label = computed(
  () => `${props.instrument === 'bass' ? 'Bass' : 'Guitar'} tab, ${props.bars.length} bars`
)
</script>

<template>
  <div class="strudel-flow-tab-staff nowheel">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="strudel-flow-tab-staff__staff"
      :data-notation="instrument"
      :width="layout.width"
      :height="layout.height"
      :viewBox="`0 0 ${layout.width} ${layout.height}`"
      role="img"
      :aria-label="label"
    >
      <g
        v-for="(segments, stringIndex) in layout.strings"
        :key="`string-${stringIndex}`"
        class="strudel-flow-tab-staff__string"
        :stroke-width="strokeWidth"
      >
        <line
          v-for="(segment, segmentIndex) in segments"
          :key="segmentIndex"
          :x1="segment.x1"
          :y1="segment.y1"
          :x2="segment.x2"
          :y2="segment.y2"
        />
      </g>
      <line
        v-for="(barLine, barIndex) in layout.barLines"
        :key="`bar-${barIndex}`"
        class="strudel-flow-tab-staff__bar-line"
        :x1="barLine.x1"
        :y1="barLine.y1"
        :x2="barLine.x2"
        :y2="barLine.y2"
        :stroke-width="strokeWidth"
      />
      <path
        v-for="(tie, tieIndex) in layout.ties"
        :key="`tie-${tieIndex}`"
        class="strudel-flow-tab-staff__tie"
        :d="tie"
        fill="none"
        :stroke-width="strokeWidth"
      />
      <text
        v-for="(fret, fretIndex) in layout.frets"
        :key="`fret-${fretIndex}`"
        class="strudel-flow-tab-staff__fret"
        :x="fret.x"
        :y="fret.y + STRUDEL_FLOW_TAB_DIGIT_BASELINE * layout.lineGap"
        text-anchor="middle"
        :font-family="FRET_FONT"
        font-weight="700"
        :font-size="STRUDEL_FLOW_TAB_DIGIT_SIZE * layout.lineGap"
      >
        <tspan v-for="(digit, digitIndex) in fret.digits" :key="digitIndex" :x="digit.x">
          {{ digit.digit }}
        </tspan>
      </text>
      <rect
        v-for="(rest, restIndex) in layout.rests"
        :key="`rest-${restIndex}`"
        class="strudel-flow-tab-staff__rest"
        :x="rest.x"
        :y="rest.y"
        :width="rest.width"
        :height="rest.height"
      />
      <line
        v-for="(stem, stemIndex) in layout.stems"
        :key="`stem-${stemIndex}`"
        class="strudel-flow-tab-staff__stem"
        :x1="stem.x"
        :y1="layout.stemTop"
        :x2="stem.x"
        :y2="layout.stemBottom"
        :stroke-width="STRUDEL_FLOW_TAB_STEM_WIDTH * layout.lineGap"
      />
      <line
        v-for="(beam, beamIndex) in layout.beams"
        :key="`beam-${beamIndex}`"
        class="strudel-flow-tab-staff__beam"
        :x1="beam.x1"
        :y1="beam.y1"
        :x2="beam.x2"
        :y2="beam.y2"
        :stroke-width="STRUDEL_FLOW_TAB_BEAM_THICKNESS * layout.lineGap"
      />
      <template v-for="(bracket, bracketIndex) in layout.brackets" :key="`bracket-${bracketIndex}`">
        <path
          class="strudel-flow-tab-staff__bracket"
          :d="bracket.path"
          fill="none"
          :stroke-width="strokeWidth"
        />
        <text
          class="strudel-flow-tab-staff__bracket-label"
          :x="bracket.labelX"
          :y="layout.bracketLabelY"
          text-anchor="middle"
          :font-family="FRET_FONT"
          :font-size="STRUDEL_FLOW_TAB_BRACKET_LABEL_SIZE * layout.lineGap"
        >
          3
        </text>
      </template>
    </svg>
  </div>
</template>
