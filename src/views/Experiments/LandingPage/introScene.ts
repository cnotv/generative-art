import * as THREE from 'three'
import {
  SVG_BODY_BOUNDS,
  SVG_EYES,
  EYE_FRONT_OFFSET,
  EYE_SEGMENTS,
  EYELID_MIN_SCALE,
  EYELID_OVERLAP,
  EYE_PROBE_STEPS,
  ROOM_SIZE,
  ROOM_ROUGHNESS,
  PAPER_TEXTURE_SIZE,
  PAPER_WORLD_DENSITY,
  PAPER_TONE_RANGE,
  PAPER_FIBRE_COUNT,
  PAPER_BUMP_SCALE,
  EMBOSS_LIGHT_DIRECTION,
  RIM_LIGHT_COLOR,
  RIM_LIGHT_POWER,
  REFLECTION_SPAN,
  REFLECTION_TILT,
  REFLECTION_BLUR_TAPS
} from './config'
import type { LogoIntroPose, Room, LogoRest, SpotPlacement } from './types'

/**
 * Gives a material the cardstock's grain, fibres and tooth, or takes them away.
 * @param material The material to dress.
 * @param paper The paper texture, or null for a plain surface.
 */
export const setPaper = (
  material: THREE.MeshStandardMaterial,
  paper: THREE.Texture | null
): void => {
  material.map = paper
  material.bumpMap = paper
  material.bumpScale = PAPER_BUMP_SCALE
  material.needsUpdate = true
}

const createRoomSurface = (paper: THREE.Texture): [THREE.Mesh, THREE.MeshStandardMaterial] => {
  const material = new THREE.MeshStandardMaterial({ roughness: ROOM_ROUGHNESS })
  setPaper(material, paper)
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE), material)
  mesh.receiveShadow = true
  return [mesh, material]
}

/**
 * Builds the room: a back wall and a floor meeting along one seam, lit by the same lights as
 * the logo so it reads as sitting in the corner rather than in front of a backdrop.
 * @param scene The scene to add them to.
 * @param floorY Height of the floor.
 * @param wallZ Depth of the back wall.
 * @param paper The cardstock texture, repeated here at the same scale as on the logo.
 * @returns The room meshes and their materials, coloured later by the chosen look.
 */
export const createRoom = (
  scene: THREE.Scene,
  floorY: number,
  wallZ: number,
  paper: THREE.Texture
): Room => {
  const roomPaper = paper.clone()
  roomPaper.repeat.setScalar(ROOM_SIZE * PAPER_WORLD_DENSITY)
  const [wall, wallMaterial] = createRoomSurface(roomPaper)
  wall.name = 'room-wall'
  wall.position.set(0, floorY + ROOM_SIZE / 2, wallZ)

  const [floor, floorMaterial] = createRoomSurface(roomPaper)
  floor.name = 'room-floor'
  floor.rotation.x = -Math.PI / 2
  floor.position.set(0, floorY, wallZ + ROOM_SIZE / 2)

  scene.add(wall, floor)
  return { meshes: [wall, floor], materials: [wallMaterial, floorMaterial], paper: roomPaper }
}

/**
 * Adds the spotlight that lights the logo, its colour, strength and beam set later by the look.
 * @param scene The scene to add it to.
 * @returns The spotlight.
 */
export const createCornerSpot = (scene: THREE.Scene): THREE.SpotLight => {
  const spot = new THREE.SpotLight()
  // The Lights panel recognises its lights by name; this one joins it as the scene's spot.
  spot.name = 'spot-light'
  spot.castShadow = true
  scene.add(spot, spot.target)
  return spot
}

/**
 * Moves the spotlight to its place relative to a point, and aims it there.
 * @param spot The spotlight from createCornerSpot.
 * @param target The point to light.
 * @param placement Where the light hangs relative to that point.
 */
export const aimSpot = (
  spot: THREE.SpotLight,
  target: THREE.Vector3,
  placement: SpotPlacement
): void => {
  spot.position.set(
    target.x + placement.side,
    target.y + placement.height,
    target.z + placement.forward
  )
  spot.target.position.copy(target)
}

const svgToWorld = (box: THREE.Box3, svgX: number, svgY: number): THREE.Vector3 => {
  const { minX, maxX, minY, maxY } = SVG_BODY_BOUNDS
  return new THREE.Vector3(
    THREE.MathUtils.lerp(box.min.x, box.max.x, (svgX - minX) / (maxX - minX)),
    THREE.MathUtils.lerp(box.max.y, box.min.y, (svgY - minY) / (maxY - minY)),
    box.max.z + EYE_FRONT_OFFSET
  )
}

const holeProbe = new THREE.Raycaster()
const probeDirection = new THREE.Vector3(0, 0, -1)
const probeOrigin = new THREE.Vector3()

