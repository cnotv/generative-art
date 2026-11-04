// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { renderStrudelFile } from './browser'

const integrationDescribe =
  process.env.STRUDEL_RENDER_INTEGRATION === '1' ? describe : describe.skip

const siteOrigin = process.env.STRUDEL_EDITOR_URL ?? 'http://localhost:5317'

const integrationRequest = {
  code: 's("bd sd, hh*8")',
  cycles: 1,
  startCycle: 0,
  sampleRate: 48_000
}

integrationDescribe('renderStrudelFile integration', () => {
  it('renders a WAV', async () => {
    const result = await renderStrudelFile({ ...integrationRequest, format: 'wav' }, siteOrigin)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(String.fromCharCode(...result.file.bytes.subarray(0, 4))).toBe('RIFF')
      expect(result.file.bytes.byteLength).toBeGreaterThan(44)
    }
  }, 120_000)

  it('renders a MIDI file', async () => {
    const result = await renderStrudelFile({ ...integrationRequest, format: 'midi' }, siteOrigin)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(String.fromCharCode(...result.file.bytes.subarray(0, 4))).toBe('MThd')
    }
  }, 120_000)
})
