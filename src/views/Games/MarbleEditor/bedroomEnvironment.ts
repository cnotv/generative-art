import * as THREE from 'three'
import { computeToyPlacements } from './bedroomLayout'
import { SKY_COLOR } from './config'
import {
  BEDROOM_BACKDROP_COLOR,
  BEDROOM_FOG_DENSITY,
  FLOOR_PLANK_COLORS,
  FLOOR_SEAM_COLOR,
  FLOOR_TEXTURE_SIZE,
  FLOOR_REPEAT_UNITS,
  WALL_STRIPE_COLORS,
  WALL_STRIPE_TEXTURE_SIZE,
  WALL_STRIPE_REPEAT_UNITS,
  SKIRTING_COLOR,
  SKIRTING_HEIGHT,
  SKIRTING_THICKNESS,
  CEILING_COLOR,
  RUG_COLORS,
  RUG_RADIUS_FRACTION,
  RUG_RING_STEP,
  RUG_Y_STEP,
  WINDOW_WIDTH_FRACTION,
  WINDOW_HEIGHT_FRACTION,
  WINDOW_SILL_FRACTION,
  WINDOW_FRAME_COLOR,
  WINDOW_FRAME_THICKNESS,
  WINDOW_INSET,
  TOY_BLOCK_LETTERS,
  TOY_BLOCK_COLORS,
  TOY_CRAYON_COLORS,
  TEDDY_FUR_COLOR,
  TEDDY_MUZZLE_COLOR,
  TEDDY_DARK_COLOR,
  BEACH_BALL_COLORS,
  BOOK_COLORS,
  TRAIN_BODY_COLOR,
  TRAIN_CABIN_COLOR,
  TRAIN_WHEEL_COLOR
} from './bedroomConfig'
import type { RoomLayout, ToyKind, ToyPlacement, BedroomEnvironment } from './types'

const createCanvasTexture = (
  size: number,
  draw: (context: CanvasRenderingContext2D, size: number) => void
): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (context) draw(context, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

const drawWoodPlanks = (context: CanvasRenderingContext2D, size: number): void => {
  const rowCount = 4
  const rowHeight = size / rowCount
  const boardWidth = size / 2
  context.fillStyle = FLOOR_SEAM_COLOR
  context.fillRect(0, 0, size, size)
  Array.from({ length: rowCount }, (_, row) => row).forEach((row) => {
    const stagger = (row % 2) * (boardWidth / 2)
    Array.from({ length: 3 }, (_, board) => board).forEach((board) => {
      const colorIndex = (row * 3 + board) % FLOOR_PLANK_COLORS.length
      context.fillStyle = FLOOR_PLANK_COLORS[colorIndex]
      context.fillRect(
        board * boardWidth - stagger + 2,
        row * rowHeight + 2,
        boardWidth - 4,
        rowHeight - 4
      )
    })
  })
}

const drawWallStripes = (context: CanvasRenderingContext2D, size: number): void => {
  const stripeCount = 8
  const stripeWidth = size / stripeCount
  Array.from({ length: stripeCount }, (_, stripe) => stripe).forEach((stripe) => {
    context.fillStyle = WALL_STRIPE_COLORS[stripe % WALL_STRIPE_COLORS.length]
    context.fillRect(stripe * stripeWidth, 0, stripeWidth, size)
  })
}

const drawBlockLetter =
  (letter: string, background: string) =>
  (context: CanvasRenderingContext2D, size: number): void => {
    context.fillStyle = background
    context.fillRect(0, 0, size, size)
    context.fillStyle = '#ffffff'
    const border = size / 8
    context.fillRect(border, border, size - 2 * border, size - 2 * border)
    context.fillStyle = background
    context.font = `bold ${size * 0.55}px sans-serif`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(letter, size / 2, size / 2 + size * 0.02)
  }

const drawBeachBallStripes = (context: CanvasRenderingContext2D, size: number): void => {
  const stripeWidth = size / BEACH_BALL_COLORS.length
  BEACH_BALL_COLORS.forEach((color, stripe) => {
    context.fillStyle = color
    context.fillRect(stripe * stripeWidth, 0, stripeWidth, size)
  })
}

const toyMaterial = (color: number): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0 })

const addSphere = (
  group: THREE.Group,
  material: THREE.Material,
  radius: number,
  position: [number, number, number],
  scale: [number, number, number] = [1, 1, 1]
): void => {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 16), material)
  mesh.position.set(...position)
  mesh.scale.set(...scale)
  mesh.castShadow = true
  group.add(mesh)
}

