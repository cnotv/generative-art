import * as THREE from 'three'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import RAPIER from '@dimforge/rapier3d-compat'
import { getAnimationsModel, CoordinateTuple } from '@webgamekit/animation'
import { ModelOptions, ComplexModel, Model, ModelType, OnProgress } from './types'

const emitProgress = (
  callback: OnProgress | undefined,
  stage: string,
  detail?: string,
  done = false
): void => {
  callback?.({ stage, detail, done })
}
import { getPhysic } from './getters'
import { getOriginOffset } from './core'
import { textureLoader, fbxLoader, gltfLoader } from './loaders'

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
  if (options.displacementScale !== undefined) props.displacementScale = options.displacementScale
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
  if (materialType instanceof THREE.Material) return materialType
  if (materialType === 'MeshPhysicalMaterial') return buildPhysicalMaterial(base, options)
  if (materialType === 'MeshStandardMaterial') return buildStandardMaterial(base, options)
  if (materialType === 'MeshLambertMaterial')
    return new THREE.MeshLambertMaterial({ ...base, flatShading: false })
  if (materialType === 'MeshPhongMaterial')
    return new THREE.MeshPhongMaterial({ ...base, shininess: 30 })
  if (materialType === 'MeshBasicMaterial') return new THREE.MeshBasicMaterial({ ...base })
  return null
}

// Appearance props that can be written straight onto an existing material,
// letting getModel recolor or fade a loaded model without swapping (and losing)
// its authored material — mirrors the props buildBaseMaterialProperties sets.
const MUTABLE_MATERIAL_PROPS = [
  'wireframe',
  'depthWrite',
  'alphaTest',
  'reflectivity',
  'roughness',
  'metalness',
  'transmission',
  'clearcoat',
  'clearcoatRoughness',
  'ior',
  'thickness',
  'envMapIntensity',
  'displacementScale'
] as const

const APPEARANCE_OPTION_KEYS = [
  'color',
  'opacity',
  'transparent',
  ...MUTABLE_MATERIAL_PROPS
] as const

const hasAppearanceOptions = (options: ModelOptions): boolean =>
  APPEARANCE_OPTION_KEYS.some((key) => options[key] !== undefined)

const mutateMaterialInPlace = (material: THREE.Material, options: ModelOptions): void => {
  const typed = material as THREE.Material & Record<string, unknown> & { color?: THREE.Color }
  if (options.color !== undefined && typed.color instanceof THREE.Color)
    typed.color.set(options.color)
  if (options.opacity !== undefined || options.transparent !== undefined) {
    const isTransparent = options.transparent ?? (options.opacity ?? 1) < 1
    material.transparent = isTransparent
    if (options.opacity !== undefined) material.opacity = options.opacity
    if (options.depthWrite === undefined) material.depthWrite = !isTransparent
  }
  MUTABLE_MATERIAL_PROPS.forEach((key) => {
    if (options[key] !== undefined && key in typed) typed[key] = options[key]
  })
  material.needsUpdate = true
}

