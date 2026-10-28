// @vitest-environment node
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import { parseArguments, outputFor } from './capture.mjs'

const DEFAULTS = {
  routes: [],
  all: false,
  out: '',
  base: 'http://localhost:5317',
  width: 1200,
  height: 630,
  wait: 8000
}

describe('parseArguments', () => {
  it.each([
    {
      scenario: 'collects routes with the OG defaults',
      argv: ['/games/MazeGame', '/generative/CubeMatrix'],
      expected: { ...DEFAULTS, routes: ['/games/MazeGame', '/generative/CubeMatrix'] }
    },
    {
      scenario: 'reads every option without treating its value as a route',
      argv: [
        '/games/TiltMaze',
        '--out',
        'shot.webp',
        '--size',
        '720x520',
        '--base',
        'http://localhost:5391',
        '--wait',
        '3000'
      ],
      expected: {
        ...DEFAULTS,
        routes: ['/games/TiltMaze'],
        out: resolve('shot.webp'),
        width: 720,
        height: 520,
        base: 'http://localhost:5391',
        wait: 3000
      }
    },
    {
      scenario: 'reads the all flag',
      argv: ['--all'],
      expected: { ...DEFAULTS, all: true }
    }
  ])('$scenario', ({ argv, expected }) => {
    expect(parseArguments(argv)).toEqual(expected)
  })
})

describe('outputFor', () => {
  it('writes to the explicit output when one is given', () => {
    expect(outputFor('/games/MazeGame', '/tmp/shot.webp')).toBe('/tmp/shot.webp')
  })

  it("writes to the route's OG image in public/ otherwise", () => {
    expect(outputFor('/games/MazeGame', '')).toBe(resolve('public/og/games/MazeGame.jpg'))
  })
})
