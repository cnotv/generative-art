<script setup lang="ts">
import * as THREE from 'three'
import { textureLoader, disposeScene, getLights } from '@webgamekit/threejs'
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useDebugSceneStore } from '@/stores/debugScene'
import { video } from '@/utils/video'
import { controls } from '@/utils/control'
import { stats } from '@/utils/stats'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import RAPIER from '@dimforge/rapier3d-compat'
import type { CoordinateTuple } from '@/types/three'

type ProjectConfig = any

interface BallPhysics {
  weight: number
  friction: number
  restitution: number
}

const statsElement = ref(null)
const canvas = ref(null)
const route = useRoute()
const { registerSceneElements, clearSceneElements } = useDebugSceneStore()
const models = [] as {
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshPhysicalMaterial, THREE.Object3DEventMap>
  rigidBody: RAPIER.RigidBody
}[]
const BOWL_RADIUS = 13
const BOWL_THICKNESS = 1
const BOWL_SEGMENTS = 48
const BOWL_POSITION = [0, 0, 0] as CoordinateTuple
/** Tipped towards the camera, so the balls inside are in view without moving the camera. */
const BOWL_TILT = -Math.PI / 8

/** How far a drag turns the bowl, per pixel moved. */
const BOWL_DRAG_SENSITIVITY = 0.008

/** How far a shift drag slides the bowl, per pixel moved. */
const BOWL_MOVE_SENSITIVITY = 0.05

/** How far the bowl can be slid from where it started, so it cannot be lost off screen. */
const BOWL_MOVE_LIMIT = BOWL_RADIUS * 2

/** How much of the remaining distance the bowl covers each frame while chasing the pointer. */
const BOWL_MOVE_SMOOTHING = 0.15

/** How far the bowl can be tipped before its contents would simply pour out. */
const BOWL_MAX_TILT = Math.PI / 3

/** Movement, in pixels, past which a press counts as turning the bowl rather than a tap. */
const DRAG_THRESHOLD = 6

/** How many balls the bowl holds before the oldest is recycled, to bound what it costs. */
const MAX_BALLS = 60

/** Below this a ball has gone over the rim and is falling for ever, so it is cleared away. */
const FALL_OUT_DEPTH = -BOWL_RADIUS * 4

/** How wide a drop is scattered: wider than a ball, so two never land joined. */
const SPAWN_SPREAD = 3

const sphereSize = () => Math.random() * 0.5 + 0.5

const modelPosition = [0.0, 15.0, 0.0] as CoordinateTuple
const gravity = { x: 0.0, y: -9.81, z: 0.0 }
let bowlYaw = 0
let bowlPitch = 0
const bowlEuler = new THREE.Euler()
const bowlRotation = new THREE.Quaternion()
const bowlPosition = new THREE.Vector3()
const bowlTarget = new THREE.Vector3()
// Pre-allocated: a drag reads the camera's own axes so the bowl goes where the screen says.
const dragRight = new THREE.Vector3()
const dragUp = new THREE.Vector3()
const dragForward = new THREE.Vector3()
let world
let animationFrameId = 0

onMounted(() => {
  ;(init(
    canvas.value as unknown as HTMLCanvasElement,
    statsElement.value as unknown as HTMLElement
  ),
    statsElement.value!)
})

let activeRenderer: THREE.WebGLRenderer | null = null

onUnmounted(() => {
  if (animationFrameId) cancelAnimationFrame(animationFrameId)
  clearSceneElements()
  if (activeRenderer) disposeScene(activeRenderer)
})

