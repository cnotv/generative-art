import { describe, it, expect } from 'vitest'
import {
  createWall,
  brickBounds,
  stepBall,
  applyBrickHits,
  scoreForBricks,
  garbageRowsToSend,
  addGarbageRows,
  hasReachedDangerRow,
  movePaddle,
  servedBall,
  ballSpeedForWall
} from './brickBreakerUtilities'
import {
  BALL_RADIUS,
  BALL_SPEED,
  BALL_SPEED_PER_WALL,
  BRICK_COLUMN_COUNT,
  BRICK_HEIGHT,
  BRICK_WIDTH,
  FIELD_BOTTOM_Y,
  FIELD_HALF_WIDTH,
  FIELD_TOP_Y,
  GARBAGE_BRICK_POINTS,
  GARBAGE_GAP_COUNT,
  NORMAL_BRICK_POINTS,
  PADDLE_HEIGHT,
  PADDLE_SPEED,
  PADDLE_WIDTH,
  PADDLE_Y,
  TOUGH_BRICK_HIT_POINTS,
  TOUGH_BRICK_POINTS,
  WALL_TOP_Y
} from './config'
import type { BallState, Brick, BrickKind, PaddleState } from './types'

const centredPaddle: PaddleState = { x: 0, width: PADDLE_WIDTH }
const ballSpeed = (ball: BallState): number => Math.hypot(ball.velocityX, ball.velocityY)
const makeBrick = (row: number, column: number, kind: BrickKind = 'normal'): Brick => ({
  id: `test-${row}-${column}`,
  row,
  column,
  hitPoints: kind === 'tough' ? TOUGH_BRICK_HIT_POINTS : 1,
  kind,
  colorIndex: 0
})

