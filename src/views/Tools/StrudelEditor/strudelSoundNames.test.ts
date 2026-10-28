import { describe, it, expect } from 'vitest'
import {
  describeStrudelSound,
  nameStrudelDrumPart,
  spaceStrudelMachineName
} from './strudelSoundNames'
import type { StrudelSoundLibrary } from './types'

const SOUND_LIBRARY: StrudelSoundLibrary = {
  drumMachines: { rolandtr909: { name: 'RolandTR909', alias: 'TR909' } }
}

const CDN = 'https://strudel.b-cdn.net'
const DIRT = 'https://raw.githubusercontent.com/tidalcycles/dirt-samples/main/'

describe('describeStrudelSound', () => {
  it.each<[string, string, Record<string, unknown>, string, string]>([
    [
      'a drum machine part',
      'rolandtr909_bd',
      { baseUrl: `${CDN}/tidal-drum-machines/machines/` },
      'Roland TR909',
      'Bass drum'
    ],
    [
      'a machine missing from the alias list',
      'mysterybox_oh',
      { baseUrl: `${CDN}/tidal-drum-machines/machines/` },
      'mysterybox',
      'Open hi-hat'
    ],
    ['a dirt kit drum', 'hh', { baseUrl: DIRT }, 'Dirt samples', 'Closed hi-hat'],
    [
      'a dirt drum after a model number',
      '808sd',
      { baseUrl: DIRT },
      'Dirt samples',
      '808 snare drum'
    ],
    ['a dirt sample with a plain name', 'arpy', { baseUrl: DIRT }, 'Dirt samples', 'Arpy'],
    [
      'a VCSL instrument',
      'recorder_alto_stacc',
      { baseUrl: `${CDN}/VCSL/` },
      'VCSL instruments',
      'Recorder alto stacc'
    ],
    ['a mridangam stroke', 'mridangam_dhin', { baseUrl: `${CDN}/mrid/` }, 'Mridangam', 'Dhin'],
    ['an uzu kit drum', 'brk', { baseUrl: `${CDN}/uzu-drumkit/` }, 'Uzu drum kit', 'Breakbeat'],
    [
      'a wavetable',
      'wt_digital_bad_day',
      { type: 'wavetable', baseUrl: `${CDN}/uzu-wavetables/` },
      'Wavetables',
      'Digital bad day'
    ],
    ['a synth', 'supersaw', { type: 'synth' }, 'Synths', 'Supersaw'],
    [
      'a soundfont',
      'gm_electric_guitar_jazz',
      { type: 'soundfont', fonts: ['0260_JCLive_sf2_file'] },
      'Guitars',
      'Electric guitar jazz'
    ],
    [
      'a sample from no known bank',
      'mine',
      { baseUrl: 'https://example.com/' },
      'Other samples',
      'mine'
    ]
  ])(
    'lists %s under its group with a readable name',
    (_case, name, data, expectedGroup, expectedLabel) => {
      // Arrange
      const soundData = { type: 'sample', ...data }

      // Act
      const { group, label } = describeStrudelSound(name, soundData, SOUND_LIBRARY)

      // Assert
      expect([group, label]).toEqual([expectedGroup, expectedLabel])
    }
  )

  it('orders the soundfont families after the synths, in General MIDI order', () => {
    // Arrange
    const synth = { type: 'synth' }
    const piano = { type: 'soundfont', fonts: ['0000_JCLive_sf2_file'] }
    const gunshot = { type: 'soundfont', fonts: ['1270_JCLive_sf2_file'] }

    // Act
    const positions = [
      describeStrudelSound('sine', synth, SOUND_LIBRARY),
      describeStrudelSound('gm_piano', piano, SOUND_LIBRARY),
      describeStrudelSound('gm_gunshot', gunshot, SOUND_LIBRARY)
    ].map(({ group, groupPosition }) => [group, groupPosition])

    // Assert
    expect(positions).toEqual([
      ['Synths', 0],
      ['Pianos', 1],
      ['Sound effects', 16]
    ])
  })
})

describe('spaceStrudelMachineName', () => {
  it.each([
    ['RolandTR909', 'Roland TR909'],
    ['AJKPercusyn', 'AJK Percusyn'],
    ['CasioRZ1', 'Casio RZ1'],
    ['AkaiMPC60', 'Akai MPC60']
  ])('spaces %s as %s', (machineName, expectedName) => {
    // Arrange
    const spelledName = machineName

    // Act
    const spacedName = spaceStrudelMachineName(spelledName)

    // Assert
    expect(spacedName).toBe(expectedName)
  })
})

describe('nameStrudelDrumPart', () => {
  it.each([
    ['cp', 'clap'],
    ['909bd', '909 bass drum'],
    ['casio', null],
    ['808', null]
  ])('names %s as %s', (part, expectedName) => {
    // Arrange
    const drumPart = part

    // Act
    const partName = nameStrudelDrumPart(drumPart)

    // Assert
    expect(partName).toBe(expectedName)
  })
})
