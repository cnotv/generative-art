import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js'
import RAPIER from '@dimforge/rapier3d-compat'
import { getAnimationsModel, CoordinateTuple } from '@webgamekit/animation'
import { ModelOptions, ComplexModel, Model, ModelType } from './types'
import { getPhysic } from './getters'
import { applyOriginTranslation } from './core'

type BaseMaterialProperties = {
  opacity: number
  transparent: boolean
  depthWrite: boolean
  alphaTest: number
  wireframe: boolean
  color: number | THREE.Color
  map?: THREE.Texture
}

type MaterialWithColor = THREE.Material & {
  isMeshStandardMaterial?: boolean
  isMeshPhongMaterial?: boolean
  color: THREE.Color
}

const buildBaseMaterialProperties = (
  options: ModelOptions,
  oldMaterial: THREE.Material & { color?: THREE.Color; map?: THREE.Texture }
): BaseMaterialProperties => {
  const isTransparent = options.transparent ?? (options.opacity ?? 1) < 1
  const meshColor = options.color ?? oldMaterial?.color ?? 0xffffff
  return {
    opacity: options.opacity ?? 1,
    transparent: isTransparent,
    depthWrite: options.depthWrite ?? !isTransparent,
    alphaTest: options.alphaTest ?? 0,
    wireframe: options.wireframe ?? false,
    color: meshColor,
    ...(oldMaterial?.map ? { map: oldMaterial.map } : {})
  }
}

const buildPhysicalMaterial = (
  base: BaseMaterialProperties,
  options: ModelOptions
): THREE.MeshPhysicalMaterial => {
  const props: THREE.MeshPhysicalMaterialParameters = { ...base }
  if (options.reflectivity !== undefined) props.reflectivity = options.reflectivity
  if (options.roughness !== undefined) props.roughness = options.roughness
  if (options.transmission !== undefined) props.transmission = options.transmission
  if (options.metalness !== undefined) props.metalness = options.metalness
  if (options.clearcoat !== undefined) props.clearcoat = options.clearcoat
  if (options.clearcoatRoughness !== undefined)
    props.clearcoatRoughness = options.clearcoatRoughness
  if (options.ior !== undefined) props.ior = options.ior
  if (options.thickness !== undefined) props.thickness = options.thickness
  if (options.envMapIntensity !== undefined) props.envMapIntensity = options.envMapIntensity
  return new THREE.MeshPhysicalMaterial(props)
}

const buildStandardMaterial = (
  base: BaseMaterialProperties,
  options: ModelOptions
): THREE.MeshStandardMaterial => {
  const props: THREE.MeshStandardMaterialParameters = { ...base }
  if (options.roughness !== undefined) props.roughness = options.roughness
  if (options.metalness !== undefined) props.metalness = options.metalness
  return new THREE.MeshStandardMaterial(props)
}

const createMeshMaterial = (
  materialType: ModelOptions['material'],
  base: BaseMaterialProperties,
  options: ModelOptions
): THREE.Material | null => {
  if (materialType === 'MeshPhysicalMaterial') return buildPhysicalMaterial(base, options)
  if (materialType === 'MeshStandardMaterial') return buildStandardMaterial(base, options)
  if (materialType === 'MeshLambertMaterial')
    return new THREE.MeshLambertMaterial({ ...base, flatShading: false })
  if (materialType === 'MeshPhongMaterial')
    return new THREE.MeshPhongMaterial({ ...base, shininess: 30 })
  if (materialType === 'MeshBasicMaterial') return new THREE.MeshBasicMaterial({ ...base })
  return null
}

/**
 * Apply material to a mesh based on model options
 * @param mesh The mesh to apply material to
 * @param options Model options including material type
 * @returns The mesh with material applied
 */
export const applyMaterial = (mesh: THREE.Mesh, options: ModelOptions) => {
  const { material } = options
  if (material) {
    const oldMaterial = mesh.material as THREE.Material & {
      color?: THREE.Color
      map?: THREE.Texture
    }
    const base = buildBaseMaterialProperties(options, oldMaterial)
    const newMaterial = createMeshMaterial(material, base, options)
    if (newMaterial) mesh.material = newMaterial
  }
  return mesh
}

