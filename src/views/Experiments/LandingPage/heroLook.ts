import * as THREE from 'three'
import { reactive } from 'vue'
import { useElementPropertiesStore } from '@/stores/elementProperties'
import type { ElementPropertiesConfig } from '@/stores/elementProperties'
import { useDebugSceneStore } from '@/stores/debugScene'
import { useSceneViewStore } from '@/stores/sceneView'
import { aimSpot, setPaper } from './introScene'
import {
  SLEEP_AMBIENT_INTENSITY,
  SLEEP_DIRECTIONAL_INTENSITY,
  REFLECTION_VIDEO,
  REFLECTION_SWAY,
  REFLECTION_SWAY_SPEED
} from './config'
import type { HeroLook, HeroLookParts } from './types'

interface VideoReflection {
  video: HTMLVideoElement
  texture: THREE.VideoTexture
}

// The looping, muted video the mirror finish reflects. It plays only while that finish is on.
const createVideoReflection = (): VideoReflection => {
  const video = document.createElement('video')
  video.src = `${import.meta.env.BASE_URL}${REFLECTION_VIDEO}`
  video.muted = true
  video.loop = true
  video.playsInline = true
  const texture = new THREE.VideoTexture(video)
  texture.colorSpace = THREE.SRGBColorSpace
  return { video, texture }
}

/**
 * Drives the hero's finish: puts a look on every light and surface, and brings the lights
 * up from the sleeping room to that look's levels.
 * @param parts Everything a look changes.
 * @param getLook The look currently chosen.
 * @returns `apply` to switch to a look live, `setLightLevels` for the intro, from 0 asleep to 1
 *   awake, `update` for each frame and `dispose`.
 */
export const createHeroLook = (parts: HeroLookParts, getLook: () => HeroLook) => {
  let lightProgress = 0
  let reflection: VideoReflection | null = null

  const setLightLevels = (progress: number): void => {
    lightProgress = progress
    const look = getLook()
    parts.ambientLight.intensity = THREE.MathUtils.lerp(
      SLEEP_AMBIENT_INTENSITY,
      look.ambientIntensity,
      progress
    )
    parts.keyLight.intensity = THREE.MathUtils.lerp(
      SLEEP_DIRECTIONAL_INTENSITY,
      look.key.intensity,
      progress
    )
    parts.rim.value = look.rimStrength * progress
  }

  const apply = (look: HeroLook): void => {
    parts.wallMaterial.color.set(look.wallColor)
    parts.floorMaterial.color.set(look.floorColor)
    setPaper(parts.wallMaterial, look.paper ? parts.roomPaper : null)
    setPaper(parts.floorMaterial, look.paper ? parts.roomPaper : null)

    parts.logoMaterial.color.set(look.logoColor)
    parts.logoMaterial.roughness = look.logoRoughness
    parts.logoMaterial.metalness = look.logoMetalness
    if (look.reflection > 0) {
      reflection = reflection ?? createVideoReflection()
      reflection.video.play().catch(() => undefined)
      parts.reflectionMap.value = reflection.texture
    } else {
      reflection?.video.pause()
    }
    parts.reflection.value = look.reflection
    parts.reflectionBlur.value = look.reflectionBlur
    setPaper(parts.logoMaterial, look.paper ? parts.logoPaper : null)
    parts.emboss.value = look.embossStrength

    parts.keyLight.color.set(look.key.color)
    parts.keyLight.position.set(...look.key.position)
    parts.keyLight.shadow.radius = look.shadowRadius

    parts.spot.color.set(look.spot.color)
    parts.spot.intensity = look.spot.intensity
    parts.spot.angle = look.spot.angle
    parts.spot.penumbra = look.spot.penumbra
    parts.spot.shadow.radius = look.shadowRadius
    aimSpot(parts.spot, parts.spot.target.position.clone(), look.spot)

    setLightLevels(lightProgress)
  }

  // Called every frame: the reflection sways slowly, as if the logo caught a moving view.
  const update = (seconds: number): void => {
    parts.reflectionShift.value = Math.sin(seconds * REFLECTION_SWAY_SPEED) * REFLECTION_SWAY
  }

  const dispose = (): void => {
    reflection?.video.pause()
    reflection?.video.removeAttribute('src')
    reflection?.texture.dispose()
  }

  return { apply, setLightLevels, update, dispose }
}

const materialSchema = {
  color: { color: true, label: 'Color' },
  metalness: { min: 0, max: 1, step: 0.01, label: 'Metalness' },
  roughness: { min: 0, max: 1, step: 0.01, label: 'Roughness' }
}

