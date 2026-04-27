<script setup lang="ts">
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { stats } from '@/utils/stats'
import { getTools, createTextSprite } from '@webgamekit/threejs'
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
  MATERIAL_FEATURES,
  SPHERE_SEGMENT_COUNT,
  TEXT_COLOR_LABEL,
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
  CLEARCOAT_ROUGHNESS_VALUE,
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
  LIGHT_INTENSITY,
  HEMISPHERE_SKY,
  HEMISPHERE_GROUND,
  MATERIAL_COLOR,
  ENV_LIGHT_COLOR,
  ORTHO_NEAR_PLANE,
  ORTHO_FAR_PLANE,
  ORTHO_FRUSTUM_HALF_HEIGHT,
  ORTHO_CAMERA_DISTANCE,
  LABEL_FONT_SIZE,
  PROPERTIES_FONT_SIZE,
  LABEL_SPRITE_SCALE_Y,
  TARGET_FPS,
  AMBIENT_LIGHT_INTENSITY,
  BRICK_WIDTH,
  BRICK_HEIGHT,
  MORTAR_SIZE,
  MORTAR_EDGE_OFFSET,
  DEFAULT_CONFIG,
  CONFIG_SCHEMA,
  getEnabledMaps,
  SHOWCASE_SPHERE_RADIUS,
  SHOWCASE_TITLE_Y,
  SHOWCASE_ATTR_SCALE_Y,
  SHOWCASE_ATTRS_X,
  SHOWCASE_ATTRS_Y,
  SHOWCASE_ATTR_CANVAS_WIDTH,
  ATTR_COLOR_DISABLED,
  TEXT_COLOR_COMMENT,
  ALL_ATTRIBUTES,
  ATTRIBUTE_DESCRIPTIONS,
  MATERIAL_ATTRIBUTE_SUPPORT,
  SPHERE_DRAG_SENSITIVITY,
  SHOWCASE_LEGEND_SWATCH_Y,
  SHOWCASE_LEGEND_LABEL_Y,
  SHOWCASE_LEGEND_SWATCH_SPACING,
  SHOWCASE_LEGEND_CENTER_X,
  TEXTURE_LEGEND_ENTRIES,
  LEGEND_SWATCH_SIZE,
  LEGEND_FONT_SIZE_LABEL,
  LEGEND_SCALE_LABEL,
  LEGEND_LABEL_CANVAS_WIDTH,
  TEXT_COLOR_DESCRIPTION
} from './materialsListConfig'

const statsElement = ref(null)
const canvas = ref(null)
const route = useRoute()
const { registerSceneElements, clearSceneElements } = useDebugSceneStore()
const { setViewPanels, clearViewPanels } = useViewPanelsStore()

