import * as THREE from 'three'
import { createGoalBeacon } from './goalBeacon'
import { createLevelPoster } from './levelPoster'
import type { BuiltLevel } from './types'

/**
 * The two things drawn on the board that are not the maze: the level printed on the floor and
 * the light orbiting the goal.
 *
 * Kept together because they share a lifetime — both are rebuilt when a level is, and both have
 * to be disposed when the view goes away — and separating them means remembering twice.
 * @param scene The scene they live in
 * @param built The level they decorate
 * @param level The level number to print
 * @returns Per-frame update, level rebuild, and a disposer
 */
export const createBoardDecorations = (
  scene: THREE.Scene,
  built: BuiltLevel,
  level: number
): {
  update: (elapsedSeconds: number) => void
  rebuild: (next: BuiltLevel, nextLevel: number) => void
  dispose: () => void
} => {
  const posters = {
    current: createLevelPoster(scene, built.layout, built.board.holes, built.holeRadius)
  }
  posters.current.update(level)

  const beacon = { current: createGoalBeacon(scene, built.board.goal, built.holeRadius) }

  return {
    update: (elapsedSeconds: number): void => beacon.current.update(elapsedSeconds),
    rebuild: (next: BuiltLevel, nextLevel: number): void => {
      // The holes move with the level, so the poster is recut rather than redrawn.
      posters.current.dispose()
      posters.current = createLevelPoster(scene, next.layout, next.board.holes, next.holeRadius)
      posters.current.update(nextLevel)
      beacon.current.dispose()
      beacon.current = createGoalBeacon(scene, next.board.goal, next.holeRadius)
    },
    dispose: (): void => {
      posters.current.dispose()
      beacon.current.dispose()
    }
  }
}