const init = (canvas: HTMLCanvasElement, statsElement: HTMLElement) => {
  const config = {
    directional: {
      enabled: true,
      helper: false,
      intensity: 10
    },
    area: {
      enabled: true,
      helper: false,
      intensity: 1,
      width: 10,
      height: 10
    },
    ambient: {
      enabled: true,
      intensity: 0.2
    },
    hemisphere: {
      enabled: true,
      helper: false,
      intensity: 1
    },
    point: {
      enabled: true,
      helper: false,
      intensity: 1
    },
    spot: {
      enabled: true,
      helper: false,
      intensity: 1
    },
    ball: {
      weight: 3,
      friction: 1.5,
      restitution: 0.333
    }
    // size: 50,
  }
  stats.init(route, statsElement)
  controls.create(
    config,
    route,
    {
      directional: {
        enabled: {},
        intensity: {},
        helper: {}
      },
      area: {
        enabled: {},
        intensity: {},
        width: {},
        height: {},
        helper: {}
      },
      ambient: {
        enabled: {},
        intensity: {}
      },
      hemisphere: {
        enabled: {},
        helper: {},
        intensity: {}
      },
      point: {
        enabled: {},
        helper: {},
        intensity: {}
      },
      spot: {
        enabled: {},
        helper: {},
        intensity: {}
      },
      ball: {
        weight: {},
        friction: {},
        restitution: {}
      }
    },
    () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId)
      setup()
    }
  )

  const setup = async () => {
    // The wasm has to be up before a world can be built, or every Rapier call reads off undefined.
    await RAPIER.init()
    world = new RAPIER.World(gravity)
    const renderer = getRenderer(canvas)
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    )
    const scene = new THREE.Scene()
    const orbit = new OrbitControls(camera, renderer.domElement)

    camera.position.z = -20
    camera.position.y = 10
    orbit.target.set(...BOWL_POSITION)
    orbit.enabled = false

    createLights(scene, config)
    bowlPosition.set(...BOWL_POSITION)
    bowlTarget.set(...BOWL_POSITION)
    const { bowl, body: bowlBody } = getBowl(scene, world)
    models.push(getModel(sphereSize(), modelPosition, scene, orbit, world, config.ball))

    registerSceneElements(camera, scene.children)

    // Dragging turns the bowl and a tap drops a ball, told apart by how far the pointer
    // moved. On the canvas rather than the document, so both end when the view does.
    let dragging = false
    let dragOrigin = { x: 0, y: 0 }
    let dragged = 0

    canvas.addEventListener('pointerdown', (event) => {
      dragging = true
      dragged = 0
      dragOrigin = { x: event.clientX, y: event.clientY }
      canvas.setPointerCapture(event.pointerId)
    })

    canvas.addEventListener('pointermove', (event) => {
      if (!dragging) return
      const deltaX = event.clientX - dragOrigin.x
      const deltaY = event.clientY - dragOrigin.y
      dragOrigin = { x: event.clientX, y: event.clientY }
      dragged += Math.abs(deltaX) + Math.abs(deltaY)

      if (event.shiftKey) {
        // Slid along the camera's own right and up, so the bowl follows the pointer whatever
        // angle the scene is viewed from. Screen y counts downwards, hence the sign.
        camera.matrixWorld.extractBasis(dragRight, dragUp, dragForward)
        bowlTarget
          .addScaledVector(dragRight, deltaX * BOWL_MOVE_SENSITIVITY)
          .addScaledVector(dragUp, -deltaY * BOWL_MOVE_SENSITIVITY)
        bowlTarget.clampScalar(-BOWL_MOVE_LIMIT, BOWL_MOVE_LIMIT)
        return
      }

      bowlYaw += deltaX * BOWL_DRAG_SENSITIVITY
      bowlPitch = Math.max(
        -BOWL_MAX_TILT,
        Math.min(BOWL_MAX_TILT, bowlPitch + deltaY * BOWL_DRAG_SENSITIVITY)
      )
    })

    canvas.addEventListener('pointerup', (event) => {
      dragging = false
      if (dragged > DRAG_THRESHOLD) return
      const { mesh, rigidBody } = getModel(
        sphereSize(),
        modelPosition,
        scene,
        orbit,
        world,
        config.ball
      )
      setModelPosition(event, mesh, rigidBody)
      models.push({ mesh, rigidBody })
      // The oldest ball goes when the pile reaches its limit, so dropping more never stops.
      if (models.length > MAX_BALLS) {
        const oldest = models.shift()
        if (oldest) releaseBall(scene, world, oldest)
      }
    })

    video.record(canvas, route)

    function animate() {
      stats.start(route)
      animationFrameId = requestAnimationFrame(animate)

      // The bowl is moved as a body rather than posed as a mesh, so the solver knows where it
      // is going and carries whatever is resting against it. Allocated once above the loop.
      bowlEuler.set(BOWL_TILT + bowlPitch, bowlYaw, 0)
      bowlRotation.setFromEuler(bowlEuler)
      bowlBody.setNextKinematicRotation(bowlRotation)
      // Chased rather than jumped to: a bowl that teleports to the pointer lands on the balls
      // and carries them along as one lump, where one that travels there lets them slide and
      // slosh against the wall the way loose balls do.
      bowlPosition.lerp(bowlTarget, BOWL_MOVE_SMOOTHING)
      bowlBody.setNextKinematicTranslation(bowlPosition)
      bowl.quaternion.copy(bowlRotation)
      bowl.position.copy(bowlPosition)

      world.step()

      models.forEach(({ mesh, rigidBody }) => {
        const position = rigidBody.translation()
        mesh.position.set(position.x, position.y, position.z)
        const rotation = rigidBody.rotation()
        mesh.rotation.set(rotation.x, rotation.y, rotation.z)
      })

      // Nothing catches a ball that leaves the bowl, so one that is still falling well below
      // it never comes back and would hold its place in the pile for ever.
      const escaped = models.findIndex(({ mesh }) => mesh.position.y < FALL_OUT_DEPTH)
      if (escaped >= 0) {
        const [lost] = models.splice(escaped, 1)
        releaseBall(scene, world, lost)
      }

      orbit.update()

      renderer.render(scene, camera)
      video.stop(renderer.info.render.frame, route)
      stats.end(route)
    }
    animate()
  }
  setup()
}

