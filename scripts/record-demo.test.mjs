// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  clipArguments,
  compareArguments,
  configFieldSelector,
  cutWindow,
  dragPoints,
  glideValues,
  parseScenes,
  wheelNotches
} from './record-demo.mjs'

const sceneFile = (overrides) =>
  JSON.stringify({
    baseUrl: 'http://localhost:5317',
    output: '/tmp/demo',
    scenes: [{ name: 'edit', route: '/tools/ModelEditor', steps: [{ wait: 100 }] }],
    ...overrides
  })

describe('parseScenes', () => {
  it('reads the output directory relative to the scene file', () => {
    const parsed = parseScenes(sceneFile({ output: 'clips' }), '/tmp/demo-plan')

    expect(parsed.output).toBe('/tmp/demo-plan/clips')
  })

  it('fills in the defaults a scene file leaves out', () => {
    const parsed = parseScenes(sceneFile({}))

    expect(parsed.summary).toBe('summary')
    expect(parsed.viewport).toEqual({ width: 1100, height: 720 })
    expect(parsed.scenes[0].speed).toBe(1)
  })

  it.each([
    {
      problem: 'a scene without a route',
      scene: { name: 'edit', steps: [{ wait: 1 }] },
      error: /route/
    },
    {
      problem: 'a scene named with spaces',
      scene: { name: 'the edit', route: '/', steps: [{ wait: 1 }] },
      error: /name/
    },
    {
      problem: 'a scene with no steps',
      scene: { name: 'edit', route: '/', steps: [] },
      error: /no steps/
    }
  ])('rejects $problem before anything is recorded', ({ scene, error }) => {
    expect(() => parseScenes(sceneFile({ scenes: [scene] }))).toThrow(error)
  })

  it('rejects a comparison naming a scene the file does not have', () => {
    expect(() => parseScenes(sceneFile({ compare: ['edit', 'after'] }))).toThrow(/compare/)
  })
})

describe('configFieldSelector', () => {
  it.each([
    {
      path: 'Upper Arms > Length',
      expected:
        '.config-controls__section:has(> :text-is("Upper Arms")) label:has-text("Length:") input[type="number"]'
    },
    { path: 'Opacity', expected: 'label:has-text("Opacity:") input[type="number"]' }
  ])('finds $path', ({ path, expected }) => {
    expect(configFieldSelector(path)).toBe(expected)
  })
})

describe('glideValues', () => {
  it('passes through evenly spaced values and lands exactly on the target', () => {
    const values = glideValues(1, 0.7, 300)

    expect(values).toEqual([0.94, 0.88, 0.82, 0.76, 0.7])
  })

  it('jumps straight to the target when the glide takes no time', () => {
    expect(glideValues(1, 0.7, 0)).toEqual([0.7])
  })
})

describe('cutWindow', () => {
  it.each([
    { marks: { start: 2, end: 5 }, expected: { start: 2, duration: 3 } },
    { marks: { start: 2 }, expected: { start: 2, duration: 8 } },
    { marks: {}, expected: { start: 0, duration: 10 } }
  ])('keeps $expected.duration seconds for marks $marks', ({ marks, expected }) => {
    expect(cutWindow(marks, 10)).toEqual(expected)
  })

  it('refuses an end mark set before the start mark', () => {
    expect(() => cutWindow({ start: 4, end: 3 }, 10)).toThrow(/before the start/)
  })
})

describe('clipArguments', () => {
  it('cuts the window from the input before speeding it up', () => {
    const argumentList = clipArguments({
      source: 'raw.webm',
      target: 'clip.mp4',
      window: { start: 1.5, duration: 4 },
      speed: 4,
      width: 1100
    })

    const inputIndex = argumentList.indexOf('-i')
    expect(argumentList.indexOf('-ss')).toBeLessThan(inputIndex)
    expect(argumentList.indexOf('-t')).toBeLessThan(inputIndex)
    expect(argumentList).toContain('setpts=PTS/4,fps=30,scale=1100:-2')
    expect(argumentList.at(-1)).toBe('clip.mp4')
  })
})

describe('compareArguments', () => {
  it('stacks the two clips side by side and scales the pair back to one clip width', () => {
    const argumentList = compareArguments({
      left: 'before.mp4',
      right: 'after.mp4',
      target: 'compare.mp4',
      width: 1100
    })

    expect(argumentList.filter((argument) => argument === '-i')).toHaveLength(2)
    expect(argumentList).toContain('[0:v][1:v]hstack=inputs=2,scale=1100:-2')
  })
})

describe('wheelNotches', () => {
  it.each([
    { delta: -1600, notches: 16 },
    { delta: 250, notches: 3 },
    { delta: 30, notches: 1 }
  ])('splits $delta into $notches notches adding up to it', ({ delta, notches }) => {
    const split = wheelNotches(delta)

    expect(split).toHaveLength(notches)
    expect(split.reduce((total, notch) => total + notch, 0)).toBeCloseTo(delta)
  })
})

describe('dragPoints', () => {
  it('moves in even steps and ends on the target', () => {
    const points = dragPoints([550, 300], [550, 500])

    expect(points).toHaveLength(20)
    expect(points[0]).toEqual([550, 310])
    expect(points.at(-1)).toEqual([550, 500])
  })
})
