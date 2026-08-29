import * as THREE from 'three'
import {
  applyMaterial,
  applyTextureToMesh,
  disposeObject,
  getAnimations,
  getModel
} from '@webgamekit/threejs'
import { createStickmanPartOffsets, prepareStickmanRig } from '@/utils/stickmanRig'
import { STICKMAN_SKINS, stickmanSkinById } from '@/views/Games/RockRunner/elements/stickmanSkins'
import type { ControlOption } from '@/stores/viewConfig'
import {
  ARM_PITCH_DOWN,
  ARM_PITCH_UP,
  ARM_ROLL_DOWN,
  ARM_ROLL_UP,
  CANVAS_DISPLAY_POSITION,
  MIXAMO_ANIMATION,
  CUT_OUT_LABEL_PREFIX,
  MIXAMO_CHARACTER,
  MIXAMO_CHARACTER_LABEL,
  MIXAMO_COLOR,
  MIXAMO_HAND_BONES,
  MIXAMO_MODEL_PATH,
  MIXAMO_SCALE,
  STICKMAN_MODEL_PATH,
  STICKMAN_SCALE,
  STICKMAN_TEXTURE_ALPHA_TEST,
  STICKMAN_YAW
} from './config'
import type { SlideshowCharacter } from './types'

type World = Parameters<typeof getModel>[1]

/**
 * Stands a rig so its hands, rather than its feet, sit at the display height.
 *
 * The two rigs are scaled to hold their hands the same distance apart, which
 * their differing proportions then leave at different heights. Hanging each one
 * from its hands is what lets a single camera and a single picture size serve
 * both without either being re-tuned.
 * @param model - The spawned rig, moved in place
 * @param handHeight - Where the rig's hands currently are, in world units
 * @returns Nothing; the rig is moved
 */
const standByHands = (model: THREE.Object3D, handHeight: number): void => {
  model.position.y += CANVAS_DISPLAY_POSITION[1] - handHeight
}

/**
 * The flat cut-out rig, wearing one of the shared skins and posed by the slideshow itself.
 * @param scene - The scene to add the rig to
 * @param world - The physics world `getModel` needs
 * @param skinId - Which illustration to project onto it
 * @returns The character, ready to be posed each frame
 */
const spawnStickman = async (
  scene: THREE.Scene,
  world: World,
  skinId: string
): Promise<SlideshowCharacter> => {
  const model = await getModel(scene, world, STICKMAN_MODEL_PATH, {
    name: 'character',
    position: [0, 0, 0],
    scale: [STICKMAN_SCALE, STICKMAN_SCALE, STICKMAN_SCALE],
    rotation: [0, STICKMAN_YAW, 0],
    type: 'fixed',
    hasGravity: false,
    castShadow: true
  })
  const partRig = prepareStickmanRig(model, createStickmanPartOffsets())
  const skin = stickmanSkinById(skinId)
  model.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) return
    applyTextureToMesh(mesh, skin.textureUrl)
    applyMaterial(mesh, {
      transparent: true,
      alphaTest: STICKMAN_TEXTURE_ALPHA_TEST,
      depthWrite: true
    })
  })
  const spawnBox = new THREE.Box3().setFromObject(model)
  model.position.y -= spawnBox.min.y

  const arms = [...partRig.armLeft, ...partRig.armRight].map(({ node, restPosition }) => ({
    node,
    side: Math.sign(restPosition.x) || 1
  }))
  const held = new THREE.Vector3(...CANVAS_DISPLAY_POSITION)

  return {
    model,
    mixer: null,
    pose: (holdAmount: number) => {
      arms.forEach(({ node, side }) => {
        node.rotation.x = ARM_PITCH_DOWN + (ARM_PITCH_UP - ARM_PITCH_DOWN) * holdAmount
        node.rotation.z = side * (ARM_ROLL_DOWN + (ARM_ROLL_UP - ARM_ROLL_DOWN) * holdAmount)
      })
    },
    heldPoint: (target: THREE.Vector3) => target.copy(held)
  }
}

/**
 * The Mixamo rig, posed by the authored gesture clip rather than by the slideshow.
 *
 * Its hands are what the picture is hung from, so wherever the clip puts them
 * the picture follows and the two can never disagree.
 * @param scene - The scene to add the rig to
 * @param world - The physics world `getModel` needs
 * @returns The character, whose pose comes from its own clip
 */
const spawnMixamo = async (scene: THREE.Scene, world: World): Promise<SlideshowCharacter> => {
  const model = await getModel(scene, world, MIXAMO_MODEL_PATH, {
    name: 'character',
    position: [0, 0, 0],
    scale: [MIXAMO_SCALE, MIXAMO_SCALE, MIXAMO_SCALE],
    type: 'fixed',
    hasGravity: false,
    castShadow: true,
    material: 'MeshLambertMaterial',
    color: MIXAMO_COLOR
  })
  const mixer = new THREE.AnimationMixer(model)
  const actions = await getAnimations(mixer, MIXAMO_ANIMATION)
  Object.values(actions).forEach((action) => action.play())
  // One frame of the clip has to be applied before the hands are anywhere but
  // the T-pose, and the rig is stood by where they end up.
  mixer.update(0)
  model.updateMatrixWorld(true)

  const hands = MIXAMO_HAND_BONES.map((name) => model.getObjectByName(name)).filter(
    (node): node is THREE.Object3D => !!node
  )
  const measured = new THREE.Vector3()
  hands[0].getWorldPosition(measured)
  standByHands(model, measured.y)

  const left = new THREE.Vector3()
  const right = new THREE.Vector3()

  return {
    model,
    mixer,
    pose: () => {},
    heldPoint: (target: THREE.Vector3) => {
      hands[0].getWorldPosition(left)
      hands[1].getWorldPosition(right)
      target.addVectors(left, right).multiplyScalar(0.5)
      target.z += CANVAS_DISPLAY_POSITION[2]
    }
  }
}

/**
 * Builds whichever character the panel is asking for.
 * @param scene - The scene to add the rig to
 * @param world - The physics world `getModel` needs
 * @param characterId - `mixamo`, or the id of a cut-out skin
 * @returns The character, ready to be posed each frame
 */
export const spawnSlideshowCharacter = (
  scene: THREE.Scene,
  world: World,
  characterId: string
): Promise<SlideshowCharacter> =>
  characterId === MIXAMO_CHARACTER
    ? spawnMixamo(scene, world)
    : spawnStickman(scene, world, characterId)

/**
 * Takes a character out of the scene and frees what it owned.
 * @param scene - The scene it was added to
 * @param character - The character being replaced
 * @returns Nothing; the rig is removed and disposed
 */
export const despawnSlideshowCharacter = (
  scene: THREE.Scene,
  character: SlideshowCharacter
): void => {
  character.mixer?.stopAllAction()
  scene.remove(character.model)
  disposeObject(character.model)
}

/**
 * The character list the panel offers, built from the shared skin catalogue.
 *
 * Derived rather than written out, so a skin added for another view turns up
 * here without this one being touched — which is also why it is worked out
 * beside the characters instead of listed in the config.
 * @returns One option per character, the animated rig first
 */
export const characterOptions = (): ControlOption[] => [
  { value: MIXAMO_CHARACTER, label: MIXAMO_CHARACTER_LABEL },
  ...STICKMAN_SKINS.map((skin) => ({
    value: skin.id,
    label: `${CUT_OUT_LABEL_PREFIX} — ${skin.label}`
  }))
]