const addBox = (
  group: THREE.Group,
  material: THREE.Material | THREE.Material[],
  size: [number, number, number],
  position: [number, number, number],
  rotationY = 0
): void => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material)
  mesh.position.set(...position)
  mesh.rotation.y = rotationY
  mesh.castShadow = true
  group.add(mesh)
}

const buildTeddyBear = (): THREE.Group => {
  const group = new THREE.Group()
  const fur = toyMaterial(TEDDY_FUR_COLOR)
  const muzzle = toyMaterial(TEDDY_MUZZLE_COLOR)
  const dark = toyMaterial(TEDDY_DARK_COLOR)
  addSphere(group, fur, 1.1, [0, 1.15, 0], [1, 1.15, 0.9])
  addSphere(group, fur, 0.75, [0, 2.55, 0])
  addSphere(group, fur, 0.28, [-0.55, 3.15, 0])
  addSphere(group, fur, 0.28, [0.55, 3.15, 0])
  addSphere(group, muzzle, 0.32, [0, 2.4, 0.6])
  addSphere(group, dark, 0.1, [0, 2.52, 0.85])
  addSphere(group, dark, 0.07, [-0.26, 2.72, 0.62])
  addSphere(group, dark, 0.07, [0.26, 2.72, 0.62])
  addSphere(group, fur, 0.4, [-1.05, 1.5, 0.15])
  addSphere(group, fur, 0.4, [1.05, 1.5, 0.15])
  addSphere(group, fur, 0.45, [-0.55, 0.45, 0.55])
  addSphere(group, fur, 0.45, [0.55, 0.45, 0.55])
  return group
}

const buildLetterBlock = (variant: number): THREE.Group => {
  const group = new THREE.Group()
  const letter = TOY_BLOCK_LETTERS[variant % TOY_BLOCK_LETTERS.length]
  const background = TOY_BLOCK_COLORS[variant % TOY_BLOCK_COLORS.length]
  const faceTexture = createCanvasTexture(128, drawBlockLetter(letter, background))
  const faceMaterial = new THREE.MeshStandardMaterial({ map: faceTexture, roughness: 0.85 })
  const plainMaterial = toyMaterial(parseInt(background.slice(1), 16))
  addBox(
    group,
    [faceMaterial, faceMaterial, plainMaterial, plainMaterial, faceMaterial, faceMaterial],
    [2, 2, 2],
    [0, 1, 0]
  )
  return group
}

const buildBeachBall = (): THREE.Group => {
  const group = new THREE.Group()
  const texture = createCanvasTexture(256, drawBeachBallStripes)
  const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.6 })
  addSphere(group, material, 1.2, [0, 1.2, 0])
  return group
}

const buildBookStack = (): THREE.Group => {
  const group = new THREE.Group()
  BOOK_COLORS.forEach((color, index) => {
    addBox(
      group,
      toyMaterial(color),
      [2.4 - index * 0.2, 0.35, 1.7 - index * 0.1],
      [index * 0.1, 0.175 + index * 0.35, index * -0.08],
      index * 0.35
    )
  })
  return group
}

const buildCrayon = (variant: number): THREE.Group => {
  const group = new THREE.Group()
  const color = TOY_CRAYON_COLORS[variant % TOY_CRAYON_COLORS.length]
  const material = toyMaterial(color)
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 3, 16), material)
  body.rotation.z = Math.PI / 2
  body.position.set(0, 0.35, 0)
  body.castShadow = true
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.7, 16), material)
  tip.rotation.z = -Math.PI / 2
  tip.position.set(1.85, 0.35, 0)
  tip.castShadow = true
  group.add(body)
  group.add(tip)
  return group
}

const buildToyTrain = (): THREE.Group => {
  const group = new THREE.Group()
  const body = toyMaterial(TRAIN_BODY_COLOR)
  const cabin = toyMaterial(TRAIN_CABIN_COLOR)
  const wheelMaterial = toyMaterial(TRAIN_WHEEL_COLOR)
  addBox(group, body, [1.6, 1.2, 3], [0, 1.1, 0.3])
  addBox(group, cabin, [1.7, 1.6, 1.2], [0, 1.6, -1.4])
  const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 0.8, 12), cabin)
  chimney.position.set(0, 2, 1.1)
  chimney.castShadow = true
  group.add(chimney)
  const wheelGeometry = new THREE.CylinderGeometry(0.45, 0.45, 0.3, 16)
  const wheelOffsets: [number, number][] = [
    [-0.95, 1.1],
    [0.95, 1.1],
    [-0.95, -1.1],
    [0.95, -1.1]
  ]
  wheelOffsets.forEach(([x, z]) => {
    const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial)
    wheel.rotation.z = Math.PI / 2
    wheel.position.set(x, 0.45, z)
    wheel.castShadow = true
    group.add(wheel)
  })
  return group
}

