import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import type { ComplexModel } from "@webgamekit/threejs";
import { getCube } from "@webgamekit/threejs";
import { updateAnimation } from "@webgamekit/animation";
import { logicAdvanceAlongPath } from "@webgamekit/logic";
import type { PathFollowResult, PathFollowState } from "@webgamekit/logic";
import {
  GOOMBA_ANIMATION_FALLBACK_NAME,
  DYNAMIC_OBSTACLE_COLOR,
  DYNAMIC_OBSTACLE_POSITIONS,
  FIXED_OBSTACLE_COLOR,
  FIXED_OBSTACLE_POSITIONS,
  OBSTACLE_SIZE,
  PHYSICS_SPHERE_RADIUS,
} from "../config";

export const modelFollowTick = (
  model: ComplexModel,
  state: PathFollowState,
  speed: number,
  delta: number
): PathFollowResult => {
  const result = logicAdvanceAlongPath(state, speed, delta);
  model.position.set(result.position.x, result.position.y, result.position.z);
  model.rotation.y = result.rotation;
  return result;
};

/**
 * Physics-mode path following: kinematic body moved via the Rapier
 * CharacterController so that static obstacle colliders deflect the ball
 * instead of letting it pass through.
 *
 * Returns the updated PathFollowState and an isComplete flag.
 */
export const modelFollowPhysicsTick = (
  model: ComplexModel,
  state: PathFollowState,
  speed: number,
  delta: number
): { state: PathFollowState; isComplete: boolean } => {
  const body = model.userData?.body as RAPIER.RigidBody | undefined;
  const collider = model.userData?.collider as RAPIER.Collider | undefined;
  const cc = model.userData?.characterController as
    | RAPIER.KinematicCharacterController
    | undefined;

  if (!body) return { state, isComplete: state.currentIndex >= state.waypoints.length - 1 };

  const { waypoints, currentIndex } = state;

  if (currentIndex >= waypoints.length - 1) {
    return { state, isComplete: true };
  }

  const target = waypoints[currentIndex + 1];
  const pos = body.translation();

  const dx = target.x - pos.x;
  const dz = target.z - pos.z;
  const distribution = Math.hypot(dx, dz);

  // Advance to next waypoint when close enough
  if (distribution < 0.4) {
    model.position.set(pos.x, pos.y, pos.z);
    return {
      state: { waypoints, currentIndex: currentIndex + 1, progress: 0 },
      isComplete: currentIndex + 1 >= waypoints.length - 1,
    };
  }

  const invDistribution = 1 / distribution;
  const stepX = dx * invDistribution * speed * delta;
  const stepZ = dz * invDistribution * speed * delta;

  let nextX: number;
  let nextZ: number;

  if (cc && collider) {
    // Let the character controller resolve collisions before applying movement.
    // Only avoid fixed/static bodies — dynamic (green) cubes are excluded so the
    // kinematic ball can push them instead of sliding around them.
    cc.computeColliderMovement(collider, { x: stepX, y: 0, z: stepZ }, undefined, undefined,
      (otherCollider: RAPIER.Collider) => !otherCollider.parent()?.isDynamic()
    );
    const m = cc.computedMovement();
    nextX = pos.x + m.x;
    nextZ = pos.z + m.z;
  } else {
    nextX = pos.x + stepX;
    nextZ = pos.z + stepZ;
  }

  // Set kinematic target for next physics step and immediately mirror to mesh
  // (body.translation() still returns the OLD position until world.step() runs)
  body.setNextKinematicTranslation({ x: nextX, y: pos.y, z: nextZ }, true);
  model.position.set(nextX, pos.y, nextZ);
  model.rotation.y = Math.atan2(dx, dz);

  return { state, isComplete: false };
};

/** Syncs a kinematic Rapier body to the model's current mesh position (mesh mode). */
export const modelFollowSyncPhysicsBody = (model: ComplexModel): void => {
  const body = model.userData?.body as RAPIER.RigidBody | undefined;
  if (!body) return;
  const { x, y, z } = model.position;
  body.setNextKinematicTranslation({ x, y, z }, true);
};

export const modelFollowPlayWalkAnimation = (
  model: ComplexModel,
  delta: number,
  speed: number = 3
): void => {
  const actionName =
    Object.keys(model.userData?.actions ?? {})[0] ??
    GOOMBA_ANIMATION_FALLBACK_NAME;
  updateAnimation({ actionName, player: model, delta, speed });
};