const getRenderer = (canvas: HTMLCanvasElement) => {
  const renderer = new THREE.WebGLRenderer({ canvas: canvas })
  activeRenderer = renderer
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setClearColor(0x777777) // Set background color to black
  renderer.shadowMap.enabled = true // Enable shadow maps
  renderer.shadowMap.type = THREE.PCFSoftShadowMap // Use soft shadows
  return renderer
}

/**
 * The hemisphere tint the view has always used, kept as the HSL it was written in.
 */
const HEMISPHERE_SKY_COLOR = new THREE.Color().setHSL(0.6, 1, 0.6).getHex()
const HEMISPHERE_GROUND_COLOR = new THREE.Color().setHSL(0.095, 1, 0.75).getHex()

const createLights = (scene: THREE.Scene, config: ProjectConfig) =>
  getLights(scene, {
    ambient: config.ambient.enabled && { color: 0xffffff, intensity: config.ambient.intensity },
    directional: config.directional.enabled && {
      color: 0xffffff,
      intensity: config.directional.intensity,
      position: [5, 10, 5],
      castShadow: true,
      helper: config.directional.helper,
      shadow: {
        mapSize: { width: 2048, height: 2048 },
        camera: { near: 0.5, far: 500, left: -30, right: 30, top: 30, bottom: -30 },
        bias: -0.0001
      }
    },
    ...(config.hemisphere.enabled
      ? {
          hemisphere: {
            colors: [HEMISPHERE_SKY_COLOR, HEMISPHERE_GROUND_COLOR] as [number, number],
            intensity: config.hemisphere.intensity,
            position: [0, 50, 0] as CoordinateTuple,
            helper: config.hemisphere.helper
          }
        }
      : {}),
    ...(config.point.enabled
      ? {
          point: {
            intensity: config.point.intensity,
            position: [5, 5, 5] as CoordinateTuple,
            helper: config.point.helper
          }
        }
      : {}),
    ...(config.spot.enabled
      ? {
          spot: {
            intensity: config.spot.intensity,
            position: [5, 5, 5] as CoordinateTuple,
            helper: config.spot.helper
          }
        }
      : {}),
    ...(config.area.enabled
      ? {
          rectArea: {
            intensity: config.area.intensity,
            width: config.area.width,
            height: config.area.height,
            position: [5, 5, 5] as CoordinateTuple,
            lookAt: [0, 0, 0] as CoordinateTuple,
            helper: config.area.helper
          }
        }
      : {})
  })

