import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { Timeline, Direction, AnimatedComplexModel, ComplexModel, Model } from './types';

export * from './types';

/**
 * 
 * @param element THREE mesh
 * @param timeline List of actions to perform
 * @param frame Current frame (to do not confuse with delta as for animation)
 * @example
 * // Sequence of 3 animations
  { start: 0, end: 100, action: (mesh) => { mesh.rotation.x += 0.01; } },
  { start: 100, end: 200, action: (mesh) => { mesh.rotation.y += 0.01; } },
  { start: 200, end: 300, action: (mesh) => { mesh.rotation.z += 0.01; } },
  
  // Alternated animations
  { interval: [100, 100], action: (mesh) => { mesh.rotation.y += 0.01; } },
  { delay: 100, interval: [100, 100], action: (mesh) => { mesh.rotation.z += 0.01; } },
 */
const animateTimeline = <T>(timeline: Timeline[], frame: number, args?: T) => {
  timeline.forEach(({ start, end, frequency, delay, interval, action, actionStart }) => {
    let cycle = 0;
    let frameCycle = 0;
    let loop = 0;
    if (start && frame < start) return;
    if (end && frame > end) return;
    if (delay && frame < delay) return;
    if (interval) {
      const [length, pause] = interval;
      cycle = length + pause;
      frameCycle = (frame - (delay ?? 0) + (start ?? 0)) % cycle;
      loop = frame / cycle;
      if (frameCycle >= length) return;
    }

    if (!frequency || (frequency && frame % frequency === 0)) {
      if (actionStart && frameCycle === 0) {
        actionStart(loop, args);
      }
      if (action) action(args)
    }
  });
}

/**
  * Generate a Timeline from a given loop
  * Example:
    const myLoop = {
      loop: 0,
      length: 30,
      action: (direction) => console.log(direction),
      list: [
        [3, forward'],
        [3, left'],
        [1, jump'],
        [3, right'],
        [3, forward'],
      ]
    }
  * @param loop 
  */
const getTimelineLoopModel = ({ loop, length, action, list }: {
    loop: number, // 0 === infinite
    length: number,
    action: (args: any) => void,
    list: [number, Direction][] // [steps, direction]
}): Timeline[] => {
  const total = list.reduce((acc, [step]) => acc + step * length, 0);
  return list.reduce((timeline, [step, args], index) => {
    const partial = loop > 0
      ? {
        from: total,
        to: total + step * length,
      }
      : {
        interval: [step * length, total],
        delay: timeline[index - 1] ? timeline[index - 1].interval![0] : 0,
      };
    
      return [
      ...timeline,
      {
        ...partial,
        action: () => action(args),
      }
    ] as Timeline[];
  }, [] as Timeline[]);
}

const isGrounded = (rigidBody: RAPIER.RigidBody, world: RAPIER.World, elements: AnimatedComplexModel[]): boolean => {
  const originPosition = rigidBody.translation();
  const maxToi = 4.0;
  const solid = true;
  
  return elements.some((model) => {
    const { rigidBody } = model;
    const position = rigidBody.translation();
    const ray = new RAPIER.Ray(
      { x: originPosition.x, y: 3, z: originPosition.z }, // Origin
      position, // Direction (ground)
    );

    const hit = world.castRay(ray, maxToi, solid);
    if (hit) {
      const hitPoint = ray.pointAt(hit.timeOfImpact);
      const distance = originPosition.y - hitPoint.y;
      return distance < 0.00
    }

    return false
  })
}

/**
 * Bind physic to models to animate them
 * @param elements 
 */
const bindAnimatedElements = (elements: AnimatedComplexModel[], world: RAPIER.World, delta: number) => {
  elements.forEach((model: AnimatedComplexModel) => {
    const { mesh, rigidBody, helper, type, hasGravity } = model;
    if (type === 'fixed') return;
    if (type === 'kinematicPositionBased') {
      const grounded = isGrounded(rigidBody, world, elements);
      const gravity = hasGravity && !grounded ? -9.8 * delta -1 : 0;
      mesh.position.y += gravity;
      rigidBody.setNextKinematicTranslation(mesh.position);
    } else {
      const position = rigidBody.translation();
      mesh.position.set(position.x, position.y, position.z);
      const rotation = rigidBody.rotation();
      mesh.rotation.set(rotation.x, rotation.y, rotation.z);
    }

    if (helper) {
      // @ts-ignore
      helper.update();
    }
  });
}