/**
 * Clone a model and add instances to the scene
 * @param model The source model to clone
 * @param scene The scene to add clones to
 * @param options Array of transform options for each clone
 */
export const cloneModel = (model: Model, scene: THREE.Scene, options: ModelOptions[]): void => {
  options.forEach(({ position, rotation, scale }) => {
    const clone = model.clone()
    clone.position.set(...position!)
    clone.rotation.set(...rotation!)
    clone.scale.set(...scale!)
    scene.add(clone)
  })
}

/**
 * Change colors of children contained in a mesh
 * @param mesh The model to colorize
 * @param materialColors Array of hex colors to apply to child meshes
 * @returns The colorized mesh
 */
export const colorModel = (mesh: Model, materialColors: number[] = []) => {
  let meshIndex = 0
  mesh.traverse((child: THREE.Object3D) => {
    const meshChild = child as THREE.Mesh
    if (meshChild.isMesh && meshChild.material) {
      const material = meshChild.material
      const targetColor = materialColors[meshIndex % materialColors.length]

      if (Array.isArray(material)) {
        material.forEach((mat: THREE.Material) => {
          const typedArrayMat = mat as MaterialWithColor
          if (typedArrayMat.isMeshStandardMaterial || typedArrayMat.isMeshPhongMaterial) {
            typedArrayMat.color.setHex(targetColor)
          }
        })
      } else {
        const typedMat = material as MaterialWithColor
        if (typedMat.isMeshStandardMaterial || typedMat.isMeshPhongMaterial) {
          typedMat.color.setHex(targetColor)
        }
      }

      meshIndex++
    }
  })

  return mesh
}

const getUniqueName = (
  existing: Record<string, THREE.AnimationAction>,
  base: string,
  index: number
): string => {
  const candidate = index === 1 ? base : `${base}_${index}`
  return Object.prototype.hasOwnProperty.call(existing, candidate)
    ? getUniqueName(existing, base, index + 1)
    : candidate
}

/**
 * Return all the animations for given filename
 * @param mixer The animation mixer
 * @param filenames Filename or array of filenames to load animations from
 * @returns Record mapping animation names to animation actions
 */
export const getAnimations = (
  mixer: THREE.AnimationMixer,
  filenames: string | string[]
): Promise<Record<string, THREE.AnimationAction>> => {
  const files = Array.isArray(filenames) ? filenames : [filenames]
  return new Promise((resolve, reject) => {
    const loader = new FBXLoader()
    const allActions: Record<string, THREE.AnimationAction> = {}
    let loadedCount = 0
    if (files.length === 0) {
      resolve(allActions)
      return
    }
    files.forEach((filename) => {
      loader.load(
        `/${filename}`,
        (animation) => {
          animation.animations.forEach((anim) => {
            let baseName = filename.split('/').pop() ?? filename
            baseName = baseName.replace(/\.[^./]+$/, '')
            const name = getUniqueName(allActions, baseName, 1)
            allActions[name] = mixer.clipAction(anim)
          })
          loadedCount++
          if (loadedCount === files.length) {
            resolve(allActions)
          }
        },
        undefined,
        reject
      )
    })
  })
}

const applyModelShadows = (mesh: Model, castShadow: boolean, receiveShadow: boolean): void => {
  mesh.traverse((child: THREE.Object3D) => {
    const meshChild = child as THREE.Mesh
    if (meshChild.isMesh) {
      meshChild.castShadow = castShadow
      meshChild.receiveShadow = receiveShadow
    }
  })
}

const loadModelFile = async (
  path: string,
  options: ModelOptions
): Promise<{ mesh: Model; gltf: GLTF | undefined }> => {
  const isGLTF = ['glb', '.gltf'].some((extension) => path.includes(extension))
  if (isGLTF) {
    const result = await loadGLTF(path, options)
    return { mesh: result.model, gltf: result.gltf }
  }
  const mesh = await loadFBX(path, options)
  return { mesh, gltf: undefined }
}

