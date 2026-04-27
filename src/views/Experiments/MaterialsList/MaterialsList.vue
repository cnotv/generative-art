<script setup lang="ts">
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { stats } from '@/utils/stats'
import { getTools, getBall, createTextSprite } from '@webgamekit/threejs'
import { createTimelineManager, animateTimeline } from '@webgamekit/animation'
import { useDebugSceneStore } from '@/stores/debugScene'
import { registerViewConfig, unregisterViewConfig, createReactiveConfig } from '@/stores/viewConfig'
import { useViewPanelsStore } from '@/stores/viewPanels'
import brickTextureUrl from '@/assets/images/textures/brick.jpg'
import type { MaterialTypeName, MapToggleKey, MaterialsListConfig } from './types'
import {
  MATERIAL_TYPES,
  MAIN_MATERIAL_TYPES,
  SPECIAL_MATERIAL_TYPES,
  MATERIAL_LABELS,
  MATERIAL_DESCRIPTIONS,
  MATERIAL_PROPERTIES,
  MATERIAL_FEATURES,
  SPHERE_SEGMENT_COUNT,
  SPHERE_RADIUS,
  WAVE_WIDTH,
  WAVE_HALF_WIDTH,
  WAVE_AMPLITUDE,
  WAVE_Y_OFFSET,
  WAVE_CYCLES,
  WAVE_SEGMENTS,
  WAVE_COLOR,
  WAVE_TUBE_RADIUS,
  WAVE_TUBE_RADIAL_SEGMENTS,
  WAVE_DASH_COUNT,
  WAVE_DASH_DUTY,
  TEXT_COLOR_LABEL,
  TEXT_COLOR_DESCRIPTION,
  TEXT_COLOR_PROPERTIES,
  TEXT_COLOR_VALUE,
  PROCEDURAL_TEXTURE_SIZE,
  DISPLACEMENT_SCALE,
  NORMAL_STRENGTH,
  LIGHT_ORBIT_SPEED,
  LIGHT_ORBIT_RADIUS,
  LIGHT_Z_POSITION,
  EMISSIVE_COLOR,
  EMISSIVE_INTENSITY,
  CLEARCOAT_VALUE,
  CLEARCOAT_ROUGHNESS_VALUE,
  PHONG_SHININESS,
  ENV_MAP_INTENSITY,
  ENV_MAP_REFLECTIVITY,
  ENV_GROUND_SIZE,
  ENV_GROUND_Y,
  ENV_LIGHT_INTENSITY,
  ENV_LIGHT_POSITION,
  ENV_LIGHT_Y,
  ENV_AMBIENT_COLOR,
  ENV_AMBIENT_INTENSITY,
  ENV_SKY_COLOR,
  ENV_GROUND_COLOR,
  SCENE_BG_COLOR,
  GROUND_WIDTH,
  GROUND_DEPTH,
  GROUND_COLOR,
  GROUND_ROTATION_X,
  GROUND_BACKGROUND_Y,
  GROUND_BACKGROUND_Z,
  LIGHT_INTENSITY,
  HEMISPHERE_SKY,
  HEMISPHERE_GROUND,
  MATERIAL_COLOR,
  ENV_LIGHT_COLOR,
  ORTHO_NEAR_PLANE,
  ORTHO_FAR_PLANE,
  ORTHO_FRUSTUM_HALF_HEIGHT,
  ORTHO_CAMERA_DISTANCE,
  LABEL_Y_OFFSET,
  DESCRIPTION_Y_OFFSET,
  PROPERTIES_Y_OFFSET,
  SPECIAL_COLUMN_X,
  SPECIAL_COLUMN_Y_START,
  SPECIAL_COLUMN_Y_SPACING,
  LEGEND_SWATCH_Y,
  LEGEND_SWATCH_SIZE,
  LEGEND_SWATCH_SPACING,
  LEGEND_LABEL_Y_OFFSET,
  LEGEND_PROPS_Y,
  LEGEND_PROPERTIES_TEXT,
  LEGEND_FONT_SIZE_LABEL,
  LEGEND_SCALE_LABEL,
  LEGEND_LABEL_CANVAS_WIDTH,
  LEGEND_FONT_SIZE_PROPS,
  LEGEND_SCALE_PROPS,
  SPECIAL_LABEL_Y_OFFSET,
  SPECIAL_DESCRIPTION_Y_OFFSET,
  SPECIAL_PROPERTIES_Y_OFFSET,
  LABEL_FONT_SIZE,
  DESCRIPTION_FONT_SIZE,
  PROPERTIES_FONT_SIZE,
  LABEL_SPRITE_SCALE_Y,
  DESCRIPTION_SPRITE_SCALE_X,
  DESCRIPTION_SPRITE_SCALE_Y,
  PROPERTIES_SPRITE_SCALE_X,
  PROPERTIES_SPRITE_SCALE_Y,
  TARGET_FPS,
  AMBIENT_LIGHT_INTENSITY,
  BRICK_WIDTH,
  BRICK_HEIGHT,
  MORTAR_SIZE,
  MORTAR_EDGE_OFFSET,
  MORTAR_EDGE_SIZE,
  DEFAULT_CONFIG,
  CONFIG_SCHEMA,
  getEnabledMaps
} from './materialsListConfig'

