import { shallowRef, type Ref, type ShallowRef } from 'vue'
import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import type { CoordinateTuple } from '@webgamekit/threejs'
import { syncMeshesWithBodies } from '@webgamekit/threejs'
import type { TimelineManager } from '@webgamekit/animation'
import { computeRigDiagonal } from './boneMarkers'
import {
  DEFAULT_POSITION_RANGE,
  MARBLE_DROP_HEIGHT_FRACTION,
  MARBLE_GRAVITY_REFERENCE_SPREAD,
  MARBLE_MAX_ALIVE
} from './config'
import { buildMarbleDropPosition, pickMarbleRadius, pickMarbleTexture } from './marbles'
import { buildBoneColliderSpecs, readBoneColliderTransform } from './rigColliders'
import {
  createBoneColliderBody,
  createEnclosure,
  createEnclosureFloor,
  createMarble,
  disposePhysicsMeshes,
  type BoneColliderBody,
  type PhysicsMesh
} from './rigPhysicsObjects'
import type { RigAnimatorConfig } from './types'

const MARBLE_FLOW_ACTION_NAME = 'rig-physics: marble flow'

interface PhysicsReferences {
  scene: ShallowRef<THREE.Scene | null>
  world: ShallowRef<RAPIER.World | null>
  bones: ShallowRef<THREE.Bone[]>
  model: ShallowRef<THREE.Object3D | null>
  config: Ref<RigAnimatorConfig>
  rigDiagonal: () => number
}

/** The kinematic capsules that follow the posed bones. */
const createBoneColliderState = ({ world, bones, model, config }: PhysicsReferences) => {
  let boneColliders: BoneColliderBody[] = []

  const clear = (): void => {
    const currentWorld = world.value
    if (currentWorld) boneColliders.forEach(({ body }) => currentWorld.removeRigidBody(body))
    boneColliders = []
  }

  const rebuild = (): void => {
    clear()
    const currentWorld = world.value
    if (!currentWorld || !config.value.physicsEnabled || bones.value.length === 0) return

    model.value?.updateMatrixWorld(true)
    const bonesByName = new Map(bones.value.map((bone) => [bone.name, bone]))
    boneColliders = buildBoneColliderSpecs(bones.value).flatMap((spec) => {
      const bone = bonesByName.get(spec.boneName)
      return bone ? [createBoneColliderBody(currentWorld, bone, spec)] : []
    })
  }

  const tick = (position: THREE.Vector3, rotation: THREE.Quaternion): void => {
    boneColliders.forEach(({ bone, spec, body }) => {
      readBoneColliderTransform(bone, spec, position, rotation)
      body.setNextKinematicTranslation(position)
      body.setNextKinematicRotation(rotation)
    })
  }

  return { clear, rebuild, tick }
}

/** The enclosure floor and its four optional walls, sized to the rig's own spread. */
const createEnclosureState = ({ scene, world, config, rigDiagonal }: PhysicsReferences) => {
  let walls: PhysicsMesh[] = []
  let floor: RAPIER.RigidBody | null = null

  const clear = (): void => {
    const currentWorld = world.value
    if (currentWorld) {
      disposePhysicsMeshes(currentWorld, walls)
      if (floor) currentWorld.removeRigidBody(floor)
    }
    walls = []
    floor = null
  }

  const rebuild = (): void => {
    clear()
    const currentScene = scene.value
    const currentWorld = world.value
    if (!currentScene || !currentWorld || !config.value.physicsEnabled) return

    // The floor is not part of the walls toggle: without it marbles fall through the world
    // wherever the scene's own smaller ground does not reach.
    floor = createEnclosureFloor(currentWorld, rigDiagonal())
    if (!config.value.showEnclosure) return

    walls = createEnclosure(
      currentScene,
      currentWorld,
      rigDiagonal(),
      config.value.enclosureOpacity
    )
  }

  return { clear, rebuild }
}

/** A timeline action that drips one marble in at a time, the same interval-action shape the
 * Timeline view uses for its own ball spawner, so a hand can be held under the flow instead of
 * a whole batch landing at once. */