const TOY_BUILDERS: Record<ToyKind, (variant: number) => THREE.Group> = {
  'teddy-bear': () => buildTeddyBear(),
  'letter-block': (variant) => buildLetterBlock(variant),
  'beach-ball': () => buildBeachBall(),
  'book-stack': () => buildBookStack(),
  crayon: (variant) => buildCrayon(variant),
  'toy-train': () => buildToyTrain()
}

const buildToy = (placement: ToyPlacement): THREE.Group => {
  const toy = TOY_BUILDERS[placement.kind](placement.variant)
  toy.position.set(...placement.position)
  toy.rotation.y = placement.rotationY
  toy.scale.setScalar(placement.scale)
  return toy
}

const buildFloor = (layout: RoomLayout): THREE.Mesh => {
  const texture = createCanvasTexture(FLOOR_TEXTURE_SIZE, drawWoodPlanks)
  texture.repeat.set(layout.width / FLOOR_REPEAT_UNITS, layout.depth / FLOOR_REPEAT_UNITS)
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(layout.width, layout.depth),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9 })
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.set(layout.centerX, layout.floorY, layout.centerZ)
  floor.receiveShadow = true
  return floor
}

const buildRug = (layout: RoomLayout): THREE.Group => {
  const group = new THREE.Group()
  const baseRadius = Math.min(layout.width, layout.depth) * RUG_RADIUS_FRACTION
  RUG_COLORS.forEach((color, ring) => {
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(baseRadius * (1 - ring * RUG_RING_STEP), 48),
      new THREE.MeshStandardMaterial({ color, roughness: 1 })
    )
    disc.rotation.x = -Math.PI / 2
    disc.position.set(layout.centerX, layout.floorY + 0.05 + ring * RUG_Y_STEP, layout.centerZ)
    disc.receiveShadow = true
    group.add(disc)
  })
  return group
}

type WallSpec = {
  width: number
  position: [number, number, number]
  rotationY: number
}

// Walls and ceiling are single-sided facing inward: from outside the room the
// near surfaces are backface-culled, so an orbiting camera always sees in.
const wallSpecs = (layout: RoomLayout): WallSpec[] => {
  const wallCenterY = layout.floorY + layout.wallHeight / 2
  return [
    {
      width: layout.width,
      position: [layout.centerX, wallCenterY, layout.centerZ - layout.depth / 2],
      rotationY: 0
    },
    {
      width: layout.width,
      position: [layout.centerX, wallCenterY, layout.centerZ + layout.depth / 2],
      rotationY: Math.PI
    },
    {
      width: layout.depth,
      position: [layout.centerX - layout.width / 2, wallCenterY, layout.centerZ],
      rotationY: Math.PI / 2
    },
    {
      width: layout.depth,
      position: [layout.centerX + layout.width / 2, wallCenterY, layout.centerZ],
      rotationY: -Math.PI / 2
    }
  ]
}

const buildWalls = (layout: RoomLayout): THREE.Group => {
  const group = new THREE.Group()
  wallSpecs(layout).forEach((spec) => {
    const texture = createCanvasTexture(WALL_STRIPE_TEXTURE_SIZE, drawWallStripes)
    texture.repeat.set(spec.width / WALL_STRIPE_REPEAT_UNITS, 1)
    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(spec.width, layout.wallHeight),
      new THREE.MeshStandardMaterial({ map: texture, roughness: 1 })
    )
    wall.position.set(...spec.position)
    wall.rotation.y = spec.rotationY
    group.add(wall)
    const skirting = new THREE.Mesh(
      new THREE.BoxGeometry(spec.width, SKIRTING_HEIGHT, SKIRTING_THICKNESS),
      new THREE.MeshStandardMaterial({ color: SKIRTING_COLOR, roughness: 0.7 })
    )
    skirting.position.set(...spec.position)
    skirting.position.y = layout.floorY + SKIRTING_HEIGHT / 2
    skirting.rotation.y = spec.rotationY
    skirting.translateZ(SKIRTING_THICKNESS / 2)
    group.add(skirting)
  })
  return group
}

