---
sidebar_position: 10
---

# Rapier Physics Bodies

Rapier exposes four body types, each with a different relationship between physics simulation and manual control. Picking the wrong one is the most common source of unexpected movement and collision behaviour.

## Body Types

### Dynamic

Fully simulated. Rapier integrates forces, velocity, and gravity every step. Position and rotation are owned by the physics engine — writing to them directly has no effect mid-simulation.

Use for: projectiles, falling objects, destructible props, anything that should react to collisions and gravity.

```ts
const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
  .setTranslation(x, y, z);
const body = world.createRigidBody(rigidBodyDesc);
```

### Fixed

Never moves, never responds to forces or collisions. Acts as an immovable surface.

Use for: terrain, walls, platforms, any static geometry.

```ts
const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed()
  .setTranslation(x, y, z);
```

### Kinematic (position-based)

Moved by setting its next translation/rotation directly each frame. Rapier computes the implied velocity from the delta and uses it to push dynamic bodies out of the way.

Use for: moving platforms, elevators, doors — things driven by animation or code rather than physics forces.

```ts
const rigidBodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased();
const body = world.createRigidBody(rigidBodyDesc);

// Every frame:
body.setNextKinematicTranslation({ x, y, z });
```

**Gotcha**: kinematic bodies do not respond to gravity or impulses. If you apply a force to them nothing happens — you must move them yourself.

### Character Controller

Not a body type in Rapier — it is a separate `CharacterController` object layered on top of a kinematic body. It handles:

- Sliding along surfaces instead of stopping on contact
- Step climbing (small ledges below `maxStepHeight`)
- Ground detection and snap-to-ground
- Slope limits

```ts
const controller = world.createCharacterController(0.01); // offset from collider
controller.setMaxSlopeClimbAngle((45 * Math.PI) / 180);
controller.setMinSlopeSlideAngle((30 * Math.PI) / 180);
controller.enableSnapToGround(0.5);

// Every frame:
const movement = { x: dx, y: dy, z: dz };
controller.computeColliderMovement(collider, movement);
const corrected = controller.computedMovement();
body.setNextKinematicTranslation({
  x: body.translation().x + corrected.x,
  y: body.translation().y + corrected.y,
  z: body.translation().z + corrected.z,
});
```

## Issues Encountered

### Dynamic body tunnelling through thin geometry

Fast-moving dynamic bodies can pass through thin colliders in a single physics step (tunnelling). Fix: enable continuous collision detection (CCD) on the body.

```ts
RAPIER.RigidBodyDesc.dynamic().setCcdEnabled(true);
```

### Kinematic body not pushing dynamic bodies

A kinematic body pushes dynamic bodies only if it moves via `setNextKinematicTranslation` / `setNextKinematicRotation`. Moving it with `setTranslation` (the teleport API) skips the velocity computation and dynamic bodies are not pushed — they are simply overlapped and then ejected next step with a jolt.

### Character controller ignoring slope limit

The slope angle is in radians, not degrees. A common mistake is passing degrees directly:

```ts
// wrong — 45 is treated as ~2578°, effectively no limit
controller.setMaxSlopeClimbAngle(45);

// correct
controller.setMaxSlopeClimbAngle((45 * Math.PI) / 180);
```

### Ground detection returning false on flat terrain

`controller.computedGrounded()` checks whether the last `computeColliderMovement` call ended with the collider touching the ground. If the character is already standing still and no downward movement is requested, the controller reports not grounded. Fix: always include a small downward component in the movement vector (gravity or a snap force) so the ground check fires every frame.

```ts
const gravity = grounded ? 0 : accumulatedFallSpeed;
const movement = { x: dx, y: -gravity, z: dz };
```

### Three.js frame rate vs Rapier step rate

Three.js renders as fast as `requestAnimationFrame` allows (typically 60 or 120 fps, variable). Rapier expects to be stepped at a **fixed, consistent rate** — usually 60 Hz. Running Rapier's `world.step()` at the raw render delta causes physics to behave differently at different frame rates: a character jumps higher at 30 fps than at 120 fps because each step integrates more velocity.

**Fix — fixed timestep with accumulator**:

```ts
const PHYSICS_STEP = 1 / 60;
let accumulator = 0;

// In the animation loop:
accumulator += delta;
while (accumulator >= PHYSICS_STEP) {
  world.step();
  accumulator -= PHYSICS_STEP;
}
```

The accumulator absorbs render-rate jitter and fires as many physics steps per frame as needed to stay caught up. At 60 fps, it fires once per frame. At 30 fps, it fires twice. At 120 fps, it fires every other frame.

**Interpolation for smooth visuals**: at sub-step render rates the visual position of a physics object snaps between steps. Fix by lerping the mesh position between the previous and current physics position using the accumulator remainder as the alpha:

```ts
const alpha = accumulator / PHYSICS_STEP;
mesh.position.lerpVectors(previousPosition, currentPosition, alpha);
```

**Timeline integration**: the project's `TimelineManager` supports per-action update frequencies (every N frames). Physics actions should declare their own step frequency and never share the delta with the render-rate actions.

### Reactive proxy breaking `instanceof` checks in Rapier

Storing a Rapier `RigidBody` or `Collider` inside a Vue `reactive()` object wraps it in a Proxy. Rapier's internal WASM bindings use `instanceof` to identify its own objects and fail silently when they receive a Proxy instead. Always use `markRaw` or `toRaw` before passing Rapier objects to physics API calls — the same rule applies as for Three.js objects.