export const modelFollowPlayIdleAnimation = (
  model: ComplexModel,
  delta: number
): void => {
  const actionName =
    Object.keys(model.userData?.actions ?? {})[0] ??
    GOOMBA_ANIMATION_FALLBACK_NAME;
  updateAnimation({ actionName, player: model, delta, speed: 0.5 });
};

export const modelFollowUpdateMixer = (
  model: ComplexModel,
  delta: number
): void => {
  const mixer = model.userData?.mixer as THREE.AnimationMixer | undefined;
  if (mixer) mixer.update(delta);
};

/**
 * Spawn dynamic (pushable) green cubes for physics/goomba modes.
 * Using origin:{} disables the bottom-pivot offset so position is cube center,
 * which aligns the visual and physics collider (both centered at position.y).
 */
export const modelFollowSpawnDynamicObstacles = (
  scene: THREE.Scene,
  world: RAPIER.World
): ComplexModel[] =>
  DYNAMIC_OBSTACLE_POSITIONS.map((position) =>
    getCube(scene, world, {
      size: OBSTACLE_SIZE,
      color: DYNAMIC_OBSTACLE_COLOR,
      position,
      origin: {},
      type: "dynamic",
      restitution: 0.2,
      friction: 1.0,
      castShadow: true,
      receiveShadow: true,
    })
  );

/**
 * Spawn fixed (static, immovable) red cubes for physics/goomba modes.
 * Using origin:{} so position is cube center — visually touches ground at y=0.75.
 */
export const modelFollowSpawnFixedObstacles = (
  scene: THREE.Scene,
  world: RAPIER.World
): ComplexModel[] =>
  FIXED_OBSTACLE_POSITIONS.map((position) =>
    getCube(scene, world, {
      size: OBSTACLE_SIZE,
      color: FIXED_OBSTACLE_COLOR,
      position,
      origin: {},
      type: "fixed",
      castShadow: true,
      receiveShadow: true,
    })
  );

/** Sync dynamic obstacle mesh positions/rotations from their Rapier physics bodies each frame. */
export const modelFollowSyncDynamicObstacles = (obstacles: ComplexModel[]): void => {
  obstacles.forEach((obs) => {
    const body = obs.userData?.body as RAPIER.RigidBody | undefined;
    if (body && body.isDynamic()) {
      const t = body.translation();
      obs.position.set(t.x, t.y, t.z);
      const r = body.rotation();
      obs.quaternion.set(r.x, r.y, r.z, r.w);
    }
  });
};

/**
 * Proximity-based impulse: world.contactPairsWith does not reliably report contacts
 * between kinematic and dynamic bodies. Instead, measure the XZ distance from the
 * ball centre to each dynamic cube centre and apply an impulse when within range.
 */
export const modelFollowApplyContactImpulses = (
  ball: ComplexModel,
  obstacles: ComplexModel[],
  speed: number,
  delta: number
): void => {
  const bp = ball.position;
  // Collision radius = sphere radius + half the cube's XZ extent
  const threshold = PHYSICS_SPHERE_RADIUS + OBSTACLE_SIZE[0] / 2;
  const thresholdSq = threshold * threshold;

  obstacles.forEach((obs) => {
    const body = obs.userData?.body as RAPIER.RigidBody | undefined;
    if (!body?.isDynamic()) return;

    const cp = body.translation();
    const dx = cp.x - bp.x;
    const dz = cp.z - bp.z;
    const distributionSq = dx * dx + dz * dz;
    if (distributionSq > thresholdSq || distributionSq < 0.0001) return;

    const distribution = Math.sqrt(distributionSq);
    const inv = 1 / distribution;
    const mag = speed * delta;
    body.applyImpulse({ x: dx * inv * mag, y: 0, z: dz * inv * mag }, true);
  });
};

/** Remove all obstacle meshes and their physics bodies from the scene. */
export const modelFollowClearObstacles = (
  scene: THREE.Scene,
  world: RAPIER.World,
  obstacles: ComplexModel[]
): void => {
  obstacles.forEach((obs) => {
    scene.remove(obs);
    const body = obs.userData?.body as RAPIER.RigidBody | undefined;
    if (body) world.removeRigidBody(body);
    obs.geometry.dispose();
    (obs.material as THREE.Material).dispose();
  });
};