const loadAnimationActions = async (
  mixer: THREE.AnimationMixer,
  mesh: Model,
  animations: string | string[] | undefined,
  gltf: GLTF | undefined
): Promise<Record<string, THREE.AnimationAction>> => {
  let actions: Record<string, THREE.AnimationAction> = {}
  if (animations) {
    actions = { ...actions, ...(await getAnimations(mixer, animations)) }
  }
  if (gltf && gltf.animations?.length) {
    actions = { ...actions, ...getAnimationsModel(mixer, mesh, gltf) }
  }
  return actions
}

const applyModelMaterial = (
  mesh: THREE.Mesh,
  options: ModelOptions,
  defaultMaterial: ModelOptions['material'] = 'MeshPhysicalMaterial'
) => applyMaterial(mesh, { ...options, material: options.material ?? defaultMaterial })

const getCubeSizeArray = (size: number | CoordinateTuple): CoordinateTuple =>
  typeof size === 'number' ? [size, size, size] : size

const applyTextureToMesh = (mesh: THREE.Mesh, texture: string | undefined): void => {
  if (!texture) return
  const textureLoader = new THREE.TextureLoader()
  if (Array.isArray(mesh.material)) {
    ;(mesh.material[0] as THREE.MeshStandardMaterial).map = textureLoader.load(texture)
  } else {
    ;(mesh.material as THREE.MeshStandardMaterial).map = textureLoader.load(texture)
  }
}

const setupCubeMesh = (
  options: ModelOptions,
  size: CoordinateTuple,
  rotation: CoordinateTuple,
  position: CoordinateTuple,
  origin: { x?: number; y?: number; z?: number }
): THREE.Mesh => {
  const geometry = new THREE.BoxGeometry(...size)
  applyOriginTranslation(geometry, size, origin)
  const mesh = applyModelMaterial(new THREE.Mesh(geometry), options)
  applyTextureToMesh(mesh, options.texture)
  mesh.position.set(...(position as CoordinateTuple))
  mesh.rotation.set(...rotation)
  mesh.castShadow = options.castShadow ?? true
  mesh.receiveShadow = options.receiveShadow ?? true
  mesh.renderOrder = options.renderOrder ?? 0
  return mesh
}

const buildComplexModelUserData = (params: {
  rigidBody: RAPIER.RigidBody
  collider: RAPIER.Collider
  characterController: RAPIER.KinematicCharacterController | undefined
  initialValues: {
    size: number | CoordinateTuple
    rotation: CoordinateTuple
    position: CoordinateTuple
    color: number | undefined
  }
  actions: Record<string, THREE.AnimationAction>
  mixer?: THREE.AnimationMixer
  helper?: THREE.BoxHelper
  type: ModelType
  hasGravity: boolean
  onSpawn?: () => boolean
}) => ({
  body: params.rigidBody,
  collider: params.collider,
  initialValues: params.initialValues,
  actions: params.actions,
  mixer: params.mixer,
  helper: params.helper,
  type: params.type,
  characterController: params.characterController,
  hasGravity: params.hasGravity,
  onSpawn: params.onSpawn
})

/**
 * Load any type of model, apply default values and add physic to it
 * @param scene The Three.js scene
 * @param world The Rapier physics world
 * @param path Path of the file to be loaded
 * @param options Options for the model
 * @returns A ComplexModel with physics and animation support
 */
