import { describe, it, expect } from 'vitest'
import type { CoordinateTuple } from '@webgamekit/animation'
import {
  applyTiltInversion,
  findNearestHole,
  getKeyboardTilt,
  getTiltGravity,
  planMazeHoles,
  smoothTilt
} from './tilt'
import { getBoardLayout, getCameraHeight } from './layout'
import { getRectangularCellCenters } from '@/views/Games/MazeGame/helpers/maze'
import {
  BASE_SHORT_AXIS_CELLS,
  BOARD_SHORT_EXTENT,
  HOLE_SPACING_IN_CELLS,
  MAX_CELLS_LONG_AXIS,
  MAX_SHORT_AXIS_CELLS,
  WALL_HEIGHT,
  WALL_THICKNESS
} from './config'
import { getLevelConfig, getNextLevel } from './levels'
import { isNewBest, loadBestLevel } from './record'
import { getSecureUrl, getSensorGuidance, getSensorPlatform } from './sensorGuidance'
import type { MazeHole, SensorPlatform, SensorState } from './types'

const LEVEL_ONE = getLevelConfig(1)
const MAZE_CELL_SIZE = LEVEL_ONE.cellSize
const TRAP_HOLE_COUNT = LEVEL_ONE.trapCount
const HOLE_MIN_SPACING = MAZE_CELL_SIZE * HOLE_SPACING_IN_CELLS
const BALL_START = getBoardLayout(600, 600, LEVEL_ONE).ballStart

describe('applyTiltInversion', () => {
  it('leaves the lean alone when not inverted', () => {
    expect(applyTiltInversion({ tiltX: 5, tiltZ: -3 }, false)).toEqual({ tiltX: 5, tiltZ: -3 })
  })

  it('flips both axes when inverted', () => {
    expect(applyTiltInversion({ tiltX: 5, tiltZ: -3 }, true)).toEqual({ tiltX: -5, tiltZ: 3 })
  })
})

describe('getTiltGravity', () => {
  it('points straight down when the board is level', () => {
    const gravity = getTiltGravity({ tiltX: 0, tiltZ: 0 }, 30)

    expect(gravity.x).toBeCloseTo(0)
    expect(gravity.y).toBeCloseTo(-30)
    expect(gravity.z).toBeCloseTo(0)
  })

  it('pulls toward screen-right when the board leans right', () => {
    expect(getTiltGravity({ tiltX: 20, tiltZ: 0 }, 30).x).toBeGreaterThan(0)
  })

  it('pulls toward screen-bottom when the board leans forward', () => {
    expect(getTiltGravity({ tiltX: 0, tiltZ: 20 }, 30).z).toBeGreaterThan(0)
  })

  it('keeps the magnitude at the configured strength on a diagonal lean', () => {
    const { x, y, z } = getTiltGravity({ tiltX: 18, tiltZ: -12 }, 30)

    expect(Math.hypot(x, y, z)).toBeCloseTo(30)
  })
})

describe('smoothTilt', () => {
  it('moves only a fraction of the way toward the target', () => {
    expect(smoothTilt({ tiltX: 0, tiltZ: 0 }, { tiltX: 10, tiltZ: -10 }, 0.25)).toEqual({
      tiltX: 2.5,
      tiltZ: -2.5
    })
  })

  it('converges on the target when applied repeatedly', () => {
    const settled = Array.from({ length: 200 }).reduce(
      (current: { tiltX: number; tiltZ: number }) =>
        smoothTilt(current, { tiltX: 10, tiltZ: -10 }, 0.25),
      { tiltX: 0, tiltZ: 0 }
    )

    expect(settled.tiltX).toBeCloseTo(10)
    expect(settled.tiltZ).toBeCloseTo(-10)
  })
})

describe('getKeyboardTilt', () => {
  it('is level when nothing is held', () => {
    expect(getKeyboardTilt([], 16)).toEqual({ tiltX: 0, tiltZ: 0 })
  })

  it('leans on the held direction', () => {
    expect(getKeyboardTilt(['tilt-right', 'tilt-up'], 16)).toEqual({ tiltX: 16, tiltZ: -16 })
  })

  it('cancels opposing directions instead of preferring one', () => {
    expect(getKeyboardTilt(['tilt-left', 'tilt-right'], 16)).toEqual({ tiltX: 0, tiltZ: 0 })
  })
})

