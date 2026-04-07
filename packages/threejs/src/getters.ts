import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import { times } from './utils/lodash'
import { CoordinateTuple, Model } from '@webgamekit/animation'
import { GeneratedInstanceConfig, InstanceConfig, LightsConfig, PhysicOptions } from './types'
import { SCENE_DEFAULTS } from './defaults'

/**
 * Initialize typical configuration for ThreeJS and Rapier for a given canvas.
 * @param canvas
 * @param options
 * @returns
 */
type EnvironmentOptions = {
  camera?: { position?: CoordinateTuple; distance?: number }
  scene?: { background?: number }
}

export const getEnvironment = async (
  canvas: HTMLCanvasElement,
  options: EnvironmentOptions = {
    camera: { position: SCENE_DEFAULTS.camera.position, distance: SCENE_DEFAULTS.camera.distance },
    scene: { background: SCENE_DEFAULTS.scene.background }
  }
) => {
  await RAPIER.init()
  const gravity = { x: 0.0, y: -9.81, z: 0.0 }
  const world = new RAPIER.World(gravity)
  const renderer = getRenderer(canvas)
  const scene = new THREE.Scene()
  const clock = new THREE.Clock()
  scene.background = new THREE.Color(options.scene?.background || SCENE_DEFAULTS.scene.background)

  const cameraConfig = options.camera ?? {
    position: SCENE_DEFAULTS.camera.position,
    distance: SCENE_DEFAULTS.camera.distance
  }
  const camera = new THREE.PerspectiveCamera(
    cameraConfig.distance,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  )
  camera.position.set(...(cameraConfig.position as CoordinateTuple))

  return { renderer, scene, camera, clock, world }
}

/**
 * Create and return ground with physic, helper and texture
 * @param scene
 * @param world
 * @param { size, position, helpers, color, texture }
 * @returns
 */