export const getModel = async (
  scene: THREE.Scene,
  world: RAPIER.World,
  path: string,
  options: ModelOptions = {}
): Promise<ComplexModel> => {
  const {
    name,
    materialColors,
    hasGravity = false,
    showHelper = false,
    helperColor,
    animations,
    onSpawn,
    size = 1,
    position = [0, 0, 0] as CoordinateTuple,
    rotation = [0, 0, 0] as CoordinateTuple,
    type = 'dynamic',
    castShadow = false,
    receiveShadow = false
  } = options

  const { mesh, gltf } = await loadModelFile(path, options)
  applyModelShadows(mesh, castShadow, receiveShadow)

  if (materialColors && materialColors.length > 0) colorModel(mesh, materialColors)
  if (name) mesh.name = name
  scene.add(mesh)

  let helper: THREE.BoxHelper | undefined
  if (showHelper) {
    helper = new THREE.BoxHelper(mesh, helperColor)
    scene.add(helper)
  }

  const mixer = new THREE.AnimationMixer(mesh)
  const actions = await loadAnimationActions(mixer, mesh, animations, gltf)

  const { rigidBody, collider, characterController } = getPhysic(world, {
    position,
    size,
    rotation,
    restitution: options.restitution,
    weight: options.weight,
    density: options.density,
    friction: options.friction,
    dominance: options.dominance,
    boundary: options.boundary,
    angular: options.angular,
    damping: options.damping,
    mass: options.mass,
    shape: options.shape,
    type,
    enabledRotations: options.enabledRotations
  })

  const complexModel = Object.assign(mesh, {
    userData: {
      body: rigidBody,
      collider,
      initialValues: { size, rotation, position, color: options.color },
      actions,
      mixer,
      helper,
      type,
      characterController,
      hasGravity,
      onSpawn
    }
  })

  if (onSpawn) onSpawn()

  return complexModel
}

/**
 * Attach animations to a model
 * @param model The model to attach animations to
 * @param fileName The animation file to load
 * @param index The animation index to play
 * @returns An animation mixer with the loaded animation playing
 */
export const loadAnimation = (
  model: Model,
  fileName: string,
  index: number = 0
): Promise<THREE.AnimationMixer> => {
  return new Promise((resolve) => {
    const loader = new FBXLoader()
    loader.load(`/${fileName}`, (animation) => {
      const mixer = new THREE.AnimationMixer(model)
      const action = mixer.clipAction(
        (model?.animations?.length ? model : animation).animations[index]
      )
      action.play()
      resolve(mixer)
    })
  })
}

/**
 * Load an FBX model file
 * @param fileName Path to the FBX file
 * @param options Model options to apply
 * @returns The loaded model
 */
export const loadFBX = (fileName: string, options: ModelOptions = {}): Promise<Model> => {
  const {
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = [1, 1, 1],
    castShadow = false,
    receiveShadow = false
  } = options

  return new Promise((resolve, reject) => {
    const loader = new FBXLoader()
    loader.load(
      `/${fileName}`,
      (model) => {
        model.position.set(...position)
        model.scale.set(...scale)
        model.rotation.set(...rotation)
        model.castShadow = castShadow
        model.receiveShadow = receiveShadow

        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            applyMaterial(child as THREE.Mesh, options)
          }
        })

        resolve(model)
      },
      undefined,
      reject
    )
  })
}

/**
 * Load a GLTF/GLB model file
 * @param fileName Path to the GLTF/GLB file
 * @param options Model options to apply
 * @returns The loaded model and raw GLTF data
 */
export const loadGLTF = (
  fileName: string,
  options: ModelOptions = {}
): Promise<{ model: Model; gltf: GLTF }> => {
  const {
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = [1, 1, 1],
    castShadow = false,
    receiveShadow = false
  } = options

  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader()
    loader.load(
      `/${fileName}`,
      (gltf) => {
        const model = gltf.scene
        model.castShadow = castShadow
        model.receiveShadow = receiveShadow
        model.position.set(...position)
        model.scale.set(...scale)
        model.rotation.set(...rotation)

        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            applyMaterial(child as THREE.Mesh, options)
          }
        })

        resolve({ model, gltf })
      },
      undefined,
      reject
    )
  })
}

/**
 * Create a ball with physics, texture, and shadow
 * @param scene The Three.js scene
 * @param world The Rapier physics world
 * @param options Model options including physics and render settings
 * @returns A ComplexModel representing the ball
 */