const createMarbleFlowState = (
  { scene, world, model, config, rigDiagonal }: PhysicsReferences,
  timeline: ShallowRef<TimelineManager | null>
) => {
  let marbles: PhysicsMesh[] = []
  let flowActionId: string | null = null

  const spawn = (): void => {
    const currentScene = scene.value
    const currentWorld = world.value
    if (!currentScene || !currentWorld) return

    const diagonal = rigDiagonal()
    const center = (model.value?.position.toArray() ?? [0, 0, 0]) as CoordinateTuple
    marbles.push(
      createMarble(currentScene, currentWorld, {
        position: buildMarbleDropPosition(center, diagonal * MARBLE_DROP_HEIGHT_FRACTION, diagonal),
        radius: pickMarbleRadius(diagonal),
        textureUrl: config.value.marbleTextures ? pickMarbleTexture() : undefined,
        gravityScale: diagonal / MARBLE_GRAVITY_REFERENCE_SPREAD
      })
    )

    if (marbles.length > MARBLE_MAX_ALIVE) {
      const [oldest] = marbles.splice(0, 1)
      disposePhysicsMeshes(currentWorld, [oldest])
    }
  }

  const clear = (): void => {
    if (world.value) disposePhysicsMeshes(world.value, marbles)
    marbles = []
  }

  const stop = (): void => {
    if (flowActionId) timeline.value?.removeAction(flowActionId)
    flowActionId = null
  }

  const start = (): void => {
    stop()
    if (!timeline.value || !config.value.physicsEnabled) return
    flowActionId = timeline.value.addAction({
      name: MARBLE_FLOW_ACTION_NAME,
      category: 'physics',
      interval: [1, config.value.marbleSpawnInterval],
      action: spawn
    })
  }

  const rebuild = (): void => {
    clear()
    start()
  }

  const tick = (): void => syncMeshesWithBodies(marbles)

  return { clear, stop, start, rebuild, tick }
}

/** Owns everything physical in the rig animator, built from the three states above. Nothing
 * exists until the physics toggle is on, since a humanoid rig is upwards of fifty kinematic
 * bodies rewritten every frame before the world is even stepped. */
export const useRigPhysics = (
  config: Ref<RigAnimatorConfig>,
  bones: ShallowRef<THREE.Bone[]>,
  model: ShallowRef<THREE.Object3D | null>
) => {
  const scene = shallowRef<THREE.Scene | null>(null)
  const world = shallowRef<RAPIER.World | null>(null)
  const timeline = shallowRef<TimelineManager | null>(null)
  const rigDiagonal = (): number =>
    bones.value.length > 0 ? computeRigDiagonal(bones.value) : DEFAULT_POSITION_RANGE

  const refs: PhysicsReferences = { scene, world, bones, model, config, rigDiagonal }
  const boneColliders = createBoneColliderState(refs)
  const enclosure = createEnclosureState(refs)
  const marbleFlow = createMarbleFlowState(refs, timeline)

  const colliderPosition = new THREE.Vector3()
  const colliderRotation = new THREE.Quaternion()

  const rebuild = (): void => {
    boneColliders.rebuild()
    enclosure.rebuild()
    marbleFlow.rebuild()
  }

  const clear = (): void => {
    boneColliders.clear()
    marbleFlow.stop()
    marbleFlow.clear()
    enclosure.clear()
  }

  const tickPhysics = (): void => {
    boneColliders.tick(colliderPosition, colliderRotation)
    marbleFlow.tick()
  }

  return {
    setPhysicsScene: (nextScene: THREE.Scene): void => {
      scene.value = nextScene
    },
    setWorld: (nextWorld: RAPIER.World): void => {
      world.value = nextWorld
    },
    setTimeline: (nextTimeline: TimelineManager): void => {
      timeline.value = nextTimeline
    },
    rebuildPhysics: rebuild,
    rebuildMarbles: marbleFlow.rebuild,
    updateMarbleFlow: marbleFlow.start,
    rebuildEnclosure: enclosure.rebuild,
    clearPhysics: clear,
    tickPhysics
  }
}
