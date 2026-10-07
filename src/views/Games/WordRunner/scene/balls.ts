import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import { getBall } from '@webgamekit/threejs'
import { attachRockStroke } from '@/views/Games/RockRunner/elements/rockStroke'
import { rockSurfaceById } from '@/views/Games/RockRunner/elements/rockSurfaces'
import {
  ROCK_RENDER_ORDER,
  ROCK_STROKE_WIDTH,
  ROCK_STROKE_WOBBLE
} from '@/views/Games/RockRunner/config'
import {
  BALL,
  BOT_GHOST_OPACITY,
  BOT_SURFACE,
  FREE_BALL,
  MAX_RIVALS,
  PLAYER_SURFACE
} from '../config'

/** A ball's rock surface. Transparent so it sorts with its hand-drawn outline, as in Rock Runner. */
const ballMaterial = (texture: THREE.Texture, opacity: number): THREE.MeshLambertMaterial =>
  new THREE.MeshLambertMaterial({
    map: texture,
    transparent: true,
    opacity,
    // A see-through ball writes no depth, so whatever is behind it still shows.
    depthWrite: opacity >= 1
  })

/** Dresses a ball mesh as a rock: its surface, its outline, and its place in the scene. */
const dressBall = (scene: THREE.Scene, ball: THREE.Mesh, name: string, opacity: number): void => {
  ball.name = name
  ball.castShadow = true
  ball.renderOrder = ROCK_RENDER_ORDER
  // Yaw first, then the roll about the ball's own sideways axis.
  ball.rotation.order = 'YXZ'
  const outline = attachRockStroke(ball, ROCK_STROKE_WIDTH, ROCK_STROKE_WOBBLE)
  if (outline.material instanceof THREE.Material) outline.material.opacity = opacity
  scene.add(ball)
}

const createBall = (
  scene: THREE.Scene,
  geometry: THREE.SphereGeometry,
  texture: THREE.Texture,
  name: string,
  opacity: number
): THREE.Mesh => {
  const ball = new THREE.Mesh(geometry, ballMaterial(texture, opacity))
  dressBall(scene, ball, name, opacity)
  return ball
}

/**
 * The player's ball as a real body in the physics world, rolling on the track's own colliders
 * with Rock Runner's rock handling. Dressed like every other ball once the package has built it.
 */
const createPhysicsBall = (
  scene: THREE.Scene,
  world: RAPIER.World,
  texture: THREE.Texture
): { ball: THREE.Mesh; body: RAPIER.RigidBody } => {
  const ball = getBall(scene, world, {
    name: 'player-ball',
    size: BALL.radius,
    position: [0, BALL.radius + FREE_BALL.spawnLift, 0],
    restitution: FREE_BALL.restitution,
    friction: FREE_BALL.friction,
    weight: FREE_BALL.gravityScale,
    mass: FREE_BALL.mass,
    segments: BALL.segments,
    type: 'dynamic'
  })
  const body: unknown = ball.userData.body
  if (!(body instanceof RAPIER.RigidBody)) throw new Error('The player ball has no physics body')
  // The package sets a density after the mass, and the density wins, so the mass the impulses
  // are tuned for is set on the collider afterwards.
  body.collider(0).setMass(FREE_BALL.mass)
  body.setLinearDamping(FREE_BALL.linearDamping)
  body.setAngularDamping(FREE_BALL.angularDamping)
  body.enableCcd(true)
  if (ball.material instanceof THREE.Material) ball.material.dispose()
  ball.material = ballMaterial(texture, 1)
  dressBall(scene, ball, 'player-ball', 1)
  return { ball, body }
}

/**
 * The balls of the race, dressed in Rock Runner's painted rock surfaces: the player's, and a
 * see-through ghost for each rival, so where a rival shares the player's lane the player's ball
 * still shows through it. Every ghost has its own material, to take its player's colour. Given
 * a physics world, the player's ball is a real body there, for free steering.
 */
export const createBalls = (
  scene: THREE.Scene,
  world: RAPIER.World | null
): {
  player: THREE.Mesh
  playerBody: RAPIER.RigidBody | null
  ghosts: THREE.Mesh[]
  dispose: () => void
} => {
  const loader = new THREE.TextureLoader()
  const geometry = new THREE.SphereGeometry(BALL.radius, BALL.segments, BALL.segments / 2)
  const textures = [PLAYER_SURFACE, BOT_SURFACE].map((surfaceId) => {
    const texture = loader.load(rockSurfaceById(surfaceId).colorUrl)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
  })
  const physical = world ? createPhysicsBall(scene, world, textures[0]) : null
  const player = physical?.ball ?? createBall(scene, geometry, textures[0], 'player-ball', 1)
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
        if (part !== ball || part.geometry !== geometry) part.geometry.dispose()
        if (part.material instanceof THREE.Material) part.material.dispose()
      })
    })
    if (physical && world) world.removeRigidBody(physical.body)
    geometry.dispose()
    textures.forEach((texture) => texture.dispose())
  }
  return { player, playerBody: physical?.body ?? null, ghosts, dispose }
}