const mutateMaterialAppearance = (
  material: THREE.Material | THREE.Material[],
  options: ModelOptions
): void => {
  const materials = Array.isArray(material) ? material : [material]
  materials.forEach((mat) => mutateMaterialInPlace(mat, options))
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
  } else if (hasAppearanceOptions(options)) {
    mutateMaterialAppearance(mesh.material, options)
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
  filenames: string | string[],
  onProgress?: OnProgress
): Promise<Record<string, THREE.AnimationAction>> => {
  const files = Array.isArray(filenames) ? filenames : [filenames]
  return new Promise((resolve, reject) => {
    const loader = fbxLoader
    const allActions: Record<string, THREE.AnimationAction> = {}
    let loadedCount = 0
    if (files.length === 0) {
      resolve(allActions)
      return
    }
    files.forEach((filename) => {
      const baseName = (filename.split('/').pop() ?? filename).replace(/\.[^./]+$/, '')
      emitProgress(onProgress, 'Animations', `${baseName} (${loadedCount + 1}/${files.length})`)
      loader.load(
        `/${filename}`,
        (animation) => {
          animation.animations.forEach((anim) => {
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
  gltf: GLTF | undefined,
  onProgress?: OnProgress
): Promise<Record<string, THREE.AnimationAction>> => {
  let actions: Record<string, THREE.AnimationAction> = {}
  if (animations) {
    actions = { ...actions, ...(await getAnimations(mixer, animations, onProgress)) }
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

const applyTextureToMesh = (
  mesh: THREE.Mesh,
  texture: string | undefined,
  options: ModelOptions = {}
): void => {
  if (!texture) return
  const tex = textureLoader.load(texture)
  const mat = Array.isArray(mesh.material)
    ? (mesh.material[0] as THREE.MeshPhysicalMaterial)
    : (mesh.material as THREE.MeshPhysicalMaterial)
  mat.map = tex
  if (options.displacementScale !== undefined && options.displacementScale > 0) {
    mat.displacementMap = tex
  }
}

const setupCubeMesh = (
  options: ModelOptions,
  size: CoordinateTuple,
  rotation: CoordinateTuple,
  position: CoordinateTuple
): THREE.Mesh => {
  const geometry = new THREE.BoxGeometry(...size)
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
    gravityScale,
    showHelper = false,
    helperColor,
    animations,
    onSpawn,
    onProgress,
    size = 1,
    position = [0, 0, 0] as CoordinateTuple,
    rotation = [0, 0, 0] as CoordinateTuple,
    type = 'dynamic',
    castShadow = false,
    receiveShadow = false
  } = options

  emitProgress(onProgress, 'Model', path)
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
  const actions = await loadAnimationActions(mixer, mesh, animations, gltf, onProgress)

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
      gravityScale,
      facingOffset: options.facingOffset,
      mirroredFacing: options.mirroredFacing,
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
    fbxLoader.load(`${import.meta.env.BASE_URL}${fileName}`, (animation) => {
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
    fbxLoader.load(
      `${import.meta.env.BASE_URL}${fileName}`,
      (model) => {
        model.position.set(...position)
        model.scale.set(...scale)
        model.rotation.set(...rotation)
        model.castShadow = castShadow
        model.receiveShadow = receiveShadow

        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            applyMaterial(child as THREE.Mesh, options)
            applyTextureToMesh(child as THREE.Mesh, options.texture)
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
    gltfLoader.load(
      `${import.meta.env.BASE_URL}${fileName}`,
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
            applyTextureToMesh(child as THREE.Mesh, options.texture)
          }
        })

        resolve({ model, gltf })
      },
      undefined,
      reject
    )
  })
}

const attachBallPhysics = (
  scene: THREE.Scene,
  mesh: THREE.Mesh,
  world: RAPIER.World,
  options: ModelOptions
): void => {
  const {
    hasGravity = false,
    showHelper = false,
    helperColor,
    onSpawn,
    type = 'dynamic',
    size = 1,
    position = [0, 0, 0] as CoordinateTuple
  } = options

  const initialValues = {
    size,
    rotation: [0, 0, 0] as CoordinateTuple,
    position,
    color: options.color
  }

  const { rigidBody, collider, characterController } = getPhysic(world, {
    ...options,
    type,
    shape: 'ball',
    boundary: 0.8,
    rotation: [0.5, 0.5, 0.5] as CoordinateTuple
  })

  let helper: THREE.BoxHelper | undefined
  if (showHelper) {
    helper = new THREE.BoxHelper(mesh, helperColor)
    scene.add(helper)
  }

  Object.assign(mesh, {
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
}

/**
 * Create a ball mesh, with optional physics, texture, and shadow
 * @param scene The Three.js scene
 * @param world The Rapier physics world, or undefined for a mesh-only ball
 * @param options Model options including physics and render settings
 * @returns A ComplexModel when world is provided, or a plain THREE.Mesh otherwise
 */
export const getBall = (
  scene: THREE.Scene,
  world: RAPIER.World | undefined,
  options: ModelOptions = {}
): THREE.Mesh => {
  const {
    name,
    size = 1,
    position = [0, 0, 0] as CoordinateTuple,
    texture,
    castShadow = true,
    receiveShadow = true,
    segments = 32,
    setUV2 = false
  } = options

  const geometry = new THREE.SphereGeometry(size as number, segments, segments)
  if (setUV2) geometry.setAttribute('uv2', geometry.attributes['uv'])
  const mesh = applyModelMaterial(new THREE.Mesh(geometry), options)

  applyTextureToMesh(mesh, texture, options)

  if (name) mesh.name = name
  mesh.position.set(...position)
  mesh.castShadow = castShadow
  mesh.receiveShadow = receiveShadow
  scene.add(mesh)

  if (!world) return mesh

  attachBallPhysics(scene, mesh, world, options)

  return mesh
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

  const sizeArray = getCubeSizeArray(size)
  const [offsetX, offsetY, offsetZ] = getOriginOffset(sizeArray, origin)
  const centerPosition: CoordinateTuple = [
    position[0] + offsetX,
    position[1] + offsetY,
    position[2] + offsetZ
  ]

  const initialValues = { size, rotation, position: centerPosition, color: options.color }
  const mesh = setupCubeMesh(options, sizeArray, rotation, centerPosition)

  if (name) mesh.name = name
  scene.add(mesh)

  const { rigidBody, collider, characterController } = getPhysic(world, {
    ...options,
    position: centerPosition,
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

const getTrimeshVertexData = (
  geometry: THREE.BufferGeometry
): { vertices: Float32Array; indices: Uint32Array } => {
  const positionAttribute = geometry.attributes['position'] as THREE.BufferAttribute
  const vertices = new Float32Array(positionAttribute.array)
  const indices = geometry.index
    ? new Uint32Array(geometry.index.array)
    : new Uint32Array(Array.from({ length: positionAttribute.count }, (_, index) => index))
  return { vertices, indices }
}

/**
 * Create a mesh from an arbitrary BufferGeometry with a fixed trimesh collider,
 * for curved surfaces (funnels, loops, arcs) that box colliders cannot represent
 * @param scene The Three.js scene
 * @param world The Rapier physics world
 * @param geometry The BufferGeometry used for both rendering and collision
 * @param options Model options including position, rotation, material, friction and restitution
 * @returns A ComplexModel with the fixed rigid body and trimesh collider in userData
 */
export const getTrimesh = (
  scene: THREE.Scene,
  world: RAPIER.World,
  geometry: THREE.BufferGeometry,
  options: ModelOptions = {}
): ComplexModel => {
  const {
    name,
    position = [0, 0, 0] as CoordinateTuple,
    rotation = [0, 0, 0] as CoordinateTuple,
    friction = 0,
    restitution = 0,
    contactSkin = 0,
    castShadow = true,
    receiveShadow = true
  } = options

  const mesh = applyModelMaterial(new THREE.Mesh(geometry), options, 'MeshStandardMaterial')
  applyTextureToMesh(mesh, options.texture)
  if (name) mesh.name = name
  mesh.position.set(...position)
  mesh.rotation.set(...rotation)
  mesh.castShadow = castShadow
  mesh.receiveShadow = receiveShadow
  scene.add(mesh)

  const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(...position)
  const rigidBody = world.createRigidBody(rigidBodyDesc)
  const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation))
  rigidBody.setRotation(quaternion, true)

  const { vertices, indices } = getTrimeshVertexData(geometry)
  // FIX_INTERNAL_EDGES smooths contact normals across triangle boundaries so
  // rolling bodies do not bump or catch on the mesh's internal edges.
  const colliderDesc = RAPIER.ColliderDesc.trimesh(
    vertices,
    indices,
    RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES
  )
    .setFriction(friction)
    .setRestitution(restitution)
    .setContactSkin(contactSkin)
  const collider = world.createCollider(colliderDesc, rigidBody)

  const initialValues = { size: 1, rotation, position, color: options.color }

  return Object.assign(mesh, {
    userData: {
      body: rigidBody,
      collider,
      initialValues,
      actions: {},
      mixer: undefined,
      helper: undefined,
      type: 'fixed' as const,
      characterController: undefined,
      hasGravity: false,
      onSpawn: undefined
    }
  })
}
