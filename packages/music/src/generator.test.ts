import { describe, it, expect } from 'vitest'
import { musicRandomDrums } from './generator'

describe('musicRandomDrums', () => {
  it('wraps the requested number of valid tokens in an s(...) call', () => {
    const random = () => 0 // always the first token, 'bd'
    expect(musicRandomDrums(4, random)).toBe('s("bd bd bd bd")')
  })

  it('only emits known tokens and respects the step count', () => {
    const pattern = musicRandomDrums(6)
    const tokens = pattern.replace('s("', '').replace('")', '').split(' ')
    expect(tokens).toHaveLength(6)
    tokens.forEach((token) => expect(['bd', 'hh', 'sd', 'ho', 'cp', '~']).toContain(token))
  })

  it('never produces fewer than one step', () => {
    expect(musicRandomDrums(0).startsWith('s("')).toBe(true)
  })
})