const statsElement = ref(null)
const canvas = ref(null)
const route = useRoute()
const { registerSceneElements, clearSceneElements } = useDebugSceneStore()
const { setViewPanels, clearViewPanels } = useViewPanelsStore()

let sphereMeshes: THREE.Mesh[] = []
let envMap: THREE.Texture | null = null
const textures: Record<string, THREE.Texture> = {}
let directionalLightReference: THREE.DirectionalLight | null = null
let orthoCamera: THREE.OrthographicCamera | null = null
let orbitControls: OrbitControls | null = null
let rendererReference: THREE.WebGLRenderer | null = null

const reactiveConfig = createReactiveConfig<MaterialsListConfig>({ ...DEFAULT_CONFIG })

const createProceduralTexture = (
  drawFunction: (context: CanvasRenderingContext2D, size: number) => void
): THREE.CanvasTexture => {
  const offscreenCanvas = document.createElement('canvas')
  offscreenCanvas.width = PROCEDURAL_TEXTURE_SIZE
  offscreenCanvas.height = PROCEDURAL_TEXTURE_SIZE
  const context = offscreenCanvas.getContext('2d')!
  drawFunction(context, PROCEDURAL_TEXTURE_SIZE)
  const texture = new THREE.CanvasTexture(offscreenCanvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  return texture
}

const drawNormalMap = (context: CanvasRenderingContext2D, size: number): void => {
  const imageData = context.createImageData(size, size)
  const neutralBlue = 255
  const neutralGray = 128
  const depressedValue = 100
  const raisedValue = 156
  Array.from({ length: size * size }, (_, pixelIndex) => {
    const x = pixelIndex % size
    const y = Math.floor(pixelIndex / size)
    const offset = y % (BRICK_HEIGHT * 2) < BRICK_HEIGHT ? 0 : BRICK_WIDTH / 2
    const brickX = (x + offset) % BRICK_WIDTH
    const brickY = y % BRICK_HEIGHT
    const isMortar = brickX < MORTAR_SIZE || brickY < MORTAR_SIZE
    const dataIndex = pixelIndex * 4
    if (isMortar) {
      imageData.data[dataIndex] = neutralGray
      imageData.data[dataIndex + 1] = neutralGray
      imageData.data[dataIndex + 2] = neutralBlue
    } else {
      const normalX =
        brickX < MORTAR_SIZE + MORTAR_EDGE_OFFSET
          ? depressedValue
          : brickX > BRICK_WIDTH - MORTAR_EDGE_SIZE
            ? raisedValue
            : neutralGray
      const normalY =
        brickY < MORTAR_SIZE + MORTAR_EDGE_OFFSET
          ? depressedValue
          : brickY > BRICK_HEIGHT - MORTAR_EDGE_SIZE
            ? raisedValue
            : neutralGray
      imageData.data[dataIndex] = normalX
      imageData.data[dataIndex + 1] = normalY
      imageData.data[dataIndex + 2] = neutralBlue
    }
    imageData.data[dataIndex + 3] = neutralBlue
    return null
  })
  context.putImageData(imageData, 0, 0)
}

const drawBrickGrid = (
  context: CanvasRenderingContext2D,
  size: number,
  fillColor: string,
  baseColor: string,
  extraPadding: number = 0
): void => {
  context.fillStyle = baseColor
  context.fillRect(0, 0, size, size)
  context.fillStyle = fillColor
  Array.from({ length: Math.ceil(size / BRICK_HEIGHT) }, (_, row) =>
    Array.from({ length: Math.ceil(size / BRICK_WIDTH) + 1 }, (__, col) => {
      const offset = row % 2 === 0 ? 0 : BRICK_WIDTH / 2
      const brickX = col * BRICK_WIDTH - offset
      context.fillRect(brickX, row * BRICK_HEIGHT, MORTAR_SIZE + extraPadding, BRICK_HEIGHT)
      context.fillRect(brickX, row * BRICK_HEIGHT, BRICK_WIDTH, MORTAR_SIZE + extraPadding)
      return null
    })
  )
}

const drawDisplacementMap = (context: CanvasRenderingContext2D, size: number): void => {
  context.fillStyle = '#000'
  context.fillRect(0, 0, size, size)
  context.fillStyle = '#ccc'
  Array.from({ length: Math.ceil(size / BRICK_HEIGHT) }, (_, row) =>
    Array.from({ length: Math.ceil(size / BRICK_WIDTH) + 1 }, (__, col) => {
      const offset = row % 2 === 0 ? 0 : BRICK_WIDTH / 2
      const brickX = col * BRICK_WIDTH - offset
      context.fillRect(
        brickX + MORTAR_SIZE,
        row * BRICK_HEIGHT + MORTAR_SIZE,
        BRICK_WIDTH - MORTAR_SIZE * 2,
        BRICK_HEIGHT - MORTAR_SIZE * 2
      )
      return null
    })
  )
}

const drawEmissiveMap = (context: CanvasRenderingContext2D, size: number): void => {
  drawBrickGrid(context, size, '#ff6600', '#000')
}

const loadTextures = (): void => {
  const loader = new THREE.TextureLoader()
  textures.diffuse = loader.load(brickTextureUrl)
  textures.diffuse.wrapS = THREE.RepeatWrapping
  textures.diffuse.wrapT = THREE.RepeatWrapping
  textures.diffuse.colorSpace = THREE.SRGBColorSpace

  textures.normal = createProceduralTexture(drawNormalMap)
  textures.roughness = createProceduralTexture((context, size) =>
    drawBrickGrid(context, size, '#fff', '#999')
  )
  textures.ao = createProceduralTexture((context, size) =>
    drawBrickGrid(context, size, 'rgba(0,0,0,0.4)', '#fff', 2)
  )
  textures.displacement = createProceduralTexture(drawDisplacementMap)
  textures.emissive = createProceduralTexture(drawEmissiveMap)
}

const createEnvironmentMap = (rendererInstance: THREE.WebGLRenderer): THREE.Texture => {
  const pmremGenerator = new THREE.PMREMGenerator(rendererInstance)
  const envScene = new THREE.Scene()
  envScene.background = new THREE.Color(ENV_SKY_COLOR)
  const groundGeometry = new THREE.PlaneGeometry(ENV_GROUND_SIZE, ENV_GROUND_SIZE)
  const groundMaterial = new THREE.MeshBasicMaterial({ color: ENV_GROUND_COLOR })
  const ground = new THREE.Mesh(groundGeometry, groundMaterial)
  ground.rotation.x = -Math.PI / 2
  ground.position.y = ENV_GROUND_Y
  envScene.add(ground)
  const envLight = new THREE.DirectionalLight(ENV_LIGHT_COLOR, ENV_LIGHT_INTENSITY)
  envLight.position.set(ENV_LIGHT_POSITION, ENV_LIGHT_Y, ENV_LIGHT_POSITION)
  envScene.add(envLight)
  envScene.add(new THREE.AmbientLight(ENV_AMBIENT_COLOR, ENV_AMBIENT_INTENSITY))
  const renderTarget = pmremGenerator.fromScene(envScene, 0)
  pmremGenerator.dispose()
  groundGeometry.dispose()
  groundMaterial.dispose()
  return renderTarget.texture
}

const createWavePath = (scene: THREE.Scene): THREE.Vector3[] => {
  const controlPoints = Array.from({ length: WAVE_SEGMENTS }, (_, i) => {
    const t = i / (WAVE_SEGMENTS - 1)
    const x = t * WAVE_WIDTH - WAVE_HALF_WIDTH
    const y = WAVE_AMPLITUDE * Math.sin(t * Math.PI * 2 * WAVE_CYCLES) + WAVE_Y_OFFSET
    return new THREE.Vector3(x, y, 0)
  })
  const curve = new THREE.CatmullRomCurve3(controlPoints)

  const allPoints = curve.getSpacedPoints(WAVE_SEGMENTS)
  const pointsPerDash = (WAVE_SEGMENTS + 1) / WAVE_DASH_COUNT
  const dashPointCount = Math.floor(pointsPerDash * WAVE_DASH_DUTY)
  const dashMaterial = new THREE.MeshBasicMaterial({ color: WAVE_COLOR })
  const dashGroup = new THREE.Group()

  Array.from({ length: WAVE_DASH_COUNT }, (_, dashIndex) => {
    const startIndex = Math.floor(dashIndex * pointsPerDash)
    const segmentPoints = allPoints.slice(startIndex, startIndex + dashPointCount + 1)
    if (segmentPoints.length < 2) return
    const segmentCurve = new THREE.CatmullRomCurve3(segmentPoints)
    const tubeGeometry = new THREE.TubeGeometry(
      segmentCurve,
      Math.max(2, dashPointCount),
      WAVE_TUBE_RADIUS,
      WAVE_TUBE_RADIAL_SEGMENTS,
      false
    )
    dashGroup.add(new THREE.Mesh(tubeGeometry, dashMaterial))
  })
  scene.add(dashGroup)

  return curve.getSpacedPoints(MAIN_MATERIAL_TYPES.length - 1)
}

const createSpecialColumn = (): THREE.Vector3[] =>
  Array.from(
    SPECIAL_MATERIAL_TYPES,
    (_, i) =>
      new THREE.Vector3(SPECIAL_COLUMN_X, SPECIAL_COLUMN_Y_START - i * SPECIAL_COLUMN_Y_SPACING, 0)
  )

const createLegend = (scene: THREE.Scene): void => {
  const swatchDefs = [
    { texture: textures.diffuse, label: 'Diffuse\nbase color' },
    { texture: textures.normal, label: 'Normal\ngeometry' },
    { texture: textures.roughness, label: 'Roughness\nscatter' },
    { texture: textures.ao, label: 'AO\nshadow' },
    { texture: textures.displacement, label: 'Displacement\nvertex' },
    { texture: textures.emissive, label: 'Emissive\nglow' }
  ]

  const halfSpan = ((swatchDefs.length - 1) / 2) * LEGEND_SWATCH_SPACING
  const swatchMat = new THREE.MeshBasicMaterial()

  swatchDefs.forEach(({ texture, label }, i) => {
    const x = i * LEGEND_SWATCH_SPACING - halfSpan
    const mat = swatchMat.clone()
    mat.map = texture
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(LEGEND_SWATCH_SIZE, LEGEND_SWATCH_SIZE),
      mat
    )
    plane.position.set(x, LEGEND_SWATCH_Y, 0)
    scene.add(plane)

    const labelSprite = createTextSprite({
      text: label,
      fontSize: LEGEND_FONT_SIZE_LABEL,
      color: '#aabbcc',
      canvasWidth: LEGEND_LABEL_CANVAS_WIDTH,
      scaleY: LEGEND_SCALE_LABEL,
      autoAspect: true
    })
    labelSprite.position.set(x, LEGEND_SWATCH_Y - LEGEND_LABEL_Y_OFFSET, 0)
    scene.add(labelSprite)
  })

  swatchMat.dispose()

  const propsSprite = createTextSprite({
    text: LEGEND_PROPERTIES_TEXT,
    fontSize: LEGEND_FONT_SIZE_PROPS,
    color: '#889aaa',
    canvasWidth: 2048,
    scaleY: LEGEND_SCALE_PROPS,
    autoAspect: true
  })
  propsSprite.position.set(0, LEGEND_PROPS_Y, 0)
  scene.add(propsSprite)
}

