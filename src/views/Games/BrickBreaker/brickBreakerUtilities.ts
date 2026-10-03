import { seededRandomValues } from '@webgamekit/threejs'
import type { CoordinateTuple } from '@webgamekit/animation'
import {
  BALL_RADIUS,
  BALL_SPEED,
  BALL_SPEED_PER_WALL,
  BRICK_HEIGHT,
  BRICK_WIDTH,
  CAMERA_FIT_MARGIN,
  CAMERA_FOV,
  CAMERA_TILT_OFFSET,
  FIELD_BOTTOM_Y,
  FIELD_HALF_WIDTH,
  FIELD_TOP_Y,
  FRAME_THICKNESS,
  GARBAGE_BRICK_POINTS,
  GARBAGE_GAP_COUNT,
  GARBAGE_SEED_STRIDE,
  LAUNCH_ANGLE_RADIANS,
  MAX_BOUNCE_ANGLE_RADIANS,
  MAX_RESERVED_BOTTOM_FRACTION,
  MAX_SUBSTEP_DISTANCE,
  NORMAL_BRICK_POINTS,
  PADDLE_HEIGHT,
  PADDLE_SPEED,
  PADDLE_Y,
  ROW_COLORS,
  TOUGH_BRICK_CHANCE,
  TOUGH_BRICK_HIT_POINTS,
  TOUGH_BRICK_POINTS,
  WALL_SEED_STRIDE,
  WALL_TOP_Y
} from './config'
import type {
  BallState,
  BallStepResult,
  Brick,
  BrickBounds,
  BrickHitResult,
  BrickKind,
  PaddleState
} from './types'

const POINTS_BY_KIND: Record<BrickKind, number> = {
  normal: NORMAL_BRICK_POINTS,
  tough: TOUGH_BRICK_POINTS,
  garbage: GARBAGE_BRICK_POINTS
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value))

/**
 * Build a full wall of bricks from a seed. Every peer given the same seed and level builds an
 * identical wall, so a match never has to send brick positions over the network.
 * @param seed - Match seed
 * @param rowCount - Rows of bricks, counted from the top
 * @param columnCount - Bricks per row
 * @param level - How many walls this player has already cleared
 * @returns The bricks of the new wall
 */
export const createWall = (
  seed: number,
  rowCount: number,
  columnCount: number,
  level: number
): Brick[] => {
  const randomValues = seededRandomValues(seed + level * WALL_SEED_STRIDE, rowCount * columnCount)
  return randomValues.map((randomValue, index) => {
    const row = Math.floor(index / columnCount)
    const column = index % columnCount
    const isTough = randomValue < TOUGH_BRICK_CHANCE
    return {
      id: `brick-${level}-${row}-${column}`,
      row,
      column,
      hitPoints: isTough ? TOUGH_BRICK_HIT_POINTS : 1,
      kind: isTough ? 'tough' : 'normal',
      colorIndex: row % ROW_COLORS.length
    }
  })
}

/**
 * Axis-aligned bounds of a brick in field units.
 * @param brick - The brick to measure
 * @returns Its left, right, bottom and top edges
 */
export const brickBounds = (brick: Brick): BrickBounds => {
  const minX = -FIELD_HALF_WIDTH + brick.column * BRICK_WIDTH
  const maxY = WALL_TOP_Y - brick.row * BRICK_HEIGHT
  return { minX, maxX: minX + BRICK_WIDTH, minY: maxY - BRICK_HEIGHT, maxY }
}

const paddleBounds = (paddle: PaddleState): BrickBounds => ({
  minX: paddle.x - paddle.width / 2,
  maxX: paddle.x + paddle.width / 2,
  minY: PADDLE_Y - PADDLE_HEIGHT / 2,
  maxY: PADDLE_Y + PADDLE_HEIGHT / 2
})

const overlapsBall = (ball: BallState, bounds: BrickBounds): boolean => {
  const offsetX = ball.x - clamp(ball.x, bounds.minX, bounds.maxX)
  const offsetY = ball.y - clamp(ball.y, bounds.minY, bounds.maxY)
  return offsetX * offsetX + offsetY * offsetY < BALL_RADIUS * BALL_RADIUS
}

