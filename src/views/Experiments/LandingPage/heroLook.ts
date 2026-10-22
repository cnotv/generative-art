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
  REFLECTION_SWAY_SPEED,
  HERO_LOOK_TRANSITION_SECONDS
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
  // Mipmaps are the shrunken copies of each frame that the reflection blur reads from.
  texture.generateMipmaps = true
  texture.minFilter = THREE.LinearMipmapLinearFilter
  return { video, texture }
}

const mixNumber = (from: number, to: number, share: number): number => from + (to - from) * share
const fromColor = new THREE.Color()
const toColor = new THREE.Color()
const mixColor = (from: number, to: number, share: number): number =>
  fromColor.setHex(from).lerp(toColor.setHex(to), share).getHex()
const mixPosition = (
  from: readonly [number, number, number],
  to: readonly [number, number, number],
  share: number
): [number, number, number] => [
  mixNumber(from[0], to[0], share),
  mixNumber(from[1], to[1], share),
  mixNumber(from[2], to[2], share)
]

/**
 * A look part of the way from one preset to another. Numbers, colours and positions blend; what
 * cannot blend, the paper and the ink text, switches halfway.
 * @param from The look being left.
 * @param to The look being reached.
 * @param share How far along, from 0 at `from` to 1 at `to`.
 * @returns The look in between.
 */
export const mixLooks = (from: HeroLook, to: HeroLook, share: number): HeroLook => {
  const halfway = share >= 0.5 ? to : from
  return {
    label: halfway.label,
    wallColor: mixColor(from.wallColor, to.wallColor, share),
    floorColor: mixColor(from.floorColor, to.floorColor, share),
    logoColor: mixColor(from.logoColor, to.logoColor, share),
    logoRoughness: mixNumber(from.logoRoughness, to.logoRoughness, share),
    logoMetalness: mixNumber(from.logoMetalness, to.logoMetalness, share),
    paper: halfway.paper,
    embossStrength: mixNumber(from.embossStrength, to.embossStrength, share),
    rimStrength: mixNumber(from.rimStrength, to.rimStrength, share),
    ambientIntensity: mixNumber(from.ambientIntensity, to.ambientIntensity, share),
    key: {
      color: mixColor(from.key.color, to.key.color, share),
      intensity: mixNumber(from.key.intensity, to.key.intensity, share),
      position: mixPosition(from.key.position, to.key.position, share)
    },
    spot: {
      color: mixColor(from.spot.color, to.spot.color, share),
      intensity: mixNumber(from.spot.intensity, to.spot.intensity, share),
      side: mixNumber(from.spot.side, to.spot.side, share),
      height: mixNumber(from.spot.height, to.spot.height, share),
      forward: mixNumber(from.spot.forward, to.spot.forward, share),
      angle: mixNumber(from.spot.angle, to.spot.angle, share),
      penumbra: mixNumber(from.spot.penumbra, to.spot.penumbra, share)
    },
    shadowRadius: mixNumber(from.shadowRadius, to.shadowRadius, share),
    ink: halfway.ink,
    reflection: mixNumber(from.reflection, to.reflection, share),
    reflectionBlur: mixNumber(from.reflectionBlur, to.reflectionBlur, share)
  }
}

const spotAim = new THREE.Vector3()

interface LookTransition {
  from: HeroLook
  to: HeroLook
  startedAt: number | null
  onDone: () => void
}

/**
 * Drives the hero's finish: puts a look on every light and surface, eases from one look to the
 * next, and brings the lights up from the sleeping room to the look's levels.
 * @param parts Everything a look changes.
 * @param initial The look to start with.
 * @returns `transitionTo` to ease to another look, `setLightLevels` for the intro, from 0 asleep
 *   to 1 awake, `update` for each frame and `dispose`.
 */
