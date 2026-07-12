import * as THREE from 'three'

const LABEL_CANVAS_WIDTH = 256
const LABEL_CANVAS_HEIGHT = 64
const LABEL_FONT = 'bold 34px system-ui, sans-serif'
const LABEL_WORLD_WIDTH = 4.5
const LABEL_OFFSET_Y = 2.2

const drawLabelCanvas = (text: string, color: string): HTMLCanvasElement => {
  const canvas = document.createElement('canvas')
  canvas.width = LABEL_CANVAS_WIDTH
  canvas.height = LABEL_CANVAS_HEIGHT
  const context = canvas.getContext('2d')
  if (!context) return canvas
  context.font = LABEL_FONT
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.lineWidth = 6
  context.strokeStyle = 'rgba(255, 255, 255, 0.9)'
  context.strokeText(text, LABEL_CANVAS_WIDTH / 2, LABEL_CANVAS_HEIGHT / 2)
  context.fillStyle = color
  context.fillText(text, LABEL_CANVAS_WIDTH / 2, LABEL_CANVAS_HEIGHT / 2)
  return canvas
}

export const createNameLabel = (scene: THREE.Scene, text: string, color: string): THREE.Sprite => {
  const texture = new THREE.CanvasTexture(drawLabelCanvas(text, color))
  texture.colorSpace = THREE.SRGBColorSpace
  const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(
    LABEL_WORLD_WIDTH,
    (LABEL_WORLD_WIDTH * LABEL_CANVAS_HEIGHT) / LABEL_CANVAS_WIDTH,
    1
  )
  sprite.renderOrder = 10
  scene.add(sprite)
  return sprite
}

export const updateNameLabelPosition = (
  sprite: THREE.Sprite,
  position: { x: number; y: number; z: number }
): void => {
  sprite.position.set(position.x, position.y + LABEL_OFFSET_Y, position.z)
}

export const disposeNameLabel = (scene: THREE.Scene, sprite: THREE.Sprite): void => {
  scene.remove(sprite)
  sprite.material.map?.dispose()
  sprite.material.dispose()
}
