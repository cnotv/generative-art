import { describe, expect, it } from 'vitest'
import { findStrudelFlowSampleFamily } from './sampleFamilies'

describe('findStrudelFlowSampleFamily', () => {
  it.each([
    ['bd', 'kick'],
    ['808bd', 'kick'],
    ['rolandtr909_bd', 'kick'],
    ['sd', 'snare'],
    ['rolandtr808_rim', 'snare'],
    ['hh', 'hihat'],
    ['808oh', 'hihat'],
    ['cp', 'clap'],
    ['realclaps', 'clap'],
    ['808lt', 'tom'],
    ['cr', 'cymbal'],
    ['tabla', 'percussion'],
    ['jvbass', 'bass'],
    ['casio', 'keys'],
    ['gm_acoustic_guitar_nylon', 'strings'],
    ['numbers', 'voice'],
    ['glitch', 'fx'],
    ['xyz', 'other']
  ])('puts %s under %s', (sampleName, familyId) => {
    // Act
    const family = findStrudelFlowSampleFamily(sampleName)

    // Assert
    expect(family.id).toBe(familyId)
  })
})