// The side the ball entered from decides the bounce axis. A centre already inside the box
// (only possible after a glancing corner hit) falls back to the shallower penetration.
const bounceOffBox = (ball: BallState, bounds: BrickBounds): BallState => {
  const offsetX = ball.x - clamp(ball.x, bounds.minX, bounds.maxX)
  const offsetY = ball.y - clamp(ball.y, bounds.minY, bounds.maxY)
  const isInside = offsetX === 0 && offsetY === 0
  const penetrationX = Math.min(ball.x - bounds.minX, bounds.maxX - ball.x)
  const penetrationY = Math.min(ball.y - bounds.minY, bounds.maxY - ball.y)
  const isHorizontal = isInside
    ? penetrationX < penetrationY
    : Math.abs(offsetX) > Math.abs(offsetY)
  if (isHorizontal) {
    const fromLeft = isInside ? ball.velocityX > 0 : offsetX < 0
    return {
      ...ball,
      x: fromLeft ? bounds.minX - BALL_RADIUS : bounds.maxX + BALL_RADIUS,
      velocityX: fromLeft ? -Math.abs(ball.velocityX) : Math.abs(ball.velocityX)
    }
  }
  const fromBelow = isInside ? ball.velocityY > 0 : offsetY < 0
  return {
    ...ball,
    y: fromBelow ? bounds.minY - BALL_RADIUS : bounds.maxY + BALL_RADIUS,
    velocityY: fromBelow ? -Math.abs(ball.velocityY) : Math.abs(ball.velocityY)
  }
}

const bounceOffFrame = (ball: BallState): BallState => {
  const minimumX = -FIELD_HALF_WIDTH + BALL_RADIUS
  const maximumX = FIELD_HALF_WIDTH - BALL_RADIUS
  const maximumY = FIELD_TOP_Y - BALL_RADIUS
  const velocityX =
    ball.x < minimumX
      ? Math.abs(ball.velocityX)
      : ball.x > maximumX
        ? -Math.abs(ball.velocityX)
        : ball.velocityX
  const velocityY = ball.y > maximumY ? -Math.abs(ball.velocityY) : ball.velocityY
  return {
    x: clamp(ball.x, minimumX, maximumX),
    y: Math.min(ball.y, maximumY),
    velocityX,
    velocityY
  }
}

// Where the ball lands on the paddle sets the outgoing angle, so the player aims by catching
// the ball off-centre, and the speed is preserved whatever the angle.
const bounceOffPaddle = (ball: BallState, paddle: PaddleState): BallState => {
  const speed = Math.hypot(ball.velocityX, ball.velocityY)
  const hitOffset = clamp((ball.x - paddle.x) / (paddle.width / 2), -1, 1)
  const angle = hitOffset * MAX_BOUNCE_ANGLE_RADIANS
  return {
    x: ball.x,
    y: PADDLE_Y + PADDLE_HEIGHT / 2 + BALL_RADIUS,
    velocityX: speed * Math.sin(angle),
    velocityY: speed * Math.cos(angle)
  }
}

const advanceSubstep = (
  step: BallStepResult,
  substepSeconds: number,
  paddle: PaddleState,
  bricks: Brick[]
): BallStepResult => {
  if (step.isLost) return step
  const moved = bounceOffFrame({
    ...step.ball,
    x: step.ball.x + step.ball.velocityX * substepSeconds,
    y: step.ball.y + step.ball.velocityY * substepSeconds
  })
  const isOnPaddle =
    moved.velocityY < 0 && moved.y > PADDLE_Y && overlapsBall(moved, paddleBounds(paddle))
  if (isOnPaddle) {
    return { ...step, ball: bounceOffPaddle(moved, paddle), hitPaddle: true }
  }
  const hitBrick = bricks.find(
    (brick) => !step.hitBrickIds.includes(brick.id) && overlapsBall(moved, brickBounds(brick))
  )
  if (hitBrick) {
    return {
      ...step,
      ball: bounceOffBox(moved, brickBounds(hitBrick)),
      hitBrickIds: [...step.hitBrickIds, hitBrick.id]
    }
  }
  return { ...step, ball: moved, isLost: moved.y < FIELD_BOTTOM_Y }
}

/**
 * Move the ball for one frame, bouncing off the frame, the paddle and the bricks. The frame is
 * split into substeps short enough that a fast ball cannot skip over a brick.
 * @param ball - Ball before the frame
 * @param deltaSeconds - Frame duration
 * @param paddle - Current paddle
 * @param bricks - Bricks still standing
 * @returns The moved ball, the bricks it hit, and whether it touched the paddle or was lost
 */