const buildCeiling = (layout: RoomLayout): THREE.Mesh => {
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(layout.width, layout.depth),
    new THREE.MeshStandardMaterial({ color: CEILING_COLOR, roughness: 1 })
  )
  ceiling.rotation.x = Math.PI / 2
  ceiling.position.set(layout.centerX, layout.floorY + layout.wallHeight, layout.centerZ)
  return ceiling
}

// Window on the far (-z) wall: white frame, glowing sky pane and crossbars.
const buildWindow = (layout: RoomLayout): THREE.Group => {
  const group = new THREE.Group()
  const windowWidth = layout.width * WINDOW_WIDTH_FRACTION
  const windowHeight = layout.wallHeight * WINDOW_HEIGHT_FRACTION
  const sillY = layout.floorY + layout.wallHeight * WINDOW_SILL_FRACTION
  const centerY = sillY + windowHeight / 2
  const wallZ = layout.centerZ - layout.depth / 2
  const paneZ = wallZ + WINDOW_INSET
  const frame = new THREE.MeshStandardMaterial({ color: WINDOW_FRAME_COLOR, roughness: 0.6 })
  const pane = new THREE.Mesh(
    new THREE.PlaneGeometry(windowWidth, windowHeight),
    new THREE.MeshBasicMaterial({ color: SKY_COLOR })
  )
  pane.position.set(layout.centerX, centerY, paneZ)
  group.add(pane)
  const frameParts: { size: [number, number, number]; position: [number, number, number] }[] = [
    {
      size: [windowWidth + 2 * WINDOW_FRAME_THICKNESS, WINDOW_FRAME_THICKNESS, WINDOW_INSET * 2],
      position: [layout.centerX, sillY, paneZ]
    },
    {
      size: [windowWidth + 2 * WINDOW_FRAME_THICKNESS, WINDOW_FRAME_THICKNESS, WINDOW_INSET * 2],
      position: [layout.centerX, sillY + windowHeight, paneZ]
    },
    {
      size: [WINDOW_FRAME_THICKNESS, windowHeight + WINDOW_FRAME_THICKNESS, WINDOW_INSET * 2],
      position: [layout.centerX - windowWidth / 2, centerY, paneZ]
    },
    {
      size: [WINDOW_FRAME_THICKNESS, windowHeight + WINDOW_FRAME_THICKNESS, WINDOW_INSET * 2],
      position: [layout.centerX + windowWidth / 2, centerY, paneZ]
    },
    {
      size: [WINDOW_FRAME_THICKNESS / 2, windowHeight, WINDOW_INSET],
      position: [layout.centerX, centerY, paneZ]
    },
    {
      size: [windowWidth, WINDOW_FRAME_THICKNESS / 2, WINDOW_INSET],
      position: [layout.centerX, centerY, paneZ]
    }
  ]
  frameParts.forEach(({ size, position }) => {
    const part = new THREE.Mesh(new THREE.BoxGeometry(...size), frame)
    part.position.set(...position)
    group.add(part)
  })
  return group
}

const disposeMaterial = (material: THREE.Material): void => {
  const textured = material as THREE.MeshStandardMaterial
  if (textured.map) textured.map.dispose()
  material.dispose()
}

const disposeGroup = (group: THREE.Group): void => {
  group.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.geometry.dispose()
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    materials.forEach(disposeMaterial)
  })
}

/**
 * Warm room tint for fog and background shared by editor and race mode.
 */
export const applyBedroomAtmosphere = (scene: THREE.Scene): void => {
  scene.fog = new THREE.FogExp2(BEDROOM_BACKDROP_COLOR, BEDROOM_FOG_DENSITY)
  scene.background = new THREE.Color(BEDROOM_BACKDROP_COLOR)
}

/**
 * Builds the giant children-bedroom shell (wood floor, rug, striped walls,
 * window, ceiling) with low-poly toys around the perimeter, sized from the
 * given room layout. Purely visual: no physics colliders are created.
 */
export const buildBedroom = (scene: THREE.Scene, layout: RoomLayout): BedroomEnvironment => {
  const group = new THREE.Group()
  group.name = 'bedroom-environment'
  group.add(buildFloor(layout))
  group.add(buildRug(layout))
  group.add(buildWalls(layout))
  group.add(buildCeiling(layout))
  group.add(buildWindow(layout))
  computeToyPlacements(layout).forEach((placement) => group.add(buildToy(placement)))
  scene.add(group)
  return {
    layout,
    group,
    dispose: () => {
      scene.remove(group)
      disposeGroup(group)
    }
  }
}