describe('getNextLevel', () => {
  it('climbs a level when the goal hole is reached', () => {
    expect(getNextLevel(3, 'won')).toBe(4)
  })

  /**
   * A trap costs ground rather than the run. Losing everything to one hole punishes a slip
   * harder than it punishes bad play, and makes only the last thirty seconds matter.
   */
  it('drops a level when a trap hole is fallen into', () => {
    expect(getNextLevel(3, 'trapped')).toBe(2)
  })

  it('cannot fall below the first level', () => {
    expect(getNextLevel(1, 'trapped')).toBe(1)
  })
})

describe('findNearestHole', () => {
  const holes: MazeHole[] = [
    { position: [0, 0, 0], isGoal: false },
    { position: [20, 0, 0], isGoal: true }
  ]

  it('picks the hole the ball actually dropped through', () => {
    expect(findNearestHole(18, 0, holes)?.isGoal).toBe(true)
    expect(findNearestHole(2, 0, holes)?.isGoal).toBe(false)
  })

  it('returns nothing when the board has no holes', () => {
    expect(findNearestHole(0, 0, [])).toBeUndefined()
  })
})

describe('planMazeHoles', () => {
  const layout = getBoardLayout(390, 844, LEVEL_ONE)
  const cellCenters: CoordinateTuple[] = getRectangularCellCenters(
    layout.boardWidth,
    layout.boardDepth,
    MAZE_CELL_SIZE
  )
  const holes = planMazeHoles(cellCenters, layout.ballStart, TRAP_HOLE_COUNT, HOLE_MIN_SPACING)

  it('cuts exactly one goal', () => {
    expect(holes.filter((hole) => hole.isGoal)).toHaveLength(1)
  })

  it('puts the goal at the cell furthest from the start', () => {
    const goal = holes.find((hole) => hole.isGoal)
    const furthest = Math.max(
      ...cellCenters.map((cell) =>
        Math.hypot(cell[0] - layout.ballStart[0], cell[2] - layout.ballStart[2])
      )
    )

    expect(
      Math.hypot(goal!.position[0] - layout.ballStart[0], goal!.position[2] - layout.ballStart[2])
    ).toBeCloseTo(furthest)
  })

  it('never opens a hole on top of the spawn', () => {
    holes.forEach(({ position }) =>
      expect(
        Math.hypot(position[0] - layout.ballStart[0], position[2] - layout.ballStart[2])
      ).toBeGreaterThanOrEqual(HOLE_MIN_SPACING)
    )
  })

  it('keeps every pair of holes at least the minimum spacing apart', () => {
    holes.forEach((hole, index) =>
      holes
        .slice(index + 1)
        .forEach((other) =>
          expect(
            Math.hypot(hole.position[0] - other.position[0], hole.position[2] - other.position[2])
          ).toBeGreaterThanOrEqual(HOLE_MIN_SPACING)
        )
    )
  })

  it('cuts no holes when there is no cell far enough from the start', () => {
    expect(planMazeHoles([BALL_START], BALL_START, TRAP_HOLE_COUNT, HOLE_MIN_SPACING)).toEqual([])
  })
})