export const stepBall = (
  ball: BallState,
  deltaSeconds: number,
  paddle: PaddleState,
  bricks: Brick[]
): BallStepResult => {
  const distance = Math.hypot(ball.velocityX, ball.velocityY) * deltaSeconds
  const substepCount = Math.max(1, Math.ceil(distance / MAX_SUBSTEP_DISTANCE))
  const substepSeconds = deltaSeconds / substepCount
  const initial: BallStepResult = { ball, hitBrickIds: [], hitPaddle: false, isLost: false }
  return Array.from({ length: substepCount }).reduce<BallStepResult>(
    (step) => advanceSubstep(step, substepSeconds, paddle, bricks),
    initial
  )
}

/**
 * Take one hit point from each brick hit, removing the ones that reach zero.
 * @param bricks - Bricks before the hits
 * @param hitBrickIds - Ids of the bricks the ball hit
 * @returns The bricks left standing and the ones destroyed
 */
export const applyBrickHits = (bricks: Brick[], hitBrickIds: string[]): BrickHitResult => {
  const damaged = bricks.map((brick) =>
    hitBrickIds.includes(brick.id) ? { ...brick, hitPoints: brick.hitPoints - 1 } : brick
  )
  return {
    bricks: damaged.filter((brick) => brick.hitPoints > 0),
    destroyedBricks: bricks.filter(
      (brick) => hitBrickIds.includes(brick.id) && brick.hitPoints <= 1
    )
  }
}

/**
 * Points earned for a set of destroyed bricks.
 * @param destroyedBricks - Bricks destroyed
 * @returns Their combined points
 */
export const scoreForBricks = (destroyedBricks: Brick[]): number =>
  destroyedBricks.reduce((total, brick) => total + POINTS_BY_KIND[brick.kind], 0)

/**
 * How many garbage rows to send after destroying more bricks: one per full batch crossed.
 * @param destroyedBefore - Bricks destroyed so far before this frame
 * @param destroyedAfter - Bricks destroyed so far after this frame
 * @param bricksPerRow - Bricks needed to send one row
 * @returns Rows to send to rivals
 */
export const garbageRowsToSend = (
  destroyedBefore: number,
  destroyedAfter: number,
  bricksPerRow: number
): number => Math.floor(destroyedAfter / bricksPerRow) - Math.floor(destroyedBefore / bricksPerRow)

/**
 * Push the wall down and add garbage rows on top, each with a seeded gap so it can be broken
 * through. The same seed and generation always leave the same gaps.
 * @param bricks - Current wall
 * @param rowCount - Garbage rows to add
 * @param columnCount - Bricks per row
 * @param seed - Match seed
 * @param generation - How many garbage batches this player has received before
 * @returns The wall with the garbage added
 */
export const addGarbageRows = (
  bricks: Brick[],
  rowCount: number,
  columnCount: number,
  seed: number,
  generation: number
): Brick[] => {
  const gapStarts = seededRandomValues(seed + (generation + 1) * GARBAGE_SEED_STRIDE, rowCount)
  const garbage = gapStarts.flatMap((randomValue, row) => {
    const gapStart = Math.floor(randomValue * columnCount)
    const gapColumns = Array.from(
      { length: GARBAGE_GAP_COUNT },
      (_, offset) => (gapStart + offset) % columnCount
    )
    return Array.from({ length: columnCount }, (_, column) => column)
      .filter((column) => !gapColumns.includes(column))
      .map(
        (column): Brick => ({
          id: `garbage-${generation}-${row}-${column}`,
          row,
          column,
          hitPoints: 1,
          kind: 'garbage',
          colorIndex: 0
        })
      )
  })
  return [...bricks.map((brick) => ({ ...brick, row: brick.row + rowCount })), ...garbage]
}

/**
 * Whether the wall has been pushed down far enough to end the game.
 * @param bricks - Current wall
 * @param dangerRow - First row index that ends the game
 * @returns True once any brick sits on or below the danger row
 */
export const hasReachedDangerRow = (bricks: Brick[], dangerRow: number): boolean =>
  bricks.some((brick) => brick.row >= dangerRow)

