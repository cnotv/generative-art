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

The timeline system allows you to define frame-based animations with intervals, delays, and frequency controls.

### Basic Usage

```typescript
import { animateTimeline } from '@webgamekit/animation';

// In your animation loop
animate({
  timeline: [
    {
      id: 'rotate',
      every: 1,  // Every frame
      do: () => {
        mesh.rotation.y += 0.01;
      }
    },
    {
      id: 'spawn',
      every: 60,  // Every 60 frames
      do: () => {
        spawnEnemy();
      }
    }
  ]
});
```

### Timeline Options

```typescript
interface Timeline {
  id?: string;           // Unique identifier
  start?: number;        // Start frame
  end?: number;          // End frame
  frequency?: number;    // Execute every N frames
  delay?: number;        // Delay before starting
  interval?: [number, number];  // [active, pause] frame counts
  action?: (args?: T) => void;  // Main action
  actionStart?: (loop: number, args?: T) => void;  // Called at interval start
}
```

### Interval Animations

Create animations that alternate between active and paused states:

```typescript
const timeline = [
  // Active for 100 frames, pause for 50 frames, repeat
  {
    interval: [100, 50],
    action: () => {
      enemy.move();
    },
    actionStart: (loop) => {
      console.log(`Starting loop ${loop}`);
    }
  }
];
```

### Sequenced Animations

```typescript
const timeline = [
  // First animation: frames 0-100
  { start: 0, end: 100, action: () => mesh.rotation.x += 0.01 },
  
  // Second animation: frames 100-200
  { start: 100, end: 200, action: () => mesh.rotation.y += 0.01 },
  
  // Third animation: frames 200-300
  { start: 200, end: 300, action: () => mesh.rotation.z += 0.01 },
];
```

## Physics-Based Movement

Utilities for moving characters with Rapier physics.

### moveCharacter

Apply movement to a physics body based on direction.

```typescript
import { moveCharacter, Direction } from '@webgamekit/animation';

// In animation loop
moveCharacter(playerBody, {
  direction: Direction.Forward,
  speed: 5,
  deltaTime: delta
});
```

### Direction Enum

```typescript
enum Direction {
  Forward = 'forward',
  Backward = 'backward',
  Left = 'left',
  Right = 'right',
  Up = 'up',
  Down = 'down'
}
```

## Types

### CoordinateTuple

Standard type for 3D coordinates:

```typescript
type CoordinateTuple = [number, number, number];

// Usage
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
  };
}
```

## Integration Example

Complete example using animation with Three.js:

```typescript
import { getTools } from '@webgamekit/threejs';
import { animateTimeline, Direction, moveCharacter } from '@webgamekit/animation';

const { setup, animate, world } = await getTools({ canvas });

await setup({
  config: { /* ... */ },
  defineSetup: async () => {
    // Create player with physics
  }
});

animate({
  beforeTimeline: () => {
    // Handle input
    if (keys.w) {
      moveCharacter(player.userData.body, {
        direction: Direction.Forward,
        speed: 5
      });
    }
  },
  timeline: [
    {
      id: 'enemy-spawn',
      every: 120,
      do: () => spawnEnemy()
    },
    {
      id: 'score-update',
      every: 60,
      do: () => updateScore()
    }
  ]
});
```