describe('getBoardLayout', () => {
  it.each([
    ['iPhone portrait', 390, 844],
    ['iPhone landscape', 844, 390],
    ['tablet portrait', 820, 1180],
    ['desktop', 1920, 1080],
    ['square', 600, 600]
  ])('gives %s a board whose aspect follows the screen', (_label, width, height) => {
    const layout = getBoardLayout(width, height, LEVEL_ONE)
    const screenIsWide = width >= height

    expect(layout.boardWidth >= layout.boardDepth).toBe(screenIsWide)
  })

  it('keeps the short axis at a constant cell count so corridors never change width', () => {
    const portrait = getBoardLayout(390, 844, LEVEL_ONE)
    const landscape = getBoardLayout(844, 390, LEVEL_ONE)

    expect(portrait.columns).toBe(BASE_SHORT_AXIS_CELLS)
    expect(landscape.rows).toBe(BASE_SHORT_AXIS_CELLS)
  })

  it('spawns the ball inside the first cell, not on the rim', () => {
    const layout = getBoardLayout(390, 844, LEVEL_ONE)

    expect(layout.ballStart[0]).toBeCloseTo(-layout.boardWidth / 2 + MAZE_CELL_SIZE / 2)
    expect(layout.ballStart[2]).toBeCloseTo(-layout.boardDepth / 2 + MAZE_CELL_SIZE / 2)
  })

  it('caps the long axis so an extreme aspect cannot generate an endless maze', () => {
    const layout = getBoardLayout(4000, 200, LEVEL_ONE)

    expect(layout.columns).toBe(MAX_CELLS_LONG_AXIS)
  })

  it('survives a zero height without dividing by zero', () => {
    expect(Number.isFinite(getBoardLayout(390, 0, LEVEL_ONE).boardWidth)).toBe(true)
  })
})

describe('getCameraHeight', () => {
  it.each([
    ['portrait', 390, 844],
    ['landscape', 844, 390],
    ['desktop', 1920, 1080]
  ])('frames the whole board on %s', (_label, width, height) => {
    const layout = getBoardLayout(width, height, LEVEL_ONE)
    const cameraHeight = getCameraHeight(layout, width, height)
    const halfFovTangent = Math.tan(((55 / 2) * Math.PI) / 180)

    // Measured at the top of the walls, which is the plane that actually has to fit.
    const visibleDepth = 2 * (cameraHeight - WALL_HEIGHT) * halfFovTangent
    const visibleWidth = visibleDepth * (width / height)

    expect(visibleDepth).toBeGreaterThanOrEqual(layout.boardDepth)
    expect(visibleWidth).toBeGreaterThanOrEqual(layout.boardWidth)
  })

  it('pulls back further for a taller board', () => {
    const shortBoard = getBoardLayout(600, 600, LEVEL_ONE)
    const tallBoard = getBoardLayout(390, 844, LEVEL_ONE)

    expect(getCameraHeight(tallBoard, 390, 844)).toBeGreaterThan(
      getCameraHeight(shortBoard, 600, 600)
    )
  })
})

describe('planMazeHoles spread', () => {
  const layout = getBoardLayout(390, 844, LEVEL_ONE)
  const cellCenters = getRectangularCellCenters(
    layout.boardWidth,
    layout.boardDepth,
    MAZE_CELL_SIZE
  )
  const holes = planMazeHoles(cellCenters, layout.ballStart, TRAP_HOLE_COUNT, HOLE_MIN_SPACING)
  const traps = holes.filter((hole) => !hole.isGoal)

  it('places traps across the whole run, not only near the goal', () => {
    const distances = traps.map((trap) =>
      Math.hypot(trap.position[0] - layout.ballStart[0], trap.position[2] - layout.ballStart[2])
    )
    const goal = holes.find((hole) => hole.isGoal)!
    const runLength = Math.hypot(
      goal.position[0] - layout.ballStart[0],
      goal.position[2] - layout.ballStart[2]
    )

    expect(Math.min(...distances)).toBeLessThan(runLength / 2)
    expect(Math.max(...distances)).toBeGreaterThan(runLength / 2)
  })
})

describe('getSensorPlatform', () => {
  it.each([
    [
      'iPhone Safari',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15',
      'ios'
    ],
    [
      'iPhone Chrome',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) CriOS/122.0 Mobile',
      'ios'
    ],
    [
      'iPhone Firefox',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) FxiOS/124.0 Mobile',
      'ios'
    ],
    ['Android Chrome', 'Mozilla/5.0 (Linux; Android 14) Chrome/122.0 Mobile', 'android'],
    ['desktop', 'Mozilla/5.0 (Windows NT 10.0; Win64) Chrome/122.0', 'desktop']
  ])('reads %s as the platform whose settings govern the sensor', (_label, agent, expected) => {
    expect(getSensorPlatform(agent)).toBe(expected)
  })

  it('groups every iOS browser together, because they all run WebKit', () => {
    const safari = getSensorPlatform('Mozilla/5.0 (iPhone) AppleWebKit/605.1.15')
    const chrome = getSensorPlatform('Mozilla/5.0 (iPhone) CriOS/122.0')

    expect(chrome).toBe(safari)
  })
})