export const getGround = (
  scene: THREE.Scene,
  world: RAPIER.World,
  {
    size = SCENE_DEFAULTS.ground.size,
    position = SCENE_DEFAULTS.ground.position,
    helpers,
    color = SCENE_DEFAULTS.ground.color,
    texture,
    textureRepeat = SCENE_DEFAULTS.ground.textureRepeat,
    textureOffset = SCENE_DEFAULTS.ground.textureOffset
  }: {
    size?: CoordinateTuple | number
    position?: CoordinateTuple
    helpers?: boolean
    color?: number
    texture?: string
    textureRepeat?: [number, number]
    textureOffset?: [number, number]
  }
) => {
  const defaultProps = { color }
  const groundSizes: CoordinateTuple = Array.isArray(size) ? size : [size, 0.01, size]
  const groundCenterY = position[1] - (groundSizes[1] || 0.01) / 2
  const groundPosition: CoordinateTuple = [position[0], groundCenterY, position[2]]
  const geometry = new THREE.BoxGeometry(...groundSizes)
  const material = new THREE.MeshStandardMaterial({
    ...defaultProps,
    ...(texture ? { map: getTextures(texture, textureRepeat, textureOffset) } : {})
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = 'ground'
  mesh.receiveShadow = true
  mesh.position.set(...groundPosition)
  mesh.userData.physics = { mass: 0 }

  scene.add(mesh)

  const { rigidBody, collider } = getPhysic(world, {
    position: groundPosition,
    size: groundSizes,
    boundary: 0.5
  })

  const helper = new THREE.BoxHelper(mesh, 0x000000)
  if (helpers) {
    scene.add(helper)
  }

  return { mesh, rigidBody, helper, collider }
}

/**
 * Populate a given area with a given amount of instances
 * @param {InstanceConfig} config - Instance configuration object
 * @param {number} [config.amount] - Number of instances to create
 * @param {CoordinateTuple} [config.size] - Base size [x, y, z] of each instance
 * @param {CoordinateTuple} [config.sizeVariation] - Random size variation [x, y, z] to add to base size
 * @param {CoordinateTuple} [config.position] - Base position [x, y, z] of instances
 * @param {CoordinateTuple} [config.positionVariation] - Random position variation [x, y, z] range
 * @param {CoordinateTuple} [config.rotation] - Base rotation [x, y, z] in degrees
 * @param {CoordinateTuple} [config.rotationVariation] - Random rotation variation [x, y, z] range in degrees
 * @param {number} [config.area] - Area divisor for legacy positioning
 * @param {number} [config.ratio] - Width to height ratio multiplier (legacy)
 * @param {number} [config.spacing] - Spacing between instances along X axis (legacy)
 * @param {number} [config.opacity] - Opacity value (stored but not used in generation)
 * @param {CoordinateTuple} groundSize - Ground dimensions [width, height, depth]
 * @returns {GeneratedInstanceConfig} Array of instance configurations
 */
export const getInstanceConfig = ({
  size = [1, 1, 1],
  sizeVariation = [0, 0, 0],
  position = [0, 0, 0],
  positionVariation = [0, 0, 0],
  rotation = [0, 0, 0],
  rotationVariation = [0, 0, 0],
  amount = 1,
  ratio = 1,
  spacing = 0,
  textures
}: InstanceConfig): GeneratedInstanceConfig => {
  const generatedConfig = times(amount, (index) => {
    const newSize: CoordinateTuple = [
      size[0] + (Math.random() - 0.5) * sizeVariation[0],
      size[1] + (Math.random() - 0.5) * sizeVariation[1],
      size[2] + (Math.random() - 0.5) * sizeVariation[2]
    ]

    const baseX = index * spacing - (amount * spacing) / 2
    const xVariable = positionVariation[0] > 0 ? (Math.random() - 0.5) * positionVariation[0] : 0
    const newPosition: CoordinateTuple = [
      baseX + xVariable,
      position[1] + (Math.random() - 0.5) * positionVariation[1],
      position[2] + (Math.random() - 0.5) * positionVariation[2]
    ]

    // Calculate rotation with variation
    const newRotation: CoordinateTuple = [
      rotation[0] + (Math.random() - 0.5) * rotationVariation[0],
      rotation[1] + (Math.random() - 0.5) * rotationVariation[1],
      rotation[2] + (Math.random() - 0.5) * rotationVariation[2]
    ]

    const scale: CoordinateTuple =
      ratio !== 1 ? [newSize[0] * ratio, newSize[1], newSize[2]] : newSize

    return {
      position: newPosition,
      rotation: newRotation,
      scale,
      textures
    }
  })

  return generatedConfig
}

type DirectionalConfig = NonNullable<LightsConfig['directional']>
type ShadowConfig = NonNullable<DirectionalConfig['shadow']>

const applyDirectionalShadow = (light: THREE.DirectionalLight, shadow: ShadowConfig) => {
  const shadowCam = shadow.camera ?? {}
  const mapSize = shadow.mapSize
  light.shadow.mapSize.width = mapSize?.width ?? 4096
  light.shadow.mapSize.height = mapSize?.height ?? 4096
  light.shadow.camera.near = shadowCam.near ?? 0.5
  light.shadow.camera.far = shadowCam.far ?? 500
  light.shadow.camera.left = shadowCam.left ?? -150
  light.shadow.camera.right = shadowCam.right ?? 150
  light.shadow.camera.top = shadowCam.top ?? 150
  light.shadow.camera.bottom = shadowCam.bottom ?? -150
  if (shadow.bias !== undefined) light.shadow.bias = shadow.bias
  if (shadow.radius !== undefined) light.shadow.radius = shadow.radius
  light.shadow.camera.updateProjectionMatrix()
}

/**
 * Create and return default lights
 * @param scene
 * @returns
 */
export const getLights = (scene: THREE.Scene, config: LightsConfig = {}) => {
  const {
    ambient = SCENE_DEFAULTS.lights.ambient,
    directional = {
      ...SCENE_DEFAULTS.lights.directional,
      shadow: {
        mapSize: { width: 4096, height: 4096 },
        camera: { near: 0.5, far: 500, left: -150, right: 150, top: 150, bottom: -150 },
        bias: -0.0001,
        radius: 1
      }
    },
    hemisphere
  } = config

  if (hemisphere?.colors) {
    const hemisphereLight = new THREE.HemisphereLight(...hemisphere.colors)
    scene.add(hemisphereLight)
  }

  const ambientLight = new THREE.AmbientLight(ambient.color, ambient.intensity)
  ambientLight.name = 'ambient-light'
  scene.add(ambientLight)

  const directionalLight = new THREE.DirectionalLight(directional.color, directional.intensity)
  directionalLight.name = 'directional-light'
  if (directional.position)
    directionalLight.position.set(...(directional.position as CoordinateTuple))
  directionalLight.castShadow = directional.castShadow ?? true

  // Always apply shadow camera defaults so scenes that omit the shadow key
  // still get a large-enough frustum (Three.js default is only ~±5 units).
  applyDirectionalShadow(directionalLight, directional.shadow ?? {})
  scene.add(directionalLight)

  return { directionalLight, ambientLight }
}

export const getOffset = (
  model: Model,
  config: { offset: { x: number; y: number; z: number } }
) => {
  const { x, y, z } = config.offset
  const offset = new THREE.Vector3(x, y, z)
  offset.applyQuaternion(model.quaternion)
  offset.add(model.position)
  return offset
}

type RigidBodyDescOptions = {
  type: NonNullable<PhysicOptions['type']>
  position: NonNullable<PhysicOptions['position']>
  weight: number
  dominance: number
  damping: number
  angular: number
  enabledRotations: [boolean, boolean, boolean]
}

const buildRigidBodyDesc = ({
  type,
  position,
  weight,
  dominance,
  damping,
  angular,
  enabledRotations
}: RigidBodyDescOptions): RAPIER.RigidBodyDesc =>
  RAPIER.RigidBodyDesc[type]()
    .setTranslation(...position)
    .setGravityScale(weight)
    .setDominanceGroup(dominance)
    .setLinearDamping(damping)
    .setAngularDamping(angular)
    .enabledRotations(...enabledRotations)

const buildColliderShape = (
  shape: PhysicOptions['shape'],
  size: PhysicOptions['size'],
  boundary: number
): RAPIER.ColliderDesc => {
  const sizeValue = size ?? [1, 1, 1]
  if (shape === 'cuboid') {
    const halfExtents = Array.isArray(sizeValue)
      ? (sizeValue.map((x) => x * boundary) as CoordinateTuple)
      : ([sizeValue * boundary, sizeValue * boundary, sizeValue * boundary] as CoordinateTuple)
    return RAPIER.ColliderDesc.cuboid(...halfExtents)
  }
  return RAPIER.ColliderDesc.ball((Array.isArray(sizeValue) ? sizeValue[0] : sizeValue) as number)
}

const buildCharacterController = (world: RAPIER.World): RAPIER.KinematicCharacterController => {
  const controller = world.createCharacterController(0.01)
  controller.setUp({ x: 0, y: 1, z: 0 })
  controller.enableSnapToGround(0)
  controller.setMaxSlopeClimbAngle(45)
  controller.setMinSlopeSlideAngle(30)
  return controller
}

const applyRotationToRigidBody = (
  rigidBody: RAPIER.RigidBody,
  rotation: PhysicOptions['rotation']
) => {
  if (rotation && rotation instanceof Array) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation))
    rigidBody.setRotation(q, true)
  }
}

