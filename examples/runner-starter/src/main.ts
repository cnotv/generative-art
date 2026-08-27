import { getTools, getCube, type ComplexModel } from '@webgamekit/threejs'
import { createTimelineManager } from '@webgamekit/animation'
import { createControls } from '@webgamekit/controls'
import {
  SCENE,
  PLAYER,
  OBSTACLE,
  CONTROLS,
  LANE_X,
  LANE_CHANGE_SPEED,
  TRACK_SPEED,
  SPAWN_EVERY_FRAMES,
  SPAWN_Z,
  DESPAWN_Z,
  HIT_RADIUS,
  OBSTACLE_HEIGHT
} from './config'

const canvas = document.querySelector<HTMLCanvasElement>('#scene')
const scoreLabel = document.querySelector<HTMLElement>('#score')
if (!canvas || !scoreLabel) throw new Error('The page is missing #scene or #score')

const { setup, animate, scene, world, getDelta } = await getTools({ canvas })

await setup({ config: SCENE })

const player = getCube(scene, world, PLAYER) as ComplexModel

// State the game changes lives in small holders rather than free variables, which keeps every
// binding a const and every write easy to find.
const obstacles: { value: ComplexModel[] } = { value: [] }
const lane = { value: 1 }
const score = { value: 0 }
const alive = { value: true }

createControls({
  ...CONTROLS,
  onAction: (action: string) => {
    if (action === 'lane-left') lane.value = Math.max(0, lane.value - 1)
    if (action === 'lane-right') lane.value = Math.min(LANE_X.length - 1, lane.value + 1)
  }
})

/** Write the HUD text. replaceChildren rather than textContent keeps the write a call. */
const showStatus = (text: string): void => scoreLabel.replaceChildren(text)

/** Remove an obstacle from the scene and the physics world together, so neither leaks. */
const removeObstacle = (obstacle: ComplexModel): void => {
  scene.remove(obstacle)
  const body = obstacle.userData.body
  if (body) world.removeRigidBody(body)
}

const timeline = createTimelineManager()

timeline.addAction({
  name: 'slide the player between lanes',
  category: 'user-input',
  action: () => {
    const distance = LANE_X[lane.value] - player.position.x
    const step = LANE_CHANGE_SPEED * getDelta()
    player.position.x += Math.abs(distance) < step ? distance : Math.sign(distance) * step
  }
})

timeline.addAction({
  name: 'spawn obstacles',
  frequency: SPAWN_EVERY_FRAMES,
  category: 'game-logic',
  action: () => {
    if (!alive.value) return
    const spawnLane = LANE_X[Math.floor(Math.random() * LANE_X.length)]
    const obstacle = getCube(scene, world, {
      ...OBSTACLE,
      position: [spawnLane, OBSTACLE_HEIGHT, SPAWN_Z]
    }) as ComplexModel
    obstacles.value = [...obstacles.value, obstacle]
  }
})

timeline.addAction({
  name: 'run the track',
  category: 'game-logic',
  action: () => {
    if (!alive.value) return

    const step = TRACK_SPEED * getDelta()
    obstacles.value.forEach((obstacle) => {
      obstacle.position.z += step
    })

    const passed = obstacles.value.filter((obstacle) => obstacle.position.z > DESPAWN_Z)
    passed.forEach(removeObstacle)

    if (passed.length > 0) {
      obstacles.value = obstacles.value.filter((obstacle) => !passed.includes(obstacle))
      score.value += passed.length
      showStatus(`Score ${score.value}`)
    }

    const hit = obstacles.value.some(
      (obstacle) =>
        Math.abs(obstacle.position.z - player.position.z) < HIT_RADIUS &&
        Math.abs(obstacle.position.x - player.position.x) < HIT_RADIUS
    )

    if (hit) {
      alive.value = false
      showStatus(`Hit at ${score.value}. Reload to try again.`)
    }
  }
})

animate({ timeline })