describe('createWall', () => {
  it('builds the same wall from the same seed', () => {
    // Arrange
    const seed = 4242

    // Act
    const firstWall = createWall(seed, 6, BRICK_COLUMN_COUNT, 0)
    const secondWall = createWall(seed, 6, BRICK_COLUMN_COUNT, 0)

    // Assert
    expect(firstWall).toEqual(secondWall)
  })

  it('builds a different wall from a different seed', () => {
    // Arrange
    const kinds = (wall: Brick[]): string => wall.map((brick) => brick.kind).join()

    // Act
    const firstWall = createWall(1, 6, BRICK_COLUMN_COUNT, 0)
    const secondWall = createWall(2, 6, BRICK_COLUMN_COUNT, 0)

    // Assert
    expect(kinds(firstWall)).not.toBe(kinds(secondWall))
  })

  it('fills every row and column once, with unique ids', () => {
    // Act
    const wall = createWall(7, 4, BRICK_COLUMN_COUNT, 0)

    // Assert
    expect(wall).toHaveLength(4 * BRICK_COLUMN_COUNT)
    expect(new Set(wall.map((brick) => brick.id)).size).toBe(wall.length)
    expect(new Set(wall.map((brick) => `${brick.row}:${brick.column}`)).size).toBe(wall.length)
    expect(Math.max(...wall.map((brick) => brick.row))).toBe(3)
    expect(Math.max(...wall.map((brick) => brick.column))).toBe(BRICK_COLUMN_COUNT - 1)
  })

  it('gives each kind of brick its own hit points', () => {
    // Act
    const wall = createWall(99, 6, BRICK_COLUMN_COUNT, 0)

    // Assert
    expect(wall.some((brick) => brick.kind === 'tough')).toBe(true)
    wall.forEach((brick) => {
      expect(brick.hitPoints).toBe(brick.kind === 'tough' ? TOUGH_BRICK_HIT_POINTS : 1)
    })
  })

  it('uses unique ids for walls built at different levels', () => {
    // Act
    const firstLevel = createWall(5, 2, BRICK_COLUMN_COUNT, 0)
    const secondLevel = createWall(5, 2, BRICK_COLUMN_COUNT, 1)
    const ids = [...firstLevel, ...secondLevel].map((brick) => brick.id)

    // Assert
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('brickBounds', () => {
  it.each([
    [0, 0, -FIELD_HALF_WIDTH, -FIELD_HALF_WIDTH + BRICK_WIDTH, WALL_TOP_Y],
    [2, 7, FIELD_HALF_WIDTH - BRICK_WIDTH, FIELD_HALF_WIDTH, WALL_TOP_Y - 2 * BRICK_HEIGHT]
  ])('places row %i column %i on the grid', (row, column, minX, maxX, maxY) => {
    // Act
    const bounds = brickBounds(makeBrick(row, column))

    // Assert
    expect(bounds.minX).toBeCloseTo(minX)
    expect(bounds.maxX).toBeCloseTo(maxX)
    expect(bounds.maxY).toBeCloseTo(maxY)
    expect(bounds.minY).toBeCloseTo(maxY - BRICK_HEIGHT)
  })
})

describe('stepBall', () => {
  it.each([
    [
      'left wall',
      { x: -FIELD_HALF_WIDTH + 0.3, y: 0, velocityX: -8, velocityY: 6 },
      'velocityX',
      1
    ],
    [
      'right wall',
      { x: FIELD_HALF_WIDTH - 0.3, y: 0, velocityX: 8, velocityY: 6 },
      'velocityX',
      -1
    ],
    ['ceiling', { x: 0, y: FIELD_TOP_Y - 0.3, velocityX: 6, velocityY: 8 }, 'velocityY', -1]
  ] as const)('bounces off the %s and keeps its speed', (_label, ball, axis, expectedSign) => {
    // Act
    const result = stepBall(ball, 0.05, centredPaddle, [])

    // Assert
    expect(Math.sign(result.ball[axis])).toBe(expectedSign)
    expect(ballSpeed(result.ball)).toBeCloseTo(ballSpeed(ball))
  })

  it('bounces straight up off the middle of the paddle', () => {
    // Arrange
    const ball: BallState = {
      x: 0,
      y: PADDLE_Y + PADDLE_HEIGHT / 2 + BALL_RADIUS + 0.05,
      velocityX: 0,
      velocityY: -BALL_SPEED
    }

    // Act
    const result = stepBall(ball, 0.05, centredPaddle, [])

    // Assert
    expect(result.hitPaddle).toBe(true)
    expect(result.ball.velocityY).toBeGreaterThan(0)
    expect(result.ball.velocityX).toBeCloseTo(0)
  })

  it.each([
    ['right', 1],
    ['left', -1]
  ] as const)('angles the bounce towards the %s edge of the paddle', (_side, direction) => {
    // Arrange
    const ball: BallState = {
      x: direction * (PADDLE_WIDTH / 2 - 0.1),
      y: PADDLE_Y + PADDLE_HEIGHT / 2 + BALL_RADIUS + 0.05,
      velocityX: 0,
      velocityY: -BALL_SPEED
    }

    // Act
    const result = stepBall(ball, 0.05, centredPaddle, [])

    // Assert
    expect(Math.sign(result.ball.velocityX)).toBe(direction)
    expect(result.ball.velocityY).toBeGreaterThan(0)
    expect(ballSpeed(result.ball)).toBeCloseTo(BALL_SPEED)
  })

  it('passes through the paddle while moving up', () => {
    // Arrange
    const ball: BallState = { x: 0, y: PADDLE_Y, velocityX: 0, velocityY: BALL_SPEED }

    // Act
    const result = stepBall(ball, 0.02, centredPaddle, [])

    // Assert
    expect(result.hitPaddle).toBe(false)
    expect(result.ball.velocityY).toBeGreaterThan(0)
  })

  it('breaks a brick it hits from below and bounces back down', () => {
    // Arrange
    const brick = makeBrick(0, 3)
    const bounds = brickBounds(brick)
    const ball: BallState = {
      x: (bounds.minX + bounds.maxX) / 2,
      y: bounds.minY - BALL_RADIUS - 0.05,
      velocityX: 0,
      velocityY: BALL_SPEED
    }

    // Act
    const result = stepBall(ball, 0.05, centredPaddle, [brick])

    // Assert
    expect(result.hitBrickIds).toEqual([brick.id])
    expect(result.ball.velocityY).toBeLessThan(0)
  })

  it('reverses sideways when it hits the side of a brick', () => {
    // Arrange
    const brick = makeBrick(3, 4)
    const bounds = brickBounds(brick)
    const ball: BallState = {
      x: bounds.minX - BALL_RADIUS - 0.05,
      y: (bounds.minY + bounds.maxY) / 2,
      velocityX: BALL_SPEED,
      velocityY: 0.5
    }

    // Act
    const result = stepBall(ball, 0.05, centredPaddle, [brick])

    // Assert
    expect(result.hitBrickIds).toEqual([brick.id])
    expect(result.ball.velocityX).toBeLessThan(0)
  })

  it('does not tunnel through a brick on a long frame', () => {
    // Arrange
    const brick = makeBrick(0, 3)
    const bounds = brickBounds(brick)
    const ball: BallState = {
      x: (bounds.minX + bounds.maxX) / 2,
      y: bounds.minY - 3,
      velocityX: 0,
      velocityY: BALL_SPEED
    }

    // Act
    const result = stepBall(ball, 0.5, centredPaddle, [brick])

    // Assert
    expect(result.hitBrickIds).toEqual([brick.id])
    expect(result.ball.y).toBeLessThan(bounds.minY)
  })

  it('reports the ball lost once it falls below the field', () => {
    // Arrange
    const ball: BallState = {
      x: FIELD_HALF_WIDTH - 1,
      y: FIELD_BOTTOM_Y + 0.1,
      velocityX: 0,
      velocityY: -BALL_SPEED
    }

    // Act
    const result = stepBall(ball, 0.05, centredPaddle, [])

    // Assert
    expect(result.isLost).toBe(true)
  })
})

describe('applyBrickHits', () => {
  it('removes a normal brick on its first hit', () => {
    // Arrange
    const bricks = [makeBrick(0, 0), makeBrick(0, 1)]

    // Act
    const result = applyBrickHits(bricks, [bricks[0].id])

    // Assert
    expect(result.bricks.map((brick) => brick.id)).toEqual([bricks[1].id])
    expect(result.destroyedBricks).toEqual([bricks[0]])
  })

  it('keeps a tough brick after one hit, with one hit point fewer', () => {
    // Arrange
    const bricks = [makeBrick(0, 0, 'tough')]

    // Act
    const result = applyBrickHits(bricks, [bricks[0].id])

    // Assert
    expect(result.destroyedBricks).toEqual([])
    expect(result.bricks[0].hitPoints).toBe(TOUGH_BRICK_HIT_POINTS - 1)
  })

  it('ignores ids that are not in the wall', () => {
    // Arrange
    const bricks = [makeBrick(0, 0)]

    // Act
    const result = applyBrickHits(bricks, ['missing'])

    // Assert
    expect(result.bricks).toEqual(bricks)
    expect(result.destroyedBricks).toEqual([])
  })
})

describe('scoreForBricks', () => {
  it.each([
    ['normal', NORMAL_BRICK_POINTS],
    ['tough', TOUGH_BRICK_POINTS],
    ['garbage', GARBAGE_BRICK_POINTS]
  ] as const)('scores a %s brick', (kind, points) => {
    // Act
    const score = scoreForBricks([makeBrick(0, 0, kind)])

    // Assert
    expect(score).toBe(points)
  })

  it('adds up several bricks', () => {
    // Act
    const score = scoreForBricks([makeBrick(0, 0), makeBrick(0, 1, 'tough')])

    // Assert
    expect(score).toBe(NORMAL_BRICK_POINTS + TOUGH_BRICK_POINTS)
  })
})

describe('garbageRowsToSend', () => {
  it.each([
    [0, 7, 0],
    [0, 8, 1],
    [7, 9, 1],
    [8, 15, 0],
    [15, 32, 3]
  ])('sends rows when the total destroyed goes from %i to %i', (before, after, expected) => {
    // Act
    const rows = garbageRowsToSend(before, after, 8)

    // Assert
    expect(rows).toBe(expected)
  })
})

describe('addGarbageRows', () => {
  it('pushes the existing wall down by the number of rows added', () => {
    // Arrange
    const bricks = [makeBrick(0, 0), makeBrick(2, 5)]

    // Act
    const result = addGarbageRows(bricks, 2, BRICK_COLUMN_COUNT, 11, 0)

    // Assert
    const moved = result.filter((brick) => brick.kind !== 'garbage')
    expect(moved.map((brick) => brick.row)).toEqual([2, 4])
  })

  it('adds garbage rows at the top with a gap in each row', () => {
    // Act
    const result = addGarbageRows([], 3, BRICK_COLUMN_COUNT, 11, 0)

    // Assert
    expect(result.every((brick) => brick.kind === 'garbage')).toBe(true)
    ;[0, 1, 2].forEach((row) => {
      expect(result.filter((brick) => brick.row === row)).toHaveLength(
        BRICK_COLUMN_COUNT - GARBAGE_GAP_COUNT
      )
    })
  })

  it('places the same gaps for the same seed and generation', () => {
    // Act
    const first = addGarbageRows([], 2, BRICK_COLUMN_COUNT, 11, 3)
    const second = addGarbageRows([], 2, BRICK_COLUMN_COUNT, 11, 3)

    // Assert
    expect(first).toEqual(second)
  })

  it('never reuses an id from an earlier garbage batch', () => {
    // Act
    const first = addGarbageRows([], 1, BRICK_COLUMN_COUNT, 11, 0)
    const second = addGarbageRows(first, 1, BRICK_COLUMN_COUNT, 11, 1)
    const ids = second.map((brick) => brick.id)

    // Assert
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('hasReachedDangerRow', () => {
  it.each([
    [[], false],
    [[makeBrick(16, 0)], false],
    [[makeBrick(17, 0)], true],
    [[makeBrick(2, 0), makeBrick(20, 3)], true]
  ])('checks the lowest brick against the danger row (case %#)', (bricks, expected) => {
    // Act
    const reached = hasReachedDangerRow(bricks, 17)

    // Assert
    expect(reached).toBe(expected)
  })
})

describe('movePaddle', () => {
  it.each([
    [-1, -PADDLE_SPEED * 0.1],
    [1, PADDLE_SPEED * 0.1],
    [0, 0]
  ] as const)('moves in direction %i at paddle speed', (direction, expectedX) => {
    // Act
    const paddle = movePaddle(centredPaddle, direction, 0.1)

    // Assert
    expect(paddle.x).toBeCloseTo(expectedX)
  })

  it.each([
    [-1, -FIELD_HALF_WIDTH + PADDLE_WIDTH / 2],
    [1, FIELD_HALF_WIDTH - PADDLE_WIDTH / 2]
  ] as const)('stops at the side of the field (direction %i)', (direction, limitX) => {
    // Act
    const paddle = movePaddle(centredPaddle, direction, 5)

    // Assert
    expect(paddle.x).toBeCloseTo(limitX)
  })
})

describe('servedBall', () => {
  it('starts just above the paddle, moving up at the given speed', () => {
    // Arrange
    const paddle: PaddleState = { x: 2, width: PADDLE_WIDTH }

    // Act
    const ball = servedBall(paddle, BALL_SPEED)

    // Assert
    expect(ball.x).toBe(2)
    expect(ball.y).toBeGreaterThan(PADDLE_Y + PADDLE_HEIGHT / 2)
    expect(ball.velocityY).toBeGreaterThan(0)
    expect(ballSpeed(ball)).toBeCloseTo(BALL_SPEED)
  })
})

describe('ballSpeedForWall', () => {
  it.each([
    [0, BALL_SPEED],
    [3, BALL_SPEED + 3 * BALL_SPEED_PER_WALL]
  ])('speeds the ball up after %i cleared walls', (clearedWalls, expected) => {
    // Act
    const speed = ballSpeedForWall(clearedWalls)

    // Assert
    expect(speed).toBe(expected)
  })
})