/**
 * Reset models and bodies to their initial state (position, rotation, forces, and torques)
 * @param elements 
 */
const resetAnimation = (elements: ComplexModel[]) => {
  elements.forEach(({ rigidBody, initialValues: { position: [x, y, z]} }) => {
    rigidBody.resetForces(true);
    rigidBody.resetTorques(true);
    rigidBody.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    rigidBody.setTranslation({ x, y, z }, true);
  });

  return elements;
}

const getAnimationsModel = (mixer: THREE.AnimationMixer, model: Model, gltf: any) => {
  // Flip the model
  model.rotateOnAxis(new THREE.Vector3(0, 1, 0), Math.PI)
  return {
    run: mixer.clipAction(gltf.animations[0]),
  }
}

/**
 * Update the animation of the model based on given time
 */
const updateAnimation = (
  mixer: THREE.AnimationMixer,
  action: THREE.AnimationAction,
  delta: number = 0,
  speed: number = 0,
) => {
  const coefficient = 0.1
  if (!action) return
  if (delta) {
    mixer.update(delta * speed * coefficient)
    action.play()
  } else {
    action.stop()
  }
}

/**
 * Move forward or backward if no collision is detected
 * @param player
 * @param dynamicBodies
 * @param distance
 * @param backwards
 */
const controllerForward = (
  model: AnimatedComplexModel,
  bodies: ComplexModel[],
  distance: number,
  delta: number,
  actionName: string = 'run',
  backwards: boolean = false
) => {
  const collision = 10
  const oldPosition = model.mesh.position.clone() // Clone the current position

  // Calculate the forward vector
  const forward = new THREE.Vector3()
  model.mesh.getWorldDirection(forward)
  if (backwards) {
    forward.negate()
  }
  forward.multiplyScalar(distance)

  // Create a new position by adding the forward vector to the old position
  const newPosition = oldPosition.clone().add(forward)

  // Create a raycaster
  const raycaster = new THREE.Raycaster(oldPosition, forward.normalize(), 0, collision);

  // Check for intersections with the new position
  const intersects = raycaster.intersectObjects(bodies.map(body => body.mesh), true);

  if (intersects.length === 0) {
    // Update the model's position and the rigid body's translation if no collision is detected
    model.mesh.position.copy(newPosition);
    model.rigidBody.setTranslation(newPosition, true);
  }

  if (model.actions[actionName]) {
    updateAnimation(model.mixer, model.actions[actionName], delta, 10)
  }
}

const controllerJump = (
  model: AnimatedComplexModel,
  _bodies: ComplexModel[],
  _distance: number,
  height: number,
) => {
  model.mesh.position.y = model.mesh.position.y + height;
}

/**
 * Rotate model on defined angle
 * @param model 
 * @param angle angle in degrees
 */
const controllerTurn = (
  model: ComplexModel,
  angle: number,
) => {
  const { mesh } = model
  const radians = THREE.MathUtils.degToRad(angle);
  mesh.rotateOnAxis(new THREE.Vector3(0, 1, 0), radians);
};

const bodyJump = (
  model: AnimatedComplexModel,
  bodies: ComplexModel[],
  distance: number,
  height: number,
) => {
  const collision = 27
  const oldPosition = model.mesh.position.clone() // Clone the current position

  // Calculate the forward vector
  const forward = new THREE.Vector3()
  model.mesh.getWorldDirection(forward)
  forward.multiplyScalar(distance)

  // Create an upward vector
  const upward = new THREE.Vector3(0, height, 0)

  // Create a new position by adding the forward and upward vectors to the old position
  const newPosition = oldPosition.clone().add(upward)

  // Check for collisions with the new position
  const isColliding = bodies.some(({ mesh }) => {
    const difference = mesh.position.distanceTo(newPosition)
    return difference < collision // Adjust this value based on your collision detection needs
  })

  if (!isColliding) {
    // Update the model's position and the rigid body's translation if no collision is detected
    model.mesh.position.copy(newPosition)
    model.rigidBody.setTranslation(newPosition, true)
  }
}

export {
  animateTimeline,
  getTimelineLoopModel,
  bindAnimatedElements,
  resetAnimation,
  getAnimationsModel,
  updateAnimation,
  controllerForward,
  controllerJump,
  controllerTurn,
  bodyJump,
};