export const getBall = (
  scene: THREE.Scene,
  world: RAPIER.World,
  options: ModelOptions = {}
): ComplexModel => {
  const {
    name,
    size = 1,
    position = [0, 0, 0] as CoordinateTuple,
    hasGravity = false,
    showHelper = false,
    helperColor,
    texture,
    onSpawn,
    castShadow = true,
    receiveShadow = true,
    type = 'dynamic'
  } = options

  const initialValues = {
    size,
    rotation: [0, 0, 0] as CoordinateTuple,
    position,
    color: options.color
  }

  const geometry = new THREE.SphereGeometry(size as number)
  const mesh = applyModelMaterial(new THREE.Mesh(geometry), options)

  applyTextureToMesh(mesh, texture)

  if (name) mesh.name = name
  mesh.position.set(...position)
  mesh.castShadow = castShadow
  mesh.receiveShadow = receiveShadow
  scene.add(mesh)

  const { rigidBody, collider, characterController } = getPhysic(world, {
    ...options,
    shape: 'ball',
    boundary: 0.8,
    rotation: [0.5, 0.5, 0.5] as CoordinateTuple
  })

  let helper: THREE.BoxHelper | undefined
  if (showHelper) {
    helper = new THREE.BoxHelper(mesh, helperColor)
    scene.add(helper)
  }

  const complexModel = Object.assign(mesh, {
    userData: buildComplexModelUserData({
      rigidBody,
      collider,
      characterController,
      initialValues,
      actions: {},
      type,
      hasGravity,
      onSpawn,
      helper
    })
  })

  if (onSpawn) onSpawn()

  return complexModel
}

/**
 * Create a cube with physics, texture, and shadow
 * @param scene The Three.js scene
 * @param world The Rapier physics world
 * @param options Model options including physics and render settings
 * @returns A ComplexModel representing the cube
 */
export const getCube = (
  scene: THREE.Scene,
  world: RAPIER.World,
  options: ModelOptions = {}
): ComplexModel => {
  const {
    name,
    size = [5, 5, 5] as CoordinateTuple,
    rotation = [0, 0, 0] as CoordinateTuple,
    position = [0, 0, 0] as CoordinateTuple,
    hasGravity = false,
    showHelper = false,
    helperColor,
    origin = { y: 0 },
    onSpawn,
    type = 'dynamic'
  } = options

  const initialValues = { size, rotation, position, color: options.color }
  const sizeArray = getCubeSizeArray(size)
  const mesh = setupCubeMesh(options, sizeArray, rotation, position, origin)

  if (name) mesh.name = name
  scene.add(mesh)

  const { rigidBody, collider, characterController } = getPhysic(world, {
    ...options,
    size: sizeArray,
    shape: 'cuboid'
  })

  let helper: THREE.BoxHelper | undefined
  if (showHelper) {
    helper = new THREE.BoxHelper(mesh, helperColor)
    scene.add(helper)
  }

  const complexModel = Object.assign(mesh, {
    userData: {
      body: rigidBody,
      collider,
      initialValues,
      actions: {},
      mixer: undefined,
      helper,
      type,
      characterController,
      hasGravity,
      onSpawn
    }
  })

  if (onSpawn) onSpawn()

  return complexModel
}

/**
 * Create walls around a space and return them as a single group
 * @param scene The Three.js scene
 * @param world The Rapier physics world
 * @param options Wall dimensions and display options
 * @returns A Three.js Group containing all wall meshes
 */
export const getWalls = (
  scene: THREE.Scene,
  world: RAPIER.World,
  {
    name,
    length = 200,
    height = 50,
    depth = 0.2,
    opacity = 1
  }: { name?: string; length?: number; height?: number; depth?: number; opacity?: number } = {}
): THREE.Group => {
  const group = new THREE.Group()

  ;[
    { position: [0, 0, 0], size: [length, depth, length], suffix: 'floor' },
    { position: [-length / 2, 0, 0], size: [depth, height, length], suffix: 'left' },
    { position: [length / 2, 0, 0], size: [depth, height, length], suffix: 'right' },
    { position: [0, 0, -length / 2], size: [length, height, depth], suffix: 'back' }
  ].forEach(({ position, size, suffix }) => {
    const wall = getCube(scene, world, {
      name: name ? `${name}-${suffix}` : undefined,
      color: 0xcccccc,
      opacity,
      size: size as CoordinateTuple,
      position: position as CoordinateTuple,
      type: 'fixed'
    })
    scene.remove(wall)
    group.add(wall)
  })

  scene.add(group)
  return group
}