/**
 * Reassign ball position on click
 * @param click
 * @param model
 * @param rigidBody
 */
const setModelPosition = (
  click: MouseEvent,
  model: THREE.Mesh<THREE.SphereGeometry, THREE.MeshPhysicalMaterial, THREE.Object3DEventMap>,
  rigidBody: RAPIER.RigidBody
) => {
  const x = -(click.clientX - window.innerWidth / 2) / 50
  const y = -(click.clientY - window.innerHeight) / 50
  // Dropped around the point clicked rather than exactly on it. Clicking twice in a place
  // put one ball inside another, and freeing two overlapping balls takes a shove that grows
  // with the overlap: enough of it and the solver panics, which poisons the world and stops
  // the scene for good.
  const spread = () => (Math.random() - 0.5) * SPAWN_SPREAD
  // Kept over the bowl: there is no floor any more, so a ball dropped wide of it falls for
  // ever and the click is spent on nothing.
  const reach = BOWL_RADIUS - SPAWN_SPREAD
  const over = (along: number, centre: number) =>
    Math.max(centre - reach, Math.min(centre + reach, along))
  const spawn = {
    x: over(x + spread(), bowlPosition.x),
    y: y + bowlPosition.y,
    z: over(bowlPosition.z + spread(), bowlPosition.z)
  }

  model.position.set(spawn.x, spawn.y, spawn.z)
  rigidBody.setTranslation(spawn, true)
}

/**
 * Get default textures
 * @param img
 * @returns
 */
const getTextures = (img: string) => {
  const texture = textureLoader.load(img)

  // Adjust the texture offset and repeat
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.offset.set(1, 1) // Offset the texture by 50%
  texture.repeat.set(1, 1) // Repeat the texture 0.5 times in both directions

  return texture
}

/**
 * Take a ball out of the scene and the simulation, and free what it held.
 * @param scene
 * @param world
 * @param ball - The mesh and body to release
 */
const releaseBall = (
  scene: THREE.Scene,
  world: RAPIER.World,
  ball: {
    mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshPhysicalMaterial>
    rigidBody: RAPIER.RigidBody
  }
) => {
  scene.remove(ball.mesh)
  ball.mesh.geometry.dispose()
  ball.mesh.material.dispose()
  world.removeRigidBody(ball.rigidBody)
}

/**
 * Create the bowl the balls fall into, with physics and shadow.
 *
 * A bowl is a hollow shape, so its collider cannot be one of the solid primitives: any of
 * them would fill the hollow and leave the balls resting on a lid. The collider is the mesh
 * itself, triangle for triangle, which is the only shape that is concave where the bowl is.
 * @param scene
 * @param world
 * @returns The bowl mesh and its collider
 */