/**
 * Slide the paddle sideways, stopping at the frame.
 * @param paddle - Paddle before the frame
 * @param direction - -1 for left, 1 for right, 0 to stay
 * @param deltaSeconds - Frame duration
 * @returns The moved paddle
 */
export const movePaddle = (
  paddle: PaddleState,
  direction: number,
  deltaSeconds: number
): PaddleState => {
  const limit = FIELD_HALF_WIDTH - paddle.width / 2
  return { ...paddle, x: clamp(paddle.x + direction * PADDLE_SPEED * deltaSeconds, -limit, limit) }
}

/**
 * A new ball resting on the paddle, launched up and slightly to the right.
 * @param paddle - Paddle to serve from
 * @param speed - Ball speed for this wall
 * @returns The served ball
 */
export const servedBall = (paddle: PaddleState, speed: number): BallState => ({
  x: paddle.x,
  y: PADDLE_Y + PADDLE_HEIGHT / 2 + BALL_RADIUS,
  velocityX: speed * Math.sin(LAUNCH_ANGLE_RADIANS),
  velocityY: speed * Math.cos(LAUNCH_ANGLE_RADIANS)
})

/**
 * Ball speed after a number of cleared walls.
 * @param clearedWalls - Walls cleared so far
 * @returns Speed in field units per second
 */
export const ballSpeedForWall = (clearedWalls: number): number =>
  BALL_SPEED + clearedWalls * BALL_SPEED_PER_WALL

const FRAME_HALF_WIDTH = FIELD_HALF_WIDTH + FRAME_THICKNESS
const FRAME_TOP_Y = FIELD_TOP_Y + FRAME_THICKNESS
const FRAME_HALF_HEIGHT = (FRAME_TOP_Y - FIELD_BOTTOM_Y) / 2
const FRAME_CENTRE_Y = (FRAME_TOP_Y + FIELD_BOTTOM_Y) / 2

// Half the height of the view at the field's plane, large enough for both the width and the
// height of the frame to fit above the reserved strip. The margin also absorbs the camera's
// slight upward tilt, which brings the bottom of the field closer than a straight-on fit assumes.
const visibleHalfHeight = (aspect: number, reservedFraction: number): number =>
  Math.max(FRAME_HALF_HEIGHT / (1 - reservedFraction), FRAME_HALF_WIDTH / aspect) *
  CAMERA_FIT_MARGIN

/**
 * Camera framing that fits the whole field, frame included, on any screen shape. A reserved
 * strip at the bottom of the screen, kept clear for touch buttons, pushes the field up into the
 * space above it.
 * @param aspect - Canvas width divided by height
 * @param reservedFraction - Share of the screen height to keep clear at the bottom
 * @returns Camera position and the point it looks at
 */
export const fitCameraToField = (
  aspect: number,
  reservedFraction: number
): { position: CoordinateTuple; lookAt: CoordinateTuple } => {
  const halfHeight = visibleHalfHeight(aspect, reservedFraction)
  const distance = halfHeight / Math.tan(((CAMERA_FOV / 2) * Math.PI) / 180)
  const lookAtY = FRAME_CENTRE_Y - reservedFraction * halfHeight
  return {
    position: [0, lookAtY + CAMERA_TILT_OFFSET, distance],
    lookAt: [0, lookAtY, 0]
  }
}

/**
 * How much of the screen height to keep clear for the touch buttons. The strip is needed only
 * when the buttons would overlap the field: on a wide screen they sit beside it instead.
 * @param canvasWidth - Canvas width in pixels
 * @param canvasHeight - Canvas height in pixels
 * @param buttonBandPx - Space one button needs from its corner, in pixels; 0 without buttons
 * @returns Share of the height to reserve at the bottom, capped at the maximum
 */
export const reservedBottomFraction = (
  canvasWidth: number,
  canvasHeight: number,
  buttonBandPx: number
): number => {
  if (buttonBandPx === 0 || canvasHeight === 0) return 0
  const aspect = canvasWidth / canvasHeight
  const fieldHalfWidthPx =
    (FRAME_HALF_WIDTH / (visibleHalfHeight(aspect, 0) * aspect)) * (canvasWidth / 2)
  const sideClearancePx = canvasWidth / 2 - fieldHalfWidthPx
  if (sideClearancePx >= buttonBandPx) return 0
  return Math.min(buttonBandPx / canvasHeight, MAX_RESERVED_BOTTOM_FRACTION)
}