// The SVG artwork and the exported model do not line up exactly, so the hole is measured on the
// mesh itself: rays shot straight through the face around the expected spot, and the ones that
// pass through without touching the front surface are the hole.
const measureEyeHole = (
  model: THREE.Object3D,
  box: THREE.Box3,
  expected: THREE.Vector3,
  searchRadius: number
): { center: THREE.Vector3; radius: number } => {
  const cell = (2 * searchRadius) / EYE_PROBE_STEPS
  const frontLimit = box.max.z - (box.max.z - box.min.z) / 2
  const through = Array.from({ length: (EYE_PROBE_STEPS + 1) ** 2 }, (_, index) => {
    const x = expected.x - searchRadius + (index % (EYE_PROBE_STEPS + 1)) * cell
    const y = expected.y - searchRadius + Math.floor(index / (EYE_PROBE_STEPS + 1)) * cell
    holeProbe.set(probeOrigin.set(x, y, box.max.z + 1), probeDirection)
    const [hit] = holeProbe.intersectObject(model, true)
    return !hit || hit.point.z < frontLimit ? new THREE.Vector2(x, y) : null
  }).filter((point): point is THREE.Vector2 => point !== null)
  if (through.length === 0) return { center: expected, radius: searchRadius / 2 }
  const sum = through.reduce((total, point) => total.add(point), new THREE.Vector2())
  return {
    center: new THREE.Vector3(sum.x / through.length, sum.y / through.length, expected.z),
    radius: Math.sqrt((through.length * cell * cell) / Math.PI)
  }
}

/**
 * Covers the eye holes of the logo with lids in its own material, hinged at their top edge so
 * opening them reveals the holes.
 * @param model The logo, already scaled and placed at rest.
 * @param material The logo's material, so a closed lid reads as part of the face.
 * @returns The lid meshes, parented to the logo so they follow every turn and jump.
 */
export const createLogoEyelids = (
  model: THREE.Object3D,
  material: THREE.Material
): THREE.Mesh[] => {
  model.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(model)
  const unitsPerSvg = (box.max.x - box.min.x) / (SVG_BODY_BOUNDS.maxX - SVG_BODY_BOUNDS.minX)
  return SVG_EYES.map(({ x, y, radius }, index) => {
    const hole = measureEyeHole(model, box, svgToWorld(box, x, y), radius * unitsPerSvg * 2)
    const lidRadius = hole.radius * EYELID_OVERLAP
    const geometry = new THREE.CircleGeometry(lidRadius, EYE_SEGMENTS).translate(0, -lidRadius, 0)
    const eyelid = new THREE.Mesh(geometry, material)
    eyelid.name = `logo-eyelid-${index}`
    eyelid.position.copy(hole.center).setY(hole.center.y + lidRadius)
    model.attach(eyelid)
    return eyelid
  })
}

/**
 * Raises or lowers the lids.
 * @param eyelids The meshes from createLogoEyelids.
 * @param openness 0 closed, 1 fully open.
 */
export const setEyelidsOpen = (eyelids: THREE.Mesh[], openness: number): void => {
  eyelids.forEach((eyelid) => eyelid.scale.setY(Math.max(EYELID_MIN_SCALE, 1 - openness)))
}

const tiltAxis = new THREE.Vector3(0, 0, 1)
const yawAxis = new THREE.Vector3(0, 1, 0)
const scratchYaw = new THREE.Quaternion()
const scratchOffset = new THREE.Vector3()

/**
 * Places the logo in a pose, turning and leaning it around the centre of its base so its feet
 * stay planted.
 * @param model The logo.
 * @param pose The pose from the intro timeline.
 * @param rest The offset from its feet to its origin at rest.
 */
export const applyLogoPose = (model: THREE.Object3D, pose: LogoIntroPose, rest: LogoRest) => {
  scratchYaw.setFromAxisAngle(yawAxis, pose.yaw)
  model.quaternion.setFromAxisAngle(tiltAxis, pose.tilt).multiply(scratchYaw)
  scratchOffset.copy(rest.feetOffset).applyQuaternion(model.quaternion)
  model.position.set(...pose.feet).add(scratchOffset)
}

const TILE_OFFSETS = [-1, 0, 1].flatMap((x) => [-1, 0, 1].map((y) => [x, y] as const))

// A fibre drawn nine times, once per neighbouring tile, so it wraps across the texture's edges
// and the paper repeats without seams.
const drawFibre = (context: CanvasRenderingContext2D, size: number): void => {
  const [x, y] = [Math.random() * size, Math.random() * size]
  const angle = Math.random() * Math.PI
  const length = 4 + Math.random() * 14
  const [dx, dy] = [Math.cos(angle) * length, Math.sin(angle) * length]
  context.strokeStyle = Math.random() < 0.5 ? 'rgb(255 255 255 / 22%)' : 'rgb(0 0 0 / 14%)'
  context.lineWidth = 0.6 + Math.random() * 0.6
  TILE_OFFSETS.forEach(([offsetX, offsetY]) => {
    context.beginPath()
    context.moveTo(x + offsetX * size, y + offsetY * size)
    context.lineTo(x + offsetX * size + dx, y + offsetY * size + dy)
    context.stroke()
  })
}