const buildMaterial = (
  typeName: MaterialTypeName,
  supported: MapToggleKey[],
  maps: Record<MapToggleKey, boolean>,
  configValues: MaterialsListConfig
): THREE.Material => {
  const parameters: Record<string, unknown> = {}
  const hasFeature = (key: MapToggleKey): boolean => supported.includes(key) && maps[key]

  if (!['MeshNormalMaterial', 'MeshDepthMaterial'].includes(typeName)) {
    parameters.color = MATERIAL_COLOR
  }
  if (hasFeature('diffuse')) parameters.map = textures.diffuse
  if (hasFeature('normal')) {
    parameters.normalMap = textures.normal
    parameters.normalScale = new THREE.Vector2(NORMAL_STRENGTH, NORMAL_STRENGTH)
  }
  if (hasFeature('roughness')) parameters.roughnessMap = textures.roughness
  if (hasFeature('metalness')) parameters.metalnessMap = textures.roughness
  if (hasFeature('ao')) {
    parameters.aoMap = textures.ao
    parameters.aoMapIntensity = 1
  }
  if (hasFeature('displacement')) {
    parameters.displacementMap = textures.displacement
    parameters.displacementScale = DISPLACEMENT_SCALE
  }
  if (hasFeature('emissive') && typeName !== 'MeshBasicMaterial') {
    parameters.emissiveMap = textures.emissive
    parameters.emissive = new THREE.Color(EMISSIVE_COLOR)
    parameters.emissiveIntensity = EMISSIVE_INTENSITY
  }
  if (hasFeature('envMap') && envMap) {
    const isPbr = ['MeshStandardMaterial', 'MeshPhysicalMaterial'].includes(typeName)
    parameters.envMap = envMap
    if (isPbr) {
      parameters.envMapIntensity = ENV_MAP_INTENSITY
    } else {
      parameters.combine = THREE.AddOperation
      parameters.reflectivity = ENV_MAP_REFLECTIVITY
    }
  }
  if (['MeshStandardMaterial', 'MeshPhysicalMaterial'].includes(typeName)) {
    parameters.roughness = configValues.properties.roughness
    parameters.metalness = configValues.properties.metalness
  }
  if (typeName === 'MeshPhysicalMaterial') {
    parameters.clearcoat = CLEARCOAT_VALUE
    parameters.clearcoatRoughness = CLEARCOAT_ROUGHNESS_VALUE
  }
  if (typeName === 'MeshPhongMaterial') {
    parameters.shininess = PHONG_SHININESS
  }

  const materialConstructors: Record<MaterialTypeName, new (p: never) => THREE.Material> = {
    MeshBasicMaterial: THREE.MeshBasicMaterial,
    MeshLambertMaterial: THREE.MeshLambertMaterial,
    MeshPhongMaterial: THREE.MeshPhongMaterial,
    MeshStandardMaterial: THREE.MeshStandardMaterial,
    MeshPhysicalMaterial: THREE.MeshPhysicalMaterial,
    MeshToonMaterial: THREE.MeshToonMaterial,
    MeshNormalMaterial: THREE.MeshNormalMaterial,
    MeshDepthMaterial: THREE.MeshDepthMaterial
  }

  const Constructor = materialConstructors[typeName]
  const material = new Constructor(parameters as never)
  ;(material as THREE.MeshBasicMaterial).wireframe = configValues.properties.wireframe
  return material
}