export const createHeroLook = (parts: HeroLookParts, initial: HeroLook) => {
  let lightProgress = 0
  let reflection: VideoReflection | null = null
  let shown = initial
  let paperShown: boolean | null = null
  let transition: LookTransition | null = null

  const setLightLevels = (progress: number): void => {
    lightProgress = progress
    parts.ambientLight.intensity = THREE.MathUtils.lerp(
      SLEEP_AMBIENT_INTENSITY,
      shown.ambientIntensity,
      progress
    )
    parts.keyLight.intensity = THREE.MathUtils.lerp(
      SLEEP_DIRECTIONAL_INTENSITY,
      shown.key.intensity,
      progress
    )
    parts.rim.value = shown.rimStrength * progress
  }

  // Swapping a texture recompiles the materials, so the paper changes only when it switches.
  const showPaper = (paper: boolean): void => {
    if (paper === paperShown) return
    paperShown = paper
    setPaper(parts.wallMaterial, paper ? parts.roomPaper : null)
    setPaper(parts.floorMaterial, paper ? parts.roomPaper : null)
    setPaper(parts.logoMaterial, paper ? parts.logoPaper : null)
  }

  const showReflection = (strength: number): void => {
    if (strength > 0) {
      reflection = reflection ?? createVideoReflection()
      if (reflection.video.paused) reflection.video.play().catch(() => undefined)
      parts.reflectionMap.value = reflection.texture
    } else {
      reflection?.video.pause()
    }
  }

  const show = (look: HeroLook): void => {
    shown = look
    parts.wallMaterial.color.set(look.wallColor)
    parts.floorMaterial.color.set(look.floorColor)
    showPaper(look.paper)

    parts.logoMaterial.color.set(look.logoColor)
    parts.logoMaterial.roughness = look.logoRoughness
    parts.logoMaterial.metalness = look.logoMetalness
    showReflection(look.reflection)
    parts.reflection.value = look.reflection
    parts.reflectionBlur.value = look.reflectionBlur
    parts.emboss.value = look.embossStrength

    parts.keyLight.color.set(look.key.color)
    parts.keyLight.position.set(...look.key.position)
    parts.keyLight.shadow.radius = look.shadowRadius

    parts.spot.color.set(look.spot.color)
    parts.spot.intensity = look.spot.intensity
    parts.spot.angle = look.spot.angle
    parts.spot.penumbra = look.spot.penumbra
    parts.spot.shadow.radius = look.shadowRadius
    aimSpot(parts.spot, spotAim.copy(parts.spot.target.position), look.spot)

    setLightLevels(lightProgress)
  }

  /**
   * Eases from the look on show to another over a moment; a new call takes over from wherever
   * the current one has reached.
   * @param look The look to reach.
   * @param onDone Called once it is reached.
   */
  const transitionTo = (look: HeroLook, onDone: () => void = () => undefined): void => {
    transition = { from: shown, to: look, startedAt: null, onDone }
  }

  // Called every frame: advances a transition, and sways the reflection slowly, as if the logo
  // caught a moving view.
  const update = (seconds: number): void => {
    parts.reflectionShift.value = Math.sin(seconds * REFLECTION_SWAY_SPEED) * REFLECTION_SWAY
    if (!transition) return
    const startedAt = transition.startedAt ?? seconds
    transition.startedAt = startedAt
    const share = Math.min(1, (seconds - startedAt) / HERO_LOOK_TRANSITION_SECONDS)
    show(mixLooks(transition.from, transition.to, THREE.MathUtils.smoothstep(share, 0, 1)))
    if (share < 1) return
    const { onDone } = transition
    transition = null
    onDone()
  }

  const dispose = (): void => {
    reflection?.video.pause()
    reflection?.video.removeAttribute('src')
    reflection?.texture.dispose()
  }

  show(initial)
  return { transitionTo, setLightLevels, update, dispose }
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
  reflectionBlur: { min: 0, max: 1, step: 0.01, label: 'Reflection blur' },
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

/**
 * The preset after the given one, wrapping round to the first.
 * @param current The preset showing now.
 * @param names Every preset, in order.
 * @returns The next preset's name.
 */
export const getNextLook = (current: string, names: string[]): string =>
  names[(names.indexOf(current) + 1) % names.length]