/**
 * A tileable cardstock texture: a fine, light grain with short pressed fibres running every way.
 * Used both as the colour, which it only darkens slightly, and as the bump, so light catches the
 * paper's tooth.
 * @returns The texture, repeating, in the screen's colour space.
 */
export const createPaperTexture = (): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas')
  canvas.width = PAPER_TEXTURE_SIZE
  canvas.height = PAPER_TEXTURE_SIZE
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Unable to create 2D context for the paper texture')
  const [darkest, lightest] = PAPER_TONE_RANGE
  const grain = context.createImageData(PAPER_TEXTURE_SIZE, PAPER_TEXTURE_SIZE)
  Array.from({ length: PAPER_TEXTURE_SIZE * PAPER_TEXTURE_SIZE }).forEach((_, index) => {
    const tone = darkest + Math.random() * (lightest - darkest)
    grain.data.set([tone, tone, tone, 255], index * 4)
  })
  context.putImageData(grain, 0, 0)
  Array.from({ length: PAPER_FIBRE_COUNT }).forEach(() => drawFibre(context, PAPER_TEXTURE_SIZE))
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/** How strongly a material is embossed and how bright its rim glows, both changeable live. */
export interface CardShading {
  emboss: THREE.IUniform<number>
  rim: THREE.IUniform<number>
  reflection: THREE.IUniform<number>
  reflectionMap: THREE.IUniform<THREE.Texture | null>
  /** How far the reflection has swayed sideways, as a share of the footage. */
  reflectionShift: THREE.IUniform<number>
  /** How far the reflection is blurred, as a share of the footage. */
  reflectionBlur: THREE.IUniform<number>
}

/**
 * Gives a material two effects of its own, so they touch only the logo and letters. The emboss
 * makes faces whose edges lean towards the light a little lighter and the rest a little darker,
 * like a card pressed under a desk lamp. The rim makes faces turned side-on to the camera glow
 * faintly, outlining the shape; a real light from behind would light the floor and the wall too.
 * @param material The logo and letters' material.
 * @returns The two strengths, to set from the chosen look and the panel.
 */
export const addCardShading = (material: THREE.MeshStandardMaterial): CardShading => {
  const shading: CardShading = {
    emboss: { value: 0 },
    rim: { value: 0 },
    reflection: { value: 0 },
    reflectionMap: { value: null },
    reflectionShift: { value: 0 },
    reflectionBlur: { value: 0 }
  }
  const [lightX, lightY] = EMBOSS_LIGHT_DIRECTION
  material.onBeforeCompile = (shader) => {
    shader.uniforms.embossStrength = shading.emboss
    shader.uniforms.rimStrength = shading.rim
    shader.uniforms.rimColor = { value: new THREE.Color(RIM_LIGHT_COLOR) }
    shader.uniforms.reflectionStrength = shading.reflection
    shader.uniforms.reflectionMap = shading.reflectionMap
    shader.uniforms.reflectionShift = shading.reflectionShift
    shader.uniforms.reflectionBlur = shading.reflectionBlur
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        'uniform float embossStrength;\nuniform float rimStrength;\nuniform vec3 rimColor;\nuniform float reflectionStrength;\nuniform sampler2D reflectionMap;\nuniform float reflectionShift;\nuniform float reflectionBlur;\nvoid main() {'
      )
      .replace(
        '#include <normal_fragment_begin>',
        `#include <normal_fragment_begin>
        // In view space x and y run along the screen, so a face's normal says which way it leans.
        float towardsLight = dot(normal.xy, normalize(vec2(${lightX.toFixed(2)}, ${lightY.toFixed(2)})));
        diffuseColor.rgb *= clamp(1.0 + embossStrength * towardsLight, 0.0, 2.0);`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        // The camera looks along view space z, so a normal's z says how squarely a face meets it.
        float sideOn = 1.0 - abs(normal.z);
        totalEmissiveRadiance += rimColor * pow(sideOn, ${RIM_LIGHT_POWER.toFixed(1)}) * rimStrength;
        // A mirror finish: the face shows the footage at its own place in view, mirrored left to
        // right, and shifted by its tilt so bevels and sides catch a different part of it.
        vec2 mirrorUv = vec2(0.5, 0.5) + vec2(vViewPosition.x, -vViewPosition.y) / ${REFLECTION_SPAN.toFixed(1)}
          + normal.xy * ${REFLECTION_TILT.toFixed(2)} + vec2(reflectionShift, 0.0);
        // Blurred by averaging taps along a golden-angle spiral, spread as far as the blur asks.
        vec3 reflected = vec3(0.0);
        for (int tap = 0; tap < ${REFLECTION_BLUR_TAPS}; tap++) {
          float spiral = float(tap) * 2.39996;
          float reach = sqrt(float(tap) / ${REFLECTION_BLUR_TAPS}.0) * reflectionBlur;
          reflected += texture2D(reflectionMap, mirrorUv + vec2(cos(spiral), sin(spiral)) * reach).rgb;
        }
        totalEmissiveRadiance += reflected / ${REFLECTION_BLUR_TAPS}.0 * reflectionStrength;`
      )
  }
  return shading
}