describe('getSecureUrl', () => {
  it('rewrites an insecure page onto HTTPS, keeping host, port and path', () => {
    expect(getSecureUrl('http://192.168.1.40:5317/games/TiltMaze')).toBe(
      'https://192.168.1.40:5317/games/TiltMaze'
    )
  })

  it('offers nothing when the page is already secure', () => {
    expect(getSecureUrl('https://example.com/games/TiltMaze')).toBeNull()
  })
})

describe('getSensorGuidance', () => {
  const working: SensorState = {
    isSupported: true,
    isSecureContext: true,
    permission: 'granted',
    isReceiving: true,
    platform: 'ios'
  }

  it('never interrupts a desktop, where the keyboard is the intended input', () => {
    const everyBlockedState = [
      { isSupported: false },
      { isSecureContext: false },
      { permission: 'denied' as const },
      { permission: 'prompt' as const },
      { isReceiving: false }
    ]

    everyBlockedState.forEach((override) =>
      expect(getSensorGuidance({ ...working, platform: 'desktop', ...override }).reason).toBeNull()
    )
  })

  it('reports nothing to fix when the sensor is working', () => {
    expect(getSensorGuidance(working).reason).toBeNull()
  })

  it.each([
    ['no sensor API', { isSupported: false }, 'unsupported'],
    ['an insecure origin', { isSecureContext: false }, 'insecure-context'],
    ['a refusal', { permission: 'denied' as const }, 'permission-denied'],
    ['an unanswered prompt', { permission: 'prompt' as const }, 'awaiting-permission'],
    ['a silent sensor', { isReceiving: false }, 'silent-sensor']
  ])('names %s as the cause', (_label, override, expected) => {
    expect(getSensorGuidance({ ...working, ...override }).reason).toBe(expected)
  })

  it('prefers the insecure origin over a permission state, since it is the upstream cause', () => {
    const guidance = getSensorGuidance({
      ...working,
      isSecureContext: false,
      permission: 'denied'
    })

    expect(guidance.reason).toBe('insecure-context')
  })

  it('offers a fix the page can perform itself wherever one exists', () => {
    const insecure = getSensorGuidance({ ...working, isSecureContext: false })
    const denied = getSensorGuidance({ ...working, permission: 'denied' })

    expect(insecure.fix).toBe('reload-secure')
    expect(denied.fix).toBe('request-permission')
  })

  it('offers no button when nothing but the player can resolve it', () => {
    expect(getSensorGuidance({ ...working, isSupported: false }).fix).toBeNull()
  })

  it('tells an iPhone to clear the stored refusal, since iOS 13 removed the global toggle', () => {
    const guidance = getSensorGuidance({ ...working, permission: 'denied', platform: 'ios' })

    expect(guidance.steps.join(' ')).toContain('Website Data')
  })

  it('never sends anyone to the Motion & Orientation Access switch, which no longer exists', () => {
    const everyPlatform: SensorPlatform[] = ['ios', 'android', 'desktop']
    const everyBlockedState = [
      { isSupported: false },
      { isSecureContext: false },
      { permission: 'denied' as const },
      { permission: 'prompt' as const },
      { isReceiving: false }
    ]

    everyPlatform.forEach((platform) =>
      everyBlockedState.forEach((override) => {
        const guidance = getSensorGuidance({ ...working, platform, ...override })
        expect(guidance.steps.join(' ')).not.toContain('Motion & Orientation Access and turn it on')
      })
    )
  })

  it('does not send an Android user to an iOS remedy', () => {
    const guidance = getSensorGuidance({ ...working, permission: 'denied', platform: 'android' })

    expect(guidance.steps.join(' ')).not.toContain('Website Data')
  })

  it('always gives the player something to do', () => {
    const blocked = [
      { isSupported: false },
      { isSecureContext: false },
      { permission: 'denied' as const },
      { permission: 'prompt' as const },
      { isReceiving: false }
    ]

    blocked.forEach((override) => {
      const guidance = getSensorGuidance({ ...working, ...override })
      expect(guidance.title.length).toBeGreaterThan(0)
      expect(guidance.steps.length).toBeGreaterThan(0)
    })
  })
})