const rebuildMaterials = (): void => {
  const configValues = reactiveConfig.value
  const maps = getEnabledMaps(configValues)
  sphereMeshes.forEach((mesh, index) => {
    const typeName = MATERIAL_TYPES[index]
    const supported = MATERIAL_FEATURES[typeName]
    const oldMaterial = mesh.material as THREE.Material
    mesh.material = buildMaterial(typeName, supported, maps, configValues)
    oldMaterial.dispose()
  })
}

interface TextOffsets {
  label: number
  description: number
  properties: number
}

const createSphereGroup = (
  scene: THREE.Scene,
  types: MaterialTypeName[],
  positions: THREE.Vector3[],
  offsets: TextOffsets
): THREE.Mesh[] => {
  const configValues = reactiveConfig.value
  const maps = getEnabledMaps(configValues)

  return types.map((typeName, index) => {
    const supported = MATERIAL_FEATURES[typeName]
    const material = buildMaterial(typeName, supported, maps, configValues)
    const position = positions[index]
    const mesh = getBall(scene, undefined, {
      name: typeName,
      size: SPHERE_RADIUS,
      position: [position.x, position.y, position.z],
      material,
      segments: SPHERE_SEGMENT_COUNT,
      setUV2: true
    })

    const label = createTextSprite({
      text: MATERIAL_LABELS[typeName],
      fontSize: LABEL_FONT_SIZE,
      scaleY: LABEL_SPRITE_SCALE_Y,
      color: TEXT_COLOR_LABEL,
      fontStyle: 'bold',
      canvasWidth: 512,
      autoAspect: true
    })
    label.position.set(position.x, position.y + offsets.label, 0)
    scene.add(label)

    const description = createTextSprite({
      text: MATERIAL_DESCRIPTIONS[typeName],
      fontSize: DESCRIPTION_FONT_SIZE,
      scaleX: DESCRIPTION_SPRITE_SCALE_X,
      scaleY: DESCRIPTION_SPRITE_SCALE_Y,
      color: TEXT_COLOR_DESCRIPTION,
      fontStyle: '600',
      align: 'left',
      centerBlock: true
    })
    description.position.set(position.x, position.y + offsets.description, 0)
    scene.add(description)

    const properties = createTextSprite({
      text: MATERIAL_PROPERTIES[typeName],
      fontSize: PROPERTIES_FONT_SIZE,
      scaleX: PROPERTIES_SPRITE_SCALE_X,
      scaleY: PROPERTIES_SPRITE_SCALE_Y,
      color: TEXT_COLOR_PROPERTIES,
      fontFamily: 'monospace',
      align: 'left',
      centerBlock: true,
      valueColor: TEXT_COLOR_VALUE
    })
    properties.position.set(position.x, position.y + offsets.properties, 0)
    scene.add(properties)

    return mesh
  })
}

