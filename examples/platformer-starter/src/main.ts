import { getTools, getCube, cameraFollowPlayer, type ComplexModel } from '@webgamekit/threejs'
import { createTimelineManager, type CoordinateTuple } from '@webgamekit/animation'
import { createControls } from '@webgamekit/controls'
import {
  PLATFORMS,
  PLAYER,
  SCENE,
  CONTROLS,
  MOVE_SPEED,
  JUMP_SPEED,
  GROUNDED_SPEED
} from './config'

const canvas = document.querySelector<HTMLCanvasElement>('#scene')
if (!canvas) throw new Error('No #scene canvas in the page')

const { setup, animate, scene, camera, world } = await getTools({ canvas })

await setup({ config: SCENE })

// Built after setup rather than inside defineSetup, so everything can stay a const.
const player = getCube(scene, world, PLAYER) as ComplexModel
PLATFORMS.forEach((platform) => getCube(scene, world, platform))

const { currentActions } = createControls(CONTROLS)

/** Which way the pressed keys point, on the ground plane. */
const movementDirection = (): { x: number; z: number } => ({
  x: (currentActions['move-right'] ? 1 : 0) - (currentActions['move-left'] ? 1 : 0),
  z: (currentActions['move-back'] ? 1 : 0) - (currentActions['move-forward'] ? 1 : 0)
})

const timeline = createTimelineManager()

timeline.addAction({
  name: 'move the player',
  category: 'user-input',
  action: () => {
    const body = player.userData.body
    if (!body) return

    const direction = movementDirection()
    const velocity = body.linvel()

    // Grounded enough to jump again: only when barely moving vertically, which is the
    // cheapest usable test before you have real ground detection.
    const isGrounded = Math.abs(velocity.y) < GROUNDED_SPEED
    const verticalSpeed = currentActions.jump && isGrounded ? JUMP_SPEED : velocity.y

    body.setLinvel(
      { x: direction.x * MOVE_SPEED, y: verticalSpeed, z: direction.z * MOVE_SPEED },
      true
    )
  }
})

timeline.addAction({
  name: 'follow the player',
  category: 'visual',
  action: () => {
    cameraFollowPlayer(camera, player, SCENE.camera?.position as CoordinateTuple, null, ['x', 'z'])
  }
})

animate({ timeline })
