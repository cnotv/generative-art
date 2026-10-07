import * as THREE from 'three'
import { attachRockStroke } from '@/views/Games/RockRunner/elements/rockStroke'
import { rockSurfaceById } from '@/views/Games/RockRunner/elements/rockSurfaces'
import {
  ROCK_RENDER_ORDER,
  ROCK_STROKE_WIDTH,
  ROCK_STROKE_WOBBLE
} from '@/views/Games/RockRunner/config'
import { BALL, BOT_GHOST_OPACITY, BOT_SURFACE, MAX_RIVALS, PLAYER_SURFACE } from '../config'

const createBall = (
  scene: THREE.Scene,
  geometry: THREE.SphereGeometry,
  texture: THREE.Texture,
  name: string,
  opacity: number
): THREE.Mesh => {
  // Transparent so it sorts with its hand-drawn outline, the way Rock Runner's own rock does.
  // A see-through ball also writes no depth, so whatever is behind it still shows.
  const material = new THREE.MeshLambertMaterial({
    map: texture,
    transparent: true,
    opacity,
    depthWrite: opacity >= 1
  })
  const ball = new THREE.Mesh(geometry, material)
  ball.name = name
  ball.castShadow = true
  ball.renderOrder = ROCK_RENDER_ORDER
  // Yaw first, then the roll about the ball's own sideways axis.
  ball.rotation.order = 'YXZ'
  const outline = attachRockStroke(ball, ROCK_STROKE_WIDTH, ROCK_STROKE_WOBBLE)
  if (outline.material instanceof THREE.Material) outline.material.opacity = opacity
  scene.add(ball)
  return ball
}

/**
 * The balls of the race, dressed in Rock Runner's painted rock surfaces: the player's, and a
 * see-through ghost for each rival, so where a rival shares the player's lane the player's ball
 * still shows through it. Every ghost has its own material, to take its player's colour.
 */
export const createBalls = (
  scene: THREE.Scene
): { player: THREE.Mesh; ghosts: THREE.Mesh[]; dispose: () => void } => {
  const loader = new THREE.TextureLoader()
  const geometry = new THREE.SphereGeometry(BALL.radius, BALL.segments, BALL.segments / 2)
  const textures = [PLAYER_SURFACE, BOT_SURFACE].map((surfaceId) => {
    const texture = loader.load(rockSurfaceById(surfaceId).colorUrl)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
  })
  const player = createBall(scene, geometry, textures[0], 'player-ball', 1)
  const ghosts = Array.from({ length: MAX_RIVALS }, (_, index) =>
    createBall(scene, geometry, textures[1], `rival-ball-${index}`, BOT_GHOST_OPACITY)
  )
  ghosts.forEach((ghost) => {
    ghost.visible = false
  })
  const balls = [player, ...ghosts]
  const dispose = (): void => {
    balls.forEach((ball) => {
      scene.remove(ball)
      ball.traverse((part) => {
        if (!(part instanceof THREE.Mesh)) return
        if (part !== ball) part.geometry.dispose()
        if (part.material instanceof THREE.Material) part.material.dispose()
      })
    })
    geometry.dispose()
    textures.forEach((texture) => texture.dispose())
  }
  return { player, ghosts, dispose }
}