const createSpheres = (
  scene: THREE.Scene,
  mainPositions: THREE.Vector3[],
  specialPositions: THREE.Vector3[]
): void => {
  const mainMeshes = createSphereGroup(scene, MAIN_MATERIAL_TYPES, mainPositions, {
    label: LABEL_Y_OFFSET,
    description: DESCRIPTION_Y_OFFSET,
    properties: PROPERTIES_Y_OFFSET
  })
  const specialMeshes = createSphereGroup(scene, SPECIAL_MATERIAL_TYPES, specialPositions, {
    label: -SPECIAL_LABEL_Y_OFFSET,
    description: -SPECIAL_DESCRIPTION_Y_OFFSET,
    properties: -SPECIAL_PROPERTIES_Y_OFFSET
  })
  sphereMeshes = [...mainMeshes, ...specialMeshes]
}

const createOrthographicCamera = (): THREE.OrthographicCamera => {
  const aspect = window.innerWidth / window.innerHeight
  const halfWidth = ORTHO_FRUSTUM_HALF_HEIGHT * aspect
  const camera = new THREE.OrthographicCamera(
    -halfWidth,
    halfWidth,
    ORTHO_FRUSTUM_HALF_HEIGHT,
    -ORTHO_FRUSTUM_HALF_HEIGHT,
    ORTHO_NEAR_PLANE,
    ORTHO_FAR_PLANE
  )
  camera.position.set(0, 0, ORTHO_CAMERA_DISTANCE)
  camera.lookAt(0, 0, 0)
  return camera
}

