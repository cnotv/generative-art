---
sidebar_position: 3
---

# Package: @webgamekit/animation

Animation utilities for Three.js scenes, including timeline-based animations and physics-based character movement.

## Installation

```bash
pnpm add @webgamekit/animation
```

## Timeline System

The timeline system allows you to define named actions and run them per-frame via a `TimelineManager`.

### Basic Usage

```typescript
import { createTimelineManager } from '@webgamekit/animation';

const timeline = createTimelineManager();

timeline.addAction({
  id: 'rotate',
  action: (delta) => {
    mesh.rotation.y += 0.01;
  }
});

timeline.addAction({
  id: 'enemy-ai',
  frequency: 2, // every 2 frames
  action: () => {
    updateEnemyAI();
  }
});

// Pass to animate()
animate({ timeline });
```

### Timeline Action Options

```typescript
interface Timeline {
  id?: string;           // Unique identifier
  start?: number;        // Start frame
  end?: number;          // End frame
  duration?: number;     // Duration in frames (alternative to end)
  frequency?: number;    // Execute every N frames
  delay?: number;        // Delay before starting
  interval?: [number, number];  // [active, pause] frame counts
  priority?: number;     // Execution order (higher = first)
  enabled?: boolean;     // Toggle action on/off
  action?: (args?: T) => void;  // Main action callback
  actionStart?: (loop: number, args?: T) => void;  // Called at interval start
  onComplete?: () => void;  // Called when end/duration is reached
}
```

### TimelineManager API

```typescript
const timeline = createTimelineManager();

// Add a named action
timeline.addAction({ id: 'my-action', action: () => {} });

// Remove by id
timeline.removeAction('my-action');

// Toggle enabled state
timeline.setActionEnabled('my-action', false);

// Get all actions
timeline.getTimeline();
```

### Interval Animations

Create animations that alternate between active and paused states:

```typescript
timeline.addAction({
  id: 'patrol',
  interval: [100, 50], // Active for 100 frames, pause for 50 frames
  action: () => { enemy.move(); },
  actionStart: (loop) => { console.log(`Patrol loop ${loop}`); }
});
```

### Sequenced Animations

```typescript
timeline.addAction({ id: 'phase-1', start: 0, end: 100, action: () => mesh.rotation.x += 0.01 });
timeline.addAction({ id: 'phase-2', start: 100, end: 200, action: () => mesh.rotation.y += 0.01 });
timeline.addAction({ id: 'phase-3', start: 200, end: 300, action: () => mesh.rotation.z += 0.01 });
```

## Physics-Based Movement

Utilities for moving characters with Rapier physics character controllers.

### controllerForward

Move a character controller forward/backward with collision detection and step climbing.

```typescript
import { controllerForward } from '@webgamekit/animation';

// In animation loop
controllerForward(obstacles, groundBodies, {
  player: playerModel,
  actionName: 'walk',
  delta: delta,
  distance: PLAYER_SPEED * delta,
}, {
  requireGround: false,
  maxGroundDistance: 5,
  maxStepHeight: 0.5,
  characterRadius: 2,
  collisionDistance: 2,
});
```

### moveCharacter

Teleport a model to a specific world position (syncs both Three.js mesh and Rapier body).

```typescript
import { moveCharacter } from '@webgamekit/animation';

// Snap model to position (bypasses physics simulation)
moveCharacter(playerModel, new THREE.Vector3(0, 0, 0));
```

## Rotation Utilities

Functions for directional input to rotation conversion, useful for 8-directional character movement.

### getRotation

Calculate target rotation based on directional input actions. Returns rotation in degrees for cardinal (0°, 90°, 180°, 270°) and diagonal (45°, 135°, 225°, 315°) directions.

```typescript
import { getRotation } from '@webgamekit/animation';

// currentActions is typically from createControls()
const targetRotation = getRotation(currentActions);
// Returns: number | null
// - 0: move-up (W) - faces -Z
// - 180: move-down (S) - faces +Z
// - 90: move-left (A) - faces -X
// - 270: move-right (D) - faces +X
// - null: no movement or opposing directions cancel
```

**Expected action keys:**

- `move-up`: Forward movement (typically W key)
- `move-down`: Backward movement (typically S key)
- `move-left`: Left strafe (typically A key)
- `move-right`: Right strafe (typically D key)

### setRotation

Set the model's Y-axis rotation to face a specific direction.

```typescript
import { setRotation, getRotation } from '@webgamekit/animation';

const targetRotation = getRotation(currentActions);
if (targetRotation !== null) {
  setRotation(player, targetRotation);
}
```

### Usage Example: 8-Directional Movement

```typescript
import { getRotation, setRotation, controllerForward, createTimelineManager } from '@webgamekit/animation';
import { createControls } from '@webgamekit/controls';

const { currentActions } = createControls(controlBindings);
const timeline = createTimelineManager();

timeline.addAction({
  id: 'player-movement',
  action: () => {
    const targetRotation = getRotation(currentActions);
    const isMoving = targetRotation !== null;

    if (isMoving) {
      setRotation(player, targetRotation);
      controllerForward(obstacles, groundBodies, {
        player,
        actionName: 'walk',
        delta,
        distance: speed * delta,
      });
    }
  },
});

animate({ timeline });
```

## Model Animation

### updateAnimation

Switch animation clips on a model loaded with `getModel`.

```typescript
import { updateAnimation } from '@webgamekit/animation';

// Switch to walk animation
updateAnimation(playerModel, 'walk');

// Switch to idle
updateAnimation(playerModel, 'idle');
```

### getAnimationsModel

Load a model with multiple animation files.

```typescript
import { getAnimationsModel } from '@webgamekit/animation';

const player = await getAnimationsModel(scene, world, 'character.fbx', {
  animationFiles: ['walk.fbx', 'idle.fbx', 'run.fbx'],
  position: [0, 0, 0],
  scale: [1, 1, 1],
});
```

## Pop-Up Animations

Utility functions for entrance/exit animations on 3D objects.

```typescript
import { createPopUpBounce, createPopUpFade, createPopUpScale } from '@webgamekit/animation';

// Bounce in from below
const bounceAction = createPopUpBounce(mesh, { duration: 30, height: 2 });
timeline.addAction(bounceAction);

// Fade in
const fadeAction = createPopUpFade(mesh, { duration: 20 });
timeline.addAction(fadeAction);
```

## Types

### AnimationData

```typescript
interface AnimationData {
  player: ComplexModel;
  actionName: string;
  delta: number;
  distance?: number;
  backward?: boolean;
}
```

### CoordinateTuple

```typescript
type CoordinateTuple = [number, number, number];

const position: CoordinateTuple = [0, 5, 10];
const rotation: CoordinateTuple = [0, Math.PI, 0];
```

### Model Types

```typescript
// Basic Three.js mesh with physics
interface Model extends THREE.Mesh {
  userData: {
    body?: RAPIER.RigidBody;
  };
}

// Model with additional physics data
interface ComplexModel extends Model {
  userData: {
    body: RAPIER.RigidBody;
    collider: RAPIER.Collider;
    characterController?: RAPIER.KinematicCharacterController;
  };
}
```