type ColliderOptions = {
  shape: PhysicOptions['shape']
  size: PhysicOptions['size']
  boundary: number
  restitution: number
  friction: number
  mass: number
  density: number
}

const buildCollider = (
  world: RAPIER.World,
  rigidBody: RAPIER.RigidBody,
  options: ColliderOptions
): RAPIER.Collider => {
  const { shape, size, boundary, restitution, friction, mass, density } = options
  const colliderDesc = buildColliderShape(shape, size, boundary)
    .setRestitution(restitution)
    .setFriction(friction)
    .setMass(mass)
    .setDensity(density)
  return world.createCollider(colliderDesc, rigidBody)
}

/**
 * Add physic to the model for a given world, using default values
 * @param world
 * @param position
 * @param size
 * @param {Object} options - The options for the physics body and collider.
 * @param {number} [options.boundary=0] - The boundary size of the collider.
 * @param {number} [options.restitution=0] - The restitution (bounciness) of the collider.
 * @param {number} [options.friction=0] - The friction of the collider against other objects.
 * @param {Rotation} [options.rotation] - The initial rotation of the object.
 * @param {number} [options.weight=1] - The gravity scale applied to the object to simulate the weight.
 * @param {number} [options.mass=1] - The mass in the sense of resistance from movement.
 * @param {number} [options.density=1] - The density of the object.
 * @param {number} [options.dominance=1] - The influence level from other bodies.
 * @param {'fixed' | 'dynamic'} [options.type='fixed'] - The type of the rigid body.
 * @param {'cuboid' | 'ball'} [options.shape='cuboid'] - The shape of the collider.
 * @returns {Object} The created rigid body and collider.
 * @returns
 */

