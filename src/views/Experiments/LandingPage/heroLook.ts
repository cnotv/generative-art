import * as THREE from 'three'
import { useElementPropertiesStore } from '@/stores/elementProperties'
import type { ElementPropertiesConfig } from '@/stores/elementProperties'
import { useDebugSceneStore } from '@/stores/debugScene'
import { registerLightProperties } from '@/utils/lightProperties'
import { aimSpot, setPaper } from './introScene'
import { SLEEP_AMBIENT_INTENSITY, SLEEP_DIRECTIONAL_INTENSITY } from './config'
import type { HeroLook, HeroLookParts } from './types'

const OFF_POSITION = [0, 1, 0] as const

/**
 * Drives the hero's finish: puts a look on every light and surface, and brings the lights
 * up from the sleeping room to that look's levels.
 * @param parts Everything a look changes.
 * @param getLook The look currently chosen.
 * @returns `apply` to switch to a look live, and `setLightLevels` for the intro, from 0 asleep to
 *   1 awake.
 */
export const createHeroLook = (parts: HeroLookParts, getLook: () => HeroLook) => {
  let lightProgress = 0

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
    parts.backLight.intensity = (look.back?.intensity ?? 0) * progress
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
    setPaper(parts.logoMaterial, look.paper ? parts.logoPaper : null)
    parts.emboss.value = look.embossStrength

    parts.keyLight.color.set(look.key.color)
    parts.keyLight.position.set(...look.key.position)
    parts.keyLight.shadow.radius = look.shadowRadius
    parts.backLight.color.set(look.back?.color ?? 0xffffff)
    parts.backLight.position.set(...(look.back?.position ?? OFF_POSITION))
    parts.backLight.shadow.radius = look.shadowRadius

    parts.spot.color.set(look.spot.color)
    parts.spot.intensity = look.spot.intensity
    parts.spot.angle = look.spot.angle
    parts.spot.penumbra = look.spot.penumbra
    parts.spot.shadow.radius = look.shadowRadius
    aimSpot(parts.spot, parts.spot.target.position.clone(), look.spot)

    setLightLevels(lightProgress)
  }

  return { apply, setLightLevels }
}

const materialSchema = {
  color: { color: true, label: 'Color' },
  metalness: { min: 0, max: 1, step: 0.01, label: 'Metalness' },
  roughness: { min: 0, max: 1, step: 0.01, label: 'Roughness' }
}

const createMaterialConfig = (
  material: THREE.MeshStandardMaterial,
  title: string
): ElementPropertiesConfig => ({
  title,
  schema: materialSchema,
  getValue: (path) => {
    if (path === 'color') return material.color.getHex()
    if (path === 'metalness') return material.metalness
    if (path === 'roughness') return material.roughness
    return undefined
  },
  updateValue: (path, value) => {
    if (path === 'color') material.color.set(value as number)
    if (path === 'metalness') material.metalness = value as number
    if (path === 'roughness') material.roughness = value as number
  }
})

const createLogoConfig = (parts: HeroLookParts, title: string): ElementPropertiesConfig => {
  const material = createMaterialConfig(parts.logoMaterial, title)
  return {
    title,
    schema: {
      ...materialSchema,
      emboss: { min: 0, max: 2, step: 0.05, label: 'Emboss' },
      rim: { min: 0, max: 1, step: 0.01, label: 'Rim glow' },
      paper: { boolean: true, label: 'Paper' }
    },
    getValue: (path) => {
      if (path === 'emboss') return parts.emboss.value
      if (path === 'rim') return parts.rim.value
      if (path === 'paper') return parts.logoMaterial.map !== null
      return material.getValue(path)
    },
    updateValue: (path, value) => {
      if (path === 'emboss') parts.emboss.value = value as number
      else if (path === 'rim') parts.rim.value = value as number
      else if (path === 'paper') setPaper(parts.logoMaterial, value ? parts.logoPaper : null)
      else material.updateValue(path, value)
    }
  }
}

const spotSchema = {
  intensity: { min: 0, max: 1000, step: 10, label: 'Intensity' },
  color: { color: true, label: 'Color' },
  angle: { min: 0.1, max: 1.2, step: 0.01, label: 'Beam angle' },
  penumbra: { min: 0, max: 1, step: 0.05, label: 'Edge softness' }
}

const backSchema = {
  intensity: { min: 0, max: 5, step: 0.1, label: 'Intensity' },
  color: { color: true, label: 'Color' }
}

// Reads the light itself rather than a copy, so after a look switch the panel shows the new values.
const createLightConfig = (
  light: THREE.SpotLight | THREE.DirectionalLight,
  title: string,
  schema: Record<string, unknown>
): ElementPropertiesConfig => ({
  title,
  schema,
  getValue: (path) => (path === 'color' ? light.color.getHex() : Reflect.get(light, path)),
  updateValue: (path, value) => {
    if (path === 'color') light.color.set(value as number)
    else Reflect.set(light, path, value)
  }
})

// Each element the looks change, with its panel. Registered again after every switch, so the
// panel shows the new look's values.
const getLookElements = (parts: HeroLookParts): [string, string, ElementPropertiesConfig][] => [
  ['logo', 'Group', createLogoConfig(parts, 'Logo')],
  ['cnotv-text', 'Group', createLogoConfig(parts, 'CNOTV Text')],
  ['room-wall', 'Mesh', createMaterialConfig(parts.wallMaterial, 'Wall')],
  ['room-floor', 'Mesh', createMaterialConfig(parts.floorMaterial, 'Floor')],
  ['corner-spot', 'SpotLight', createLightConfig(parts.spot, 'Spot Light', spotSchema)],
  ['back-light', 'DirectionalLight', createLightConfig(parts.backLight, 'Back Light', backSchema)]
]

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
  registerLightProperties({
    light: parts.ambientLight,
    name: 'ambient-light',
    title: 'Ambient Light'
  })
  registerLightProperties({
    light: parts.keyLight,
    name: 'directional-light',
    title: 'Directional Light'
  })
}