const getBowl = (scene: THREE.Scene, world: RAPIER.World) => {
  // Turned from a profile rather than cut from a sphere, so the bowl has a wall with two
  // sides and a rim, instead of the infinitely thin skin a half sphere gives.
  const profile = Array.from({ length: BOWL_SEGMENTS + 1 }, (_, step) => {
    const angle = (step / BOWL_SEGMENTS) * (Math.PI / 2)
    return new THREE.Vector2(BOWL_RADIUS * Math.sin(angle), -BOWL_RADIUS * Math.cos(angle))
  })
  const outerWall = profile
    .map(
      (point) =>
        new THREE.Vector2(
          point.x * ((BOWL_RADIUS + BOWL_THICKNESS) / BOWL_RADIUS),
          point.y * ((BOWL_RADIUS + BOWL_THICKNESS) / BOWL_RADIUS)
        )
    )
    .reverse()
  // Outer wall first and each arc reversed, so the triangles wind outwards. Winding is not
  // cosmetic here: the solver reads neighbouring normals below, and an inside-out mesh points
  // every one of them into the wall.
  const geometry = new THREE.LatheGeometry(
    [...[...outerWall].reverse(), ...[...profile].reverse()],
    BOWL_SEGMENTS
  )

  const material = new THREE.MeshPhysicalMaterial({
    color: 0x222222,
    reflectivity: 0.3,
    roughness: 0.3,
    side: THREE.DoubleSide
  })
  const bowl = new THREE.Mesh(geometry, material)
  bowl.name = 'bowl'
  bowl.position.set(...BOWL_POSITION)
  bowl.rotation.x = BOWL_TILT
  bowl.receiveShadow = true
  scene.add(bowl)

  // The collider is the mesh itself, triangle for triangle: a bowl is hollow, and every
  // solid primitive would fill the hollow and leave the balls resting on a lid.
  const vertices = geometry.attributes['position'].array as Float32Array
  const indices = new Uint32Array(geometry.index!.array)
  // Kinematic rather than fixed: a bowl that turns has to be a body the solver moves, or it
  // would sweep through the balls without ever pushing them.
  const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(BOWL_TILT, 0, 0))
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(...BOWL_POSITION)
      .setRotation(rotation)
  )
  // A mesh collider is a bag of separate triangles, and a ball crossing the seam between two
  // of them meets the next edge on and stops dead. FIX_INTERNAL_EDGES has the solver take the
  // neighbouring triangle's normal into account, so the wall acts as the smooth curve it looks.
  const collider = world.createCollider(
    RAPIER.ColliderDesc.trimesh(vertices, indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES),
    body
  )

  return { bowl, body, collider }
}

/**
 * Create a ball with physics, texture, and shadow
 * Friction and bounciness is size based
 * @param size
 * @param position
 * @param scene
 * @param orbit
 * @param world
 * @param physics How heavy the ball is, and how much it grips and bounces
 */
const getModel = (
  size: number,
  position: CoordinateTuple,
  scene: THREE.Scene,
  orbit: OrbitControls,
  world: RAPIER.World,
  { weight, friction, restitution }: BallPhysics
) => {
  // Create and add model
  const geometry = new THREE.SphereGeometry(size)
  const material = new THREE.MeshPhysicalMaterial({
    color: 0x222222,
    // envMap: reflection,
    reflectivity: 0.2,
    roughness: 0.3,
    metalness: 0.5,
    transmission: 1
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = 'ball'
  mesh.position.set(...position)
  mesh.rotation.set(0.5, 0.5, 0.5)
  mesh.castShadow = true
  mesh.receiveShadow = false //default
  scene.add(mesh)

  // Create a dynamic rigid-body. Weight is the gravity scale, as getPhysic reads it.
  // Create a dynamic rigid-body. Weight is the gravity scale, as getPhysic reads it.
  const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(...position)
    .setGravityScale(weight)
  const rigidBody = world.createRigidBody(rigidBodyDesc)
  rigidBody.setRotation({ w: 1.0, x: 0.5, y: 0.5, z: 0.5 }, true)

  // Create a cuboid collider attached to the dynamic rigidBody.
  // Kept size based, so a pile is never uniform: the small ones bounce livelier and the big
  // ones grip harder, which is what makes a stack of them lean and give way rather than set.
  const colliderDesc = RAPIER.ColliderDesc.ball(size)
    .setRestitution(restitution / size)
    .setFriction(friction * size)
  const collider = world.createCollider(colliderDesc, rigidBody)

  return { mesh, rigidBody, collider }
}
</script>

<template>
  <div ref="statsElement"></div>
  <canvas ref="canvas"></canvas>
</template>