describe('getLevelConfig', () => {
  it('starts at the base cell count', () => {
    expect(getLevelConfig(1).shortAxisCells).toBe(BASE_SHORT_AXIS_CELLS)
  })

  it('cuts the board into more cells as levels rise', () => {
    const counts = [1, 2, 3, 4].map((level) => getLevelConfig(level).shortAxisCells)

    expect(counts).toEqual([...counts].sort((first, second) => first - second))
    expect(counts[3]).toBeGreaterThan(counts[0])
  })

  it('keeps the board the same size, so a harder level is finer rather than bigger', () => {
    ;[1, 3, 6, 20].forEach((level) => {
      const { shortAxisCells, cellSize } = getLevelConfig(level)
      expect(shortAxisCells * cellSize).toBeCloseTo(BOARD_SHORT_EXTENT)
    })
  })

  it('adds traps each level', () => {
    expect(getLevelConfig(3).trapCount).toBeGreaterThan(getLevelConfig(1).trapCount)
  })

  it('stops getting harder rather than becoming impossible', () => {
    const late = getLevelConfig(999)

    expect(late.shortAxisCells).toBe(MAX_SHORT_AXIS_CELLS)
    expect(late.trapCount).toBeLessThanOrEqual(28)
  })

  it('always leaves a hole the ball can fall through', () => {
    ;[1, 2, 5, 10, 999].forEach((level) => {
      const { holeRadius, ballRadius } = getLevelConfig(level)
      expect(holeRadius).toBeGreaterThan(ballRadius)
    })
  })

  it('always leaves a corridor the ball fits down', () => {
    ;[1, 2, 5, 10, 999].forEach((level) => {
      const { cellSize, ballRadius } = getLevelConfig(level)
      expect(ballRadius * 2).toBeLessThan(cellSize - WALL_THICKNESS)
    })
  })

  it('varies the generator so two levels of a size still differ', () => {
    const algorithms = [1, 2, 3, 4].map((level) => getLevelConfig(level).algorithm)

    expect(new Set(algorithms).size).toBeGreaterThan(1)
  })
})

describe('board layout across levels', () => {
  it('keeps filling a phone screen as the maze gets finer', () => {
    ;[1, 4, 999].forEach((level) => {
      const layout = getBoardLayout(390, 844, getLevelConfig(level))
      expect(layout.boardWidth).toBeCloseTo(BOARD_SHORT_EXTENT)
      expect(layout.boardDepth).toBeGreaterThan(layout.boardWidth)
    })
  })

  it('spawns the ball inside the first cell at every level', () => {
    ;[1, 5, 999].forEach((level) => {
      const config = getLevelConfig(level)
      const layout = getBoardLayout(390, 844, config)
      expect(layout.ballStart[0]).toBeCloseTo(-layout.boardWidth / 2 + config.cellSize / 2)
    })
  })
})

describe('isNewBest', () => {
  it.each([
    ['a first run', 3, 0, true],
    ['beating the record', 7, 5, true],
    ['matching the record', 5, 5, false],
    ['falling short', 2, 5, false]
  ])('reports %s correctly', (_label, reached, best, expected) => {
    expect(isNewBest(reached as number, best as number)).toBe(expected)
  })
})

describe('loadBestLevel', () => {
  const withStorage = (value: string | null, throws = false): void => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => {
          if (throws) throw new Error('blocked')
          return value
        },
        setItem: () => undefined
      }
    })
  }

  it('reads a stored record', () => {
    withStorage('12')

    expect(loadBestLevel()).toBe(12)
  })

  it.each([
    ['nothing stored', null],
    ['a non-numeric value', 'abc'],
    ['a nonsense level', '-4']
  ])('treats %s as no record', (_label, stored) => {
    withStorage(stored as string | null)

    expect(loadBestLevel()).toBe(0)
  })

  it('survives storage being blocked, as it is in some private modes', () => {
    withStorage(null, true)

    expect(loadBestLevel()).toBe(0)
  })
})