let showcaseSphere: THREE.Mesh | null = null
let titleSpriteReference: THREE.Sprite | null = null
let attributeBlockReference: THREE.Sprite | null = null
let sceneReference: THREE.Scene | null = null
let canvasElementReference: HTMLCanvasElement | null = null
const legendMeshes: THREE.Mesh[] = []
const legendSprites: THREE.Sprite[] = []
let isDragging = false
let hasDragged = false
let dragLastX = 0
let dragLastY = 0
const currentMaterialIndex = ref(0)
const showMenu = ref(false)
const menuScreenX = ref(0)
const menuScreenY = ref(0)

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
          : brickX > BRICK_WIDTH - MORTAR_EDGE_OFFSET
            ? raisedValue
            : neutralGray
      const normalY =
        brickY < MORTAR_SIZE + MORTAR_EDGE_OFFSET
          ? depressedValue
          : brickY > BRICK_HEIGHT - MORTAR_EDGE_OFFSET
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
    parameters.clearcoat = configValues.properties.clearcoat
    parameters.clearcoatRoughness = CLEARCOAT_ROUGHNESS_VALUE
    parameters.transmission = configValues.properties.transmission
  }
  if (typeName === 'MeshPhongMaterial') {
    parameters.shininess = configValues.properties.shininess
  }
  if (typeName === 'MeshNormalMaterial') {
    parameters.flatShading = configValues.properties.flatShading
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

const buildShowcaseMaterial = (): THREE.Material => {
  const typeName = MATERIAL_TYPES[currentMaterialIndex.value]
  return buildMaterial(
    typeName,
    MATERIAL_FEATURES[typeName],
    getEnabledMaps(reactiveConfig.value),
    reactiveConfig.value
  )
}

const rebuildMaterials = (): void => {
  if (!showcaseSphere) return
  const oldMaterial = showcaseSphere.material as THREE.Material
  showcaseSphere.material = buildShowcaseMaterial()
  oldMaterial.dispose()
}

const removeSprite = (scene: THREE.Scene, sprite: THREE.Sprite | null): void => {
  if (!sprite) return
  scene.remove(sprite)
  ;(sprite.material as THREE.SpriteMaterial).map?.dispose()
  sprite.material.dispose()
}

const buildAttributeBlock = (scene: THREE.Scene, typeName: MaterialTypeName): THREE.Sprite => {
  const supported = MATERIAL_ATTRIBUTE_SUPPORT[typeName]
  const maxDisplayLength = Math.max(...ALL_ATTRIBUTES.map((a) => a.display.length))
  const attributeLines = ALL_ATTRIBUTES.map(
    (a) => `  ${a.display.padEnd(maxDisplayLength)} // ${ATTRIBUTE_DESCRIPTIONS[a.key]}`
  )
  const lines = ['{', ...attributeLines, '}']
  const lineColors: (string | undefined)[] = [
    undefined,
    ...ALL_ATTRIBUTES.map((a) => (supported.includes(a.key) ? undefined : ATTR_COLOR_DISABLED)),
    undefined
  ]
  const sprite = createTextSprite({
    text: lines.join('\n'),
    fontSize: PROPERTIES_FONT_SIZE,
    color: TEXT_COLOR_PROPERTIES,
    valueColor: TEXT_COLOR_VALUE,
    fontFamily: 'monospace',
    align: 'left',
    centerBlock: true,
    canvasWidth: SHOWCASE_ATTR_CANVAS_WIDTH,
    autoAspect: true,
    scaleY: SHOWCASE_ATTR_SCALE_Y,
    commentColor: TEXT_COLOR_COMMENT,
    lineColors
  })
  sprite.position.set(SHOWCASE_ATTRS_X, SHOWCASE_ATTRS_Y, 0)
  scene.add(sprite)
  return sprite
}

const selectMaterial = (typeName: MaterialTypeName): void => {
  currentMaterialIndex.value = MATERIAL_TYPES.indexOf(typeName)
  showMenu.value = false
  if (sceneReference) updateShowcase(sceneReference)
}

const buildTextureLegend = (scene: THREE.Scene): void => {
  const entryCount = TEXTURE_LEGEND_ENTRIES.length
  TEXTURE_LEGEND_ENTRIES.forEach(({ key, label }, index) => {
    const texture = textures[key]
    if (!texture) return
    const positionX =
      SHOWCASE_LEGEND_CENTER_X + (index - (entryCount - 1) / 2) * SHOWCASE_LEGEND_SWATCH_SPACING

    const geometry = new THREE.PlaneGeometry(LEGEND_SWATCH_SIZE, LEGEND_SWATCH_SIZE)
    const swatchMaterial = new THREE.MeshBasicMaterial({ map: texture })
    const mesh = new THREE.Mesh(geometry, swatchMaterial)
    mesh.position.set(positionX, SHOWCASE_LEGEND_SWATCH_Y, 0)
    scene.add(mesh)
    legendMeshes.push(mesh)

    const sprite = createTextSprite({
      text: label,
      fontSize: LEGEND_FONT_SIZE_LABEL,
      color: TEXT_COLOR_DESCRIPTION,
      canvasWidth: LEGEND_LABEL_CANVAS_WIDTH,
      autoAspect: true,
      scaleY: LEGEND_SCALE_LABEL
    })
    sprite.position.set(positionX, SHOWCASE_LEGEND_LABEL_Y, 0)
    scene.add(sprite)
    legendSprites.push(sprite)
  })
}

const updateShowcase = (scene: THREE.Scene): void => {
  const typeName = MATERIAL_TYPES[currentMaterialIndex.value]

  if (showcaseSphere) {
    const oldMaterial = showcaseSphere.material as THREE.Material
    showcaseSphere.material = buildShowcaseMaterial()
    oldMaterial.dispose()
  }

  removeSprite(scene, titleSpriteReference)
  titleSpriteReference = createTextSprite({
    text: `${MATERIAL_LABELS[typeName]}    ▾`,
    fontSize: LABEL_FONT_SIZE,
    color: TEXT_COLOR_LABEL,
    fontStyle: 'bold',
    canvasWidth: 512,
    scaleY: LABEL_SPRITE_SCALE_Y,
    autoAspect: true
  })
  titleSpriteReference.position.set(0, SHOWCASE_TITLE_Y, 0)
  scene.add(titleSpriteReference)

  removeSprite(scene, attributeBlockReference)
  attributeBlockReference = buildAttributeBlock(scene, typeName)
}

const getNdcFromEvent = (event: MouseEvent, rect: DOMRect): THREE.Vector2 => {
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  const y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  return new THREE.Vector2(x, y)
}

const handleCanvasMouseDown = (event: MouseEvent): void => {
  if (!orthoCamera || !showcaseSphere || !canvasElementReference) return
  const rect = canvasElementReference.getBoundingClientRect()
  const raycaster = new THREE.Raycaster()
  raycaster.setFromCamera(getNdcFromEvent(event, rect), orthoCamera)
  if (raycaster.intersectObject(showcaseSphere).length > 0) {
    isDragging = true
    hasDragged = false
    dragLastX = event.clientX
    dragLastY = event.clientY
    canvasElementReference.style.cursor = 'grabbing'
  }
}

const handleCanvasMouseUp = (): void => {
  isDragging = false
  if (canvasElementReference) canvasElementReference.style.cursor = 'default'
}

const handleCanvasClick = (event: MouseEvent): void => {
  if (!orthoCamera || !showcaseSphere || !sceneReference || !canvasElementReference) return
  if (hasDragged) {
    hasDragged = false
    return
  }

  const rect = canvasElementReference.getBoundingClientRect()
  const ndc = getNdcFromEvent(event, rect)
  const raycaster = new THREE.Raycaster()
  raycaster.setFromCamera(ndc, orthoCamera)

  if (titleSpriteReference && raycaster.intersectObject(titleSpriteReference).length > 0) {
    if (!showMenu.value) {
      const spritePos = titleSpriteReference.position.clone().project(orthoCamera)
      menuScreenX.value = ((spritePos.x + 1) / 2) * window.innerWidth
      menuScreenY.value = ((1 - spritePos.y) / 2) * window.innerHeight
    }
    showMenu.value = !showMenu.value
    return
  }

  if (raycaster.intersectObject(showcaseSphere).length > 0) {
    currentMaterialIndex.value = (currentMaterialIndex.value + 1) % MATERIAL_TYPES.length
    updateShowcase(sceneReference)
  }
}

const handleCanvasMouseMove = (event: MouseEvent): void => {
  if (!orthoCamera || !showcaseSphere || !canvasElementReference) return

  if (isDragging) {
    const deltaX = event.clientX - dragLastX
    const deltaY = event.clientY - dragLastY
    showcaseSphere.rotation.y += deltaX * SPHERE_DRAG_SENSITIVITY
    showcaseSphere.rotation.x += deltaY * SPHERE_DRAG_SENSITIVITY
    dragLastX = event.clientX
    dragLastY = event.clientY
    hasDragged = true
    return
  }

  const rect = canvasElementReference.getBoundingClientRect()
  const ndc = getNdcFromEvent(event, rect)
  const raycaster = new THREE.Raycaster()
  raycaster.setFromCamera(ndc, orthoCamera)
  const hitsTitle = titleSpriteReference
    ? raycaster.intersectObject(titleSpriteReference).length > 0
    : false
  const hitsSphere = raycaster.intersectObject(showcaseSphere).length > 0
  canvasElementReference.style.cursor = hitsTitle || hitsSphere ? 'pointer' : 'default'
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

onMounted(() => {
  setViewPanels({ showConfig: true })
  registerViewConfig(route.name as string, reactiveConfig as never, CONFIG_SCHEMA, rebuildMaterials)
  init(canvas.value as unknown as HTMLCanvasElement, statsElement.value as unknown as HTMLElement)
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  clearViewPanels()
  unregisterViewConfig(route.name as string)
  clearSceneElements()
  window.removeEventListener('resize', handleResize)
  if (canvasElementReference) {
    canvasElementReference.removeEventListener('click', handleCanvasClick)
    canvasElementReference.removeEventListener('mousemove', handleCanvasMouseMove)
    canvasElementReference.removeEventListener('mousedown', handleCanvasMouseDown)
    canvasElementReference.removeEventListener('mouseup', handleCanvasMouseUp)
  }
  if (orbitControls) orbitControls.dispose()
  legendMeshes.forEach((mesh) => {
    sceneReference?.remove(mesh)
    mesh.geometry.dispose()
    ;(mesh.material as THREE.MeshBasicMaterial).dispose()
  })
  legendSprites.forEach((sprite) => {
    sceneReference?.remove(sprite)
    ;(sprite.material as THREE.SpriteMaterial).map?.dispose()
    sprite.material.dispose()
  })
  Object.values(textures).forEach((texture) => texture.dispose())
  if (envMap) envMap.dispose()
  showcaseSphere = null
  titleSpriteReference = null
  attributeBlockReference = null
  sceneReference = null
  canvasElementReference = null
})

const init = async (canvasElement: HTMLCanvasElement, statsElementNode: HTMLElement) => {
  stats.init(route, statsElementNode)
  canvasElementReference = canvasElement

  loadTextures()

  const { setup, renderer, scene } = await getTools({ canvas: canvasElement, resize: false })
  sceneReference = scene
  rendererReference = renderer
  envMap = createEnvironmentMap(renderer)

  orthoCamera = createOrthographicCamera()
  orbitControls = new OrbitControls(orthoCamera, renderer.domElement)
  orbitControls.enableRotate = false
  orbitControls.target.set(0, 0, 0)
  orbitControls.update()

  canvasElement.addEventListener('click', handleCanvasClick)
  canvasElement.addEventListener('mousemove', handleCanvasMouseMove)
  canvasElement.addEventListener('mousedown', handleCanvasMouseDown)
  canvasElement.addEventListener('mouseup', handleCanvasMouseUp)

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
        hemisphere: { colors: [HEMISPHERE_SKY, HEMISPHERE_GROUND] }
      }
    },
    defineSetup: async () => {
      const geometry = new THREE.SphereGeometry(
        SHOWCASE_SPHERE_RADIUS,
        SPHERE_SEGMENT_COUNT,
        SPHERE_SEGMENT_COUNT
      )
      geometry.setAttribute('uv2', geometry.attributes['uv'])
      showcaseSphere = new THREE.Mesh(geometry, buildShowcaseMaterial())
      showcaseSphere.castShadow = true
      showcaseSphere.receiveShadow = true
      scene.add(showcaseSphere)

      updateShowcase(scene)
      buildTextureLegend(scene)

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

      if (orthoCamera) registerSceneElements(orthoCamera, showcaseSphere ? [showcaseSphere] : [])
    }
  })
}
</script>