const handleResize = (): void => {
  if (!rendererReference || !orthoCamera) return
  const width = window.innerWidth
  const height = window.innerHeight
  rendererReference.setSize(width, height)
  const aspect = width / height
  const halfWidth = ORTHO_FRUSTUM_HALF_HEIGHT * aspect
  orthoCamera.left = -halfWidth
  orthoCamera.right = halfWidth
  orthoCamera.updateProjectionMatrix()
}

let initInstance: () => void

onMounted(() => {
  setViewPanels({ showConfig: true })
  registerViewConfig(route.name as string, reactiveConfig as never, CONFIG_SCHEMA, rebuildMaterials)

  initInstance = () => {
    init(canvas.value as unknown as HTMLCanvasElement, statsElement.value as unknown as HTMLElement)
  }
  initInstance()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  clearViewPanels()
  unregisterViewConfig(route.name as string)
  clearSceneElements()
  window.removeEventListener('resize', handleResize)
  if (orbitControls) orbitControls.dispose()
  Object.values(textures).forEach((texture) => texture.dispose())
  if (envMap) envMap.dispose()
  sphereMeshes = []
})

const init = async (canvasElement: HTMLCanvasElement, statsElementNode: HTMLElement) => {
  stats.init(route, statsElementNode)

  const createScene = async () => {
    loadTextures()

    const { setup, renderer, scene } = await getTools({
      canvas: canvasElement,
      resize: false
    })

    rendererReference = renderer
    envMap = createEnvironmentMap(renderer)

    orthoCamera = createOrthographicCamera()
    orbitControls = new OrbitControls(orthoCamera, renderer.domElement)
    orbitControls.enableRotate = false
    orbitControls.target.set(0, 0, 0)
    orbitControls.update()

    await setup({
      config: {
        scene: { backgroundColor: SCENE_BG_COLOR },
        orbit: false,
        ground: false,
        lights: {
          ambient: { intensity: AMBIENT_LIGHT_INTENSITY },
          directional: {
            intensity: LIGHT_INTENSITY,
            position: [LIGHT_ORBIT_RADIUS, LIGHT_ORBIT_RADIUS, LIGHT_Z_POSITION] as [
              number,
              number,
              number
            ]
          },
          hemisphere: {
            colors: [HEMISPHERE_SKY, HEMISPHERE_GROUND]
          }
        }
      },
      defineSetup: async () => {
        const groundGeometry = new THREE.PlaneGeometry(GROUND_WIDTH, GROUND_DEPTH)
        const groundMaterial = new THREE.MeshStandardMaterial({
          color: GROUND_COLOR,
          roughness: 1,
          metalness: 0
        })
        const ground = new THREE.Mesh(groundGeometry, groundMaterial)
        ground.rotation.x = GROUND_ROTATION_X
        ground.position.set(0, GROUND_BACKGROUND_Y, GROUND_BACKGROUND_Z)
        ground.receiveShadow = true
        scene.add(ground)

        const wavePositions = createWavePath(scene)
        const specialPositions = createSpecialColumn()
        createSpheres(scene, wavePositions, specialPositions)
        createLegend(scene)

        directionalLightReference =
          scene.children.find(
            (child): child is THREE.DirectionalLight => child instanceof THREE.DirectionalLight
          ) ?? null

        let frameCount = 0
        const timelineManager = createTimelineManager()
        timelineManager.addAction({
          name: 'Light orbit',
          category: 'animation',
          action: () => {
            if (directionalLightReference) {
              const angle = (frameCount * LIGHT_ORBIT_SPEED) / TARGET_FPS
              directionalLightReference.position.set(
                Math.sin(angle) * LIGHT_ORBIT_RADIUS,
                Math.cos(angle) * LIGHT_ORBIT_RADIUS,
                LIGHT_Z_POSITION
              )
            }
          }
        })
        timelineManager.addAction({
          name: 'Render',
          category: 'render',
          action: () => {
            orbitControls?.update()
            if (orthoCamera) renderer.render(scene, orthoCamera)
          }
        })

        const animateLoop = (): void => {
          requestAnimationFrame(animateLoop)
          animateTimeline(timelineManager, frameCount++)
        }
        animateLoop()
      }
    })

    registerSceneElements(orthoCamera, [...sphereMeshes])
  }

  createScene()
}
</script>

<template>
  <div ref="statsElement"></div>
  <canvas ref="canvas"></canvas>
</template>
