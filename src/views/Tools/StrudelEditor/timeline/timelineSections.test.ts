import { describe, expect, it } from 'vitest'
import { findSectionIndexForCycle, splitTimelineSections } from './timelineSections'

describe('splitTimelineSections', () => {
  it('keeps a song that fits the width in one section', () => {
    // Act
    const sections = splitTimelineSections(8, 480, 48)

    // Assert
    expect(sections).toEqual([{ startCycle: 0, endCycle: 8 }])
  })

  it('starts each section on the last cycle of the one before and covers every cycle', () => {
    // Act
    const sections = splitTimelineSections(64, 480, 48)

    // Assert
    expect(sections[0]).toEqual({ startCycle: 0, endCycle: 10 })
    sections.slice(1).forEach((section, index) => {
      expect(section.startCycle).toBe(sections[index]!.endCycle - 1)
    })
    expect(sections.at(-1)?.endCycle).toBe(64)
  })

  it('splits again when the width changes', () => {
    // Act
    const narrowSections = splitTimelineSections(64, 240, 48)
    const wideSections = splitTimelineSections(64, 960, 48)

    // Assert
    expect(narrowSections.length).toBeGreaterThan(wideSections.length)
  })

  it('never shows fewer than two cycles in a row', () => {
    // Act
    const sections = splitTimelineSections(5, 10, 48)

    // Assert
    expect(sections[0]).toEqual({ startCycle: 0, endCycle: 2 })
    expect(sections.at(-1)?.endCycle).toBe(5)
  })
})

describe('findSectionIndexForCycle', () => {
  const sections = splitTimelineSections(64, 480, 48)

  it('picks the section that holds a cycle', () => {
    // Act
    const sectionIndex = findSectionIndexForCycle(sections, 3.5)

    // Assert
    expect(sectionIndex).toBe(0)
  })

  it('picks the later section when the cycle sits in an overlap', () => {
    // Arrange
    const overlapCycle = sections[0]!.endCycle - 1 + 0.5

    // Act
    const sectionIndex = findSectionIndexForCycle(sections, overlapCycle)

    // Assert
    expect(sectionIndex).toBe(1)
  })

  it('picks the last section at the very end of the song', () => {
    // Act
    const sectionIndex = findSectionIndexForCycle(sections, 64)

    // Assert
    expect(sectionIndex).toBe(sections.length - 1)
  })
})