type ResolvedPhysicOptions = Required<
  Pick<
    PhysicOptions,
    | 'rotation'
    | 'position'
    | 'size'
    | 'boundary'
    | 'restitution'
    | 'friction'
    | 'damping'
    | 'angular'
    | 'mass'
    | 'density'
    | 'weight'
    | 'dominance'
    | 'shape'
    | 'type'
    | 'enabledRotations'
  >
>

const resolvePhysicBodyOptions = (options: PhysicOptions) => ({
  rotation: options.rotation ?? ([0, 0, 0] as NonNullable<PhysicOptions['rotation']>),
  position: options.position ?? ([0, 0, 0] as NonNullable<PhysicOptions['position']>),
  weight: options.weight ?? 1,
  dominance: options.dominance ?? 0,
  damping: options.damping ?? 0,
  angular: options.angular ?? 1,
  enabledRotations: options.enabledRotations ?? ([true, true, true] as [boolean, boolean, boolean]),
  type: options.type ?? ('fixed' as NonNullable<PhysicOptions['type']>)
})

const resolvePhysicColliderOptions = (options: PhysicOptions) => ({
  size: options.size ?? ([1, 1, 1] as NonNullable<PhysicOptions['size']>),
  boundary: options.boundary ?? 0.5,
  restitution: options.restitution ?? 1,
  friction: options.friction ?? 0,
  mass: options.mass ?? 1,
  density: options.density ?? 1,
  shape: options.shape ?? ('cuboid' as NonNullable<PhysicOptions['shape']>)
})

const resolvePhysicOptions = (options: PhysicOptions): ResolvedPhysicOptions => ({
  ...resolvePhysicBodyOptions(options),
  ...resolvePhysicColliderOptions(options)
})

export const getPhysic = (world: RAPIER.World, options: PhysicOptions) => {
  const {
    rotation,
    position,
    size,
    boundary,
    restitution,
    friction,
    damping,
    angular,
    mass,
    density,
    weight,
    dominance,
    shape,
    type,
    enabledRotations
  } = resolvePhysicOptions(options)
  const rigidBodyDesc = buildRigidBodyDesc({
    type,
    position,
    weight,
    dominance,
    damping,
    angular,
    enabledRotations: enabledRotations as [boolean, boolean, boolean]
  })
  const rigidBody = world.createRigidBody(rigidBodyDesc)
  applyRotationToRigidBody(rigidBody, rotation)
  const collider = buildCollider(world, rigidBody, {
    shape,
    size,
    boundary,
    restitution,
    friction,
    mass,
    density
  })
  const characterController =
    type === 'kinematicPositionBased' ? buildCharacterController(world) : undefined

  return { rigidBody, collider, characterController }
}

export const getRenderer = (canvas: HTMLCanvasElement): THREE.WebGLRenderer => {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setClearColor(0xaaaaff)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  return renderer
}

export const getSky = (
  scene: THREE.Scene,
  {
    color = SCENE_DEFAULTS.sky.color,
    size = SCENE_DEFAULTS.sky.size,
    texture
  }: {
    color?: number
    texture?: string
    size?: number
  }
) => {
  const skyGeometry = new THREE.SphereGeometry(size, 32, 32)
  const loader = new THREE.TextureLoader()
  const skyMaterial = new THREE.MeshBasicMaterial({
    side: THREE.BackSide,
    color,
    ...(texture
      ? { map: loader.load(new URL(texture!, import.meta.url) as unknown as string) }
      : {})
  })
  const model = new THREE.Mesh(skyGeometry, skyMaterial)
  model.name = 'sky'
  scene.add(model)
  return { model }
}

/**
 * Get default textures
 * @param img
 * @param repeat
 * @returns
 */
export const getTextures = (
  img: string,
  repeat: [number, number] = [1, 1],
  offset: [number, number] = [0, 0]
) => {
  const textureLoader = new THREE.TextureLoader()
  const texture = textureLoader.load(img)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.offset.set(offset[0], offset[1])
  texture.repeat.set(repeat[0], repeat[1])
  return texture
}
