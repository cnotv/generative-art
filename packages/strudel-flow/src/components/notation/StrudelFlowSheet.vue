<script setup lang="ts">
import { computed } from 'vue'
import {
  STRUDEL_FLOW_SHEET_ACCIDENTAL_GLYPHS,
  STRUDEL_FLOW_SHEET_ACCIDENTAL_OFFSET,
  STRUDEL_FLOW_SHEET_CLEF_GLYPHS,
  STRUDEL_FLOW_SHEET_HEAD_RADIUS_X,
  STRUDEL_FLOW_SHEET_HEAD_RADIUS_Y,
  STRUDEL_FLOW_SHEET_LEDGER_HALF_WIDTH,
  STRUDEL_FLOW_SHEET_STROKE_WIDTH,
  STRUDEL_FLOW_TAB_BRACKET_LABEL_SIZE
} from '../../config'
import { layoutStrudelFlowSheet } from '../../sheetLayout'
import type { StrudelFlowNoteBar, StrudelFlowSheetStaff } from '../../types'

const props = defineProps<{
  bars: StrudelFlowNoteBar[]
  beatsPerBar: number
}>()

const STAFF_LINE_STEPS = [0, 1, 2, 3, 4]
// Clefs come from the Unicode music block, which the system's symbol fonts draw.
const CLEF_FONT = "'Noto Music', 'Apple Symbols', 'Segoe UI Symbol', serif"
/** Where each clef's glyph sits: the treble curls round the G line, the bass dots the F line. */
const CLEF_LINE = { treble: 3, bass: 1 }
const CLEF_SIZE = 4.2
const HEAD_TILT = -20

const layout = computed(() => layoutStrudelFlowSheet(props.bars, props.beatsPerBar))
const gap = computed(() => layout.value.lineGap)
const strokeWidth = computed(() => STRUDEL_FLOW_SHEET_STROKE_WIDTH * gap.value)
const systemTop = computed(() => layout.value.staves[0].topY)
const systemBottom = computed(() => layout.value.staves.at(-1)!.bottomY)

const lineY = (staff: StrudelFlowSheetStaff, lineFromBottom: number): number =>
  staff.bottomY - lineFromBottom * gap.value

const label = computed(
  () =>
    `Piano sheet on ${layout.value.staves.map((staff) => staff.clef).join(' and ')} clef, ${props.bars.length} bars`
)
</script>

<template>
  <div class="strudel-flow-sheet nowheel">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      data-notation="sheet"
      :width="layout.width"
      :height="layout.height"
      :viewBox="`0 0 ${layout.width} ${layout.height}`"
      role="img"
      :aria-label="label"
    >
      <g
        v-for="staff in layout.staves"
        :key="staff.clef"
        class="strudel-flow-sheet__staff"
        :data-clef="staff.clef"
        :stroke-width="strokeWidth"
      >
        <line
          v-for="lineStep in STAFF_LINE_STEPS"
          :key="lineStep"
          class="strudel-flow-sheet__line"
          :x1="layout.staffStartX"
          :y1="lineY(staff, lineStep)"
          :x2="layout.staffEndX"
          :y2="lineY(staff, lineStep)"
        />
        <text
          class="strudel-flow-sheet__clef"
          :x="layout.staffStartX + gap * 0.4"
          :y="lineY(staff, CLEF_LINE[staff.clef]) + (staff.clef === 'treble' ? gap : 0)"
          :font-size="CLEF_SIZE * gap"
          :font-family="CLEF_FONT"
        >
          {{ STRUDEL_FLOW_SHEET_CLEF_GLYPHS[staff.clef] }}
        </text>
      </g>
      <line
        v-for="barX in [layout.staffStartX, ...layout.barEndXs]"
        :key="`bar-${barX}`"
        class="strudel-flow-sheet__bar-line"
        :x1="barX"
        :y1="systemTop"
        :x2="barX"
        :y2="systemBottom"
        :stroke-width="strokeWidth"
      />
      <path
        v-for="(tie, tieIndex) in layout.ties"
        :key="`tie-${tieIndex}`"
        class="strudel-flow-sheet__tie"
        :d="tie"
        fill="none"
        :stroke-width="strokeWidth * 1.4"
      />
      <path
        v-for="(rest, restIndex) in layout.rests"
        :key="`rest-${restIndex}`"
        class="strudel-flow-sheet__rest"
        :class="{ 'strudel-flow-sheet__rest--solid': rest.solid }"
        :d="rest.path"
        :stroke-width="strokeWidth * 2"
      />
      <g
        v-for="(chord, chordIndex) in layout.chords"
        :key="`chord-${chordIndex}`"
        class="strudel-flow-sheet__chord"
      >
        <template v-for="(head, headIndex) in chord.heads" :key="headIndex">
          <line
            v-for="ledgerY in head.ledgerYs"
            :key="`ledger-${ledgerY}`"
            class="strudel-flow-sheet__ledger"
            :x1="chord.x - STRUDEL_FLOW_SHEET_LEDGER_HALF_WIDTH * gap"
            :y1="ledgerY"
            :x2="chord.x + STRUDEL_FLOW_SHEET_LEDGER_HALF_WIDTH * gap"
            :y2="ledgerY"
            :stroke-width="strokeWidth"
          />
          <ellipse
            class="strudel-flow-sheet__head"
            :class="{ 'strudel-flow-sheet__head--open': !chord.filled }"
            :cx="chord.x"
            :cy="head.y"
            :rx="STRUDEL_FLOW_SHEET_HEAD_RADIUS_X * gap"
            :ry="STRUDEL_FLOW_SHEET_HEAD_RADIUS_Y * gap"
            :transform="`rotate(${HEAD_TILT} ${chord.x} ${head.y})`"
            :stroke-width="strokeWidth * 1.5"
          />
          <text
            v-if="head.accidental !== null"
            class="strudel-flow-sheet__accidental"
            :x="chord.x - STRUDEL_FLOW_SHEET_ACCIDENTAL_OFFSET * gap"
            :y="head.y + gap * 0.5"
            text-anchor="middle"
            :font-size="gap * 2"
          >
            {{ STRUDEL_FLOW_SHEET_ACCIDENTAL_GLYPHS[head.accidental] }}
          </text>
        </template>
        <line
          v-if="chord.stem !== null"
          class="strudel-flow-sheet__stem"
          :x1="chord.stem.x1"
          :y1="chord.stem.y1"
          :x2="chord.stem.x2"
          :y2="chord.stem.y2"
          :stroke-width="strokeWidth"
        />
        <path
          v-for="(flag, flagIndex) in chord.flags"
          :key="`flag-${flagIndex}`"
          class="strudel-flow-sheet__flag"
          :d="flag"
          fill="none"
          :stroke-width="strokeWidth * 1.5"
        />
        <circle
          v-for="(dot, dotIndex) in chord.dots"
          :key="`dot-${dotIndex}`"
          class="strudel-flow-sheet__dot"
          :cx="dot.x"
          :cy="dot.y"
          :r="gap * 0.18"
        />
      </g>
      <template v-for="(bracket, bracketIndex) in layout.brackets" :key="`bracket-${bracketIndex}`">
        <path
          class="strudel-flow-sheet__bracket"
          :d="bracket.path"
          fill="none"
          :stroke-width="strokeWidth"
        />
        <text
          class="strudel-flow-sheet__bracket-label"
          :x="bracket.labelX"
          :y="layout.bracketLabelY"
          text-anchor="middle"
          :font-size="STRUDEL_FLOW_TAB_BRACKET_LABEL_SIZE * gap * 1.4"
        >
          3
        </text>
      </template>
    </svg>
  </div>
</template>