/**
 * A panel config whose controls redraw when edited. The panel redraws a control only when the
 * value it reads is reactive, and a three.js material is not, so the config keeps a reactive copy
 * of its values, read once from the scene and updated on every edit, and writes each edit through.
 * @param title The element's title in the panel.
 * @param schema The controls, by path.
 * @param read Reads a value from the scene.
 * @param write Writes an edited value to the scene.
 * @returns The config to register.
 */
export const createLiveConfig = (
  title: string,
  schema: Record<string, unknown>,
  read: (path: string) => unknown,
  write: (path: string, value: unknown) => void
): ElementPropertiesConfig => {
  const values = reactive(Object.fromEntries(Object.keys(schema).map((path) => [path, read(path)])))
  return {
    title,
    schema,
    getValue: (path) => values[path],
    updateValue: (path, value) => {
      values[path] = value
      write(path, value)
    }
  }
}

const readMaterial = (material: THREE.MeshStandardMaterial, path: string): unknown => {
  if (path === 'color') return material.color.getHex()
  if (path === 'metalness') return material.metalness
  if (path === 'roughness') return material.roughness
  return undefined
}

const writeMaterial = (
  material: THREE.MeshStandardMaterial,
  path: string,
  value: unknown
): void => {
  if (path === 'color') material.color.set(value as THREE.ColorRepresentation)
  if (path === 'metalness') material.metalness = value as number
  if (path === 'roughness') material.roughness = value as number
}

const createMaterialConfig = (
  material: THREE.MeshStandardMaterial,
  title: string
): ElementPropertiesConfig =>
  createLiveConfig(
    title,
    materialSchema,
    (path) => readMaterial(material, path),
    (path, value) => writeMaterial(material, path, value)
  )

const logoSchema = {
  ...materialSchema,
  emboss: { min: 0, max: 2, step: 0.05, label: 'Emboss' },
  rim: { min: 0, max: 1, step: 0.01, label: 'Rim glow' },
  reflection: { min: 0, max: 3, step: 0.05, label: 'Reflection' },
  reflectionBlur: { min: 0, max: 0.08, step: 0.002, label: 'Reflection blur' },
  paper: { boolean: true, label: 'Paper' }
}

// The logo and the letters share one material, so they share one config and always agree.
const createLogoConfig = (parts: HeroLookParts): ElementPropertiesConfig =>
  createLiveConfig(
    'Logo and CNOTV text',
    logoSchema,
    (path) => {
      if (path === 'emboss') return parts.emboss.value
      if (path === 'rim') return parts.rim.value
      if (path === 'reflection') return parts.reflection.value
      if (path === 'reflectionBlur') return parts.reflectionBlur.value
      if (path === 'paper') return parts.logoMaterial.map !== null
      return readMaterial(parts.logoMaterial, path)
    },
    (path, value) => {
      if (path === 'emboss') parts.emboss.value = value as number
      else if (path === 'rim') parts.rim.value = value as number
      else if (path === 'reflection') parts.reflection.value = value as number
      else if (path === 'reflectionBlur') parts.reflectionBlur.value = value as number
      else if (path === 'paper') setPaper(parts.logoMaterial, value ? parts.logoPaper : null)
      else writeMaterial(parts.logoMaterial, path, value)
    }
  )

// Each element the looks change, with its panel. Registered again after every switch, so the
// panel shows the new look's values.
const getLookElements = (parts: HeroLookParts): [string, string, ElementPropertiesConfig][] => {
  const logo = createLogoConfig(parts)
  return [
    ['logo', 'Group', logo],
    ['cnotv-text', 'Group', logo],
    ['room-wall', 'Mesh', createMaterialConfig(parts.wallMaterial, 'Wall')],
    ['room-floor', 'Mesh', createMaterialConfig(parts.floorMaterial, 'Floor')]
  ]
}

/**
 * Lists everything a look changes in the Elements panel, with live controls: the logo and letters'
 * material, emboss, rim and paper, the wall, the floor, and every light.
 * @param parts Everything a look changes.
 */
export const registerLookElements = (parts: HeroLookParts): void => {
  const debugStore = useDebugSceneStore()
  getLookElements(parts).forEach(([name, type, config]) =>
    debugStore.addSceneElement({ name, type, hidden: false }, config)
  )
}

/**
 * Refreshes the Elements panel after a look switch, so every control shows the new values.
 * @param parts Everything a look changes.
 */
export const refreshLookElements = (parts: HeroLookParts): void => {
  const store = useElementPropertiesStore()
  getLookElements(parts).forEach(([name, , config]) =>
    store.registerElementProperties(name, config)
  )
  // The Lights panel copies the scene's lights when it adopts them; adopting again shows the new
  // look's values.
  if (parts.spot.parent instanceof THREE.Scene)
    useSceneViewStore().adoptSceneLights(parts.spot.parent)
}