<template>
  <div ref="statsElement"></div>
  <canvas ref="canvas"></canvas>
  <nav v-if="showMenu" class="materials-list__menu">
    <section class="materials-list__group">
      <h3 class="materials-list__group-title">Materials</h3>
      <button
        v-for="type in MAIN_MATERIAL_TYPES"
        :key="type"
        class="materials-list__btn"
        :class="{ 'materials-list__btn--active': MATERIAL_TYPES[currentMaterialIndex] === type }"
        @click="selectMaterial(type)"
      >
        {{ MATERIAL_LABELS[type] }}
      </button>
    </section>
    <section class="materials-list__group">
      <h3 class="materials-list__group-title">Debug Materials</h3>
      <button
        v-for="type in SPECIAL_MATERIAL_TYPES"
        :key="type"
        class="materials-list__btn"
        :class="{ 'materials-list__btn--active': MATERIAL_TYPES[currentMaterialIndex] === type }"
        @click="selectMaterial(type)"
      >
        {{ MATERIAL_LABELS[type] }}
      </button>
    </section>
  </nav>
</template>

<style scoped>
.materials-list__menu {
  position: fixed;
  top: v-bind('menuScreenY + "px"');
  left: v-bind('menuScreenX + "px"');
  transform: translateX(0);
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1rem 0.75rem;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm, 4px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  z-index: 10;
}

.materials-list__group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.materials-list__group-title {
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-muted-foreground);
  margin-bottom: 0.35rem;
}

.materials-list__btn {
  padding: 0.3rem 0.75rem;
  font-size: 0.8rem;
  text-align: left;
  border-radius: var(--radius-sm, 4px);
  border: 1px solid transparent;
  background: transparent;
  color: var(--color-muted-foreground);
  cursor: pointer;
  transition:
    color 0.15s,
    background 0.15s,
    border-color 0.15s;
}

.materials-list__btn:hover {
  color: var(--color-foreground);
  background: var(--color-muted);
}

.materials-list__btn--active {
  color: var(--color-foreground);
  background: var(--color-secondary);
  border-color: var(--color-border);
}
</style>
