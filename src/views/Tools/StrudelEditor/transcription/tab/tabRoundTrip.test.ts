import { mount } from '@vue/test-utils'
import { Buffer } from 'node:buffer'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { STRUDEL_FLOW_OPEN_STRINGS, StrudelFlowTabStaff } from '@webgamekit/strudel-flow'
import type { StrudelFlowNoteBar, StrudelFlowTabInstrument } from '@webgamekit/strudel-flow'
import type { TabEvent } from '../../types'
import { buildTabImage } from './buildTabImage'
import { readTab } from './readTab'
import { loadSampleTabImage } from './sampleTabImage'
import { drawQuarterNoteTab } from './syntheticTab'

// SVG rasterising has no stylesheet, so each theme's tokens are stood in for by plain colours:
// faint lines, bright numbers and stems, on the theme's page colour.
const THEMES = {
  light: { page: '#fafafa', ink: '#1f1f1f', faint: '#b5b5b5' },
  dark: { page: '#1c1c1c', ink: '#f0f0f0', faint: '#5a5a5a' }
}
const RASTER_DENSITY = 144

const toNoteBars = (bars: TabEvent[][]): StrudelFlowNoteBar[] =>
  bars.map((bar) =>
    bar.reduce<StrudelFlowNoteBar>((events, event) => {
      const start = events.reduce((total, previous) => total + previous.beats, 0)
      return [...events, { notes: event.notes, start, beats: event.beats }]
    }, [])
  )

const themedSvg = (svg: string, theme: (typeof THEMES)['light']): string =>
  svg.replace(
    /^<svg([^>]*)>/,
    `<svg$1><style>
      .strudel-flow-tab-staff__string line, .strudel-flow-tab-staff__bar-line, .strudel-flow-tab-staff__tie {
        stroke: ${theme.faint}; fill: none }
      .strudel-flow-tab-staff__stem, .strudel-flow-tab-staff__beam, .strudel-flow-tab-staff__bracket {
        stroke: ${theme.ink}; fill: ${theme.ink} }
      .strudel-flow-tab-staff__bracket-label, .strudel-flow-tab-staff__fret { fill: ${theme.ink} }
    </style>`
  )

const renderAndRead = async (
  bars: TabEvent[][],
  instrument: StrudelFlowTabInstrument,
  theme: (typeof THEMES)['light']
) => {
  const wrapper = mount(StrudelFlowTabStaff, { props: { bars: toNoteBars(bars), instrument } })
  const svg = themedSvg(wrapper.get('svg').html(), theme)
  const { data, info } = await sharp(Buffer.from(svg), { density: RASTER_DENSITY })
    .flatten({ background: theme.page })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return readTab(
    buildTabImage(info.width, info.height, new Uint8ClampedArray(data)),
    STRUDEL_FLOW_OPEN_STRINGS
  )
}

const comparable = (bars: TabEvent[][]) =>
  bars.map((bar) =>
    bar.map((event) => ({
      notes: event.notes.toSorted(),
      beats: Math.round(event.beats * 1000) / 1000
    }))
  )

describe('tab round trip', () => {
  it.each(Object.entries(THEMES))(
    'reads the sample bass tab back unchanged after drawing it in the %s theme',
    async (_themeName, theme) => {
      // Arrange
      const imported = readTab(await loadSampleTabImage(), STRUDEL_FLOW_OPEN_STRINGS)

      // Act
      const reread = await renderAndRead(imported.bars, 'bass', theme)

      // Assert
      expect(reread.instrument).toBe('bass')
      expect(reread.warnings.filter((warning) => warning.includes('could not be read'))).toEqual([])
      expect(comparable(reread.bars)).toEqual(comparable(imported.bars))
    }
  )

  it('reads guitar chords back from six strings', async () => {
    // Arrange
    const imported = readTab(
      drawQuarterNoteTab(6, [
        [
          { lineIndex: 5, fret: 3 },
          { lineIndex: 4, fret: 5 }
        ],
        [{ lineIndex: 2, fret: 4 }],
        [{ lineIndex: 1, fret: 10 }],
        [{ lineIndex: 0, fret: 2 }]
      ]),
      STRUDEL_FLOW_OPEN_STRINGS
    )

    // Act
    const reread = await renderAndRead(imported.bars, 'guitar', THEMES.light)

    // Assert
    expect(reread.instrument).toBe('guitar')
    expect(comparable(reread.bars)).toEqual(comparable(imported.bars))
  })
})
