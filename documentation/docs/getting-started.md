---
sidebar_position: 1
---

# Getting Started

Welcome to **WebGameKit** - a framework-agnostic toolkit for creating 3D games, environments, and generative art with Three.js and Rapier physics.

## Quick Start

### Installation

```bash
git clone https://github.com/cnotv/generative-art.git
cd generative-art
pnpm install
```

### Development

```bash
# Start development server
pnpm dev

# Run tests
pnpm test:unit

# Build for production
pnpm build

# View documentation
cd documentation && pnpm start
```

## Packages

### [@webgamekit/threejs](./packages/threejs.md)

Core 3D engine with Three.js and Rapier physics integration.

```typescript
import { getTools } from '@webgamekit/threejs';

const { setup, animate, scene, camera, world } = await getTools({ canvas });
```

### [@webgamekit/controls](./packages/controls.md)

Multi-input controller supporting keyboard, gamepad, touch, and mouse.

```typescript
import { createControls } from '@webgamekit/controls';

const { currentActions } = createControls({
  mapping: { keyboard: { w: 'move-forward' } }
});
```

### [@webgamekit/animation](./packages/animation.md)

Timeline-based animation system and physics-based character movement.

```typescript
import { animateTimeline, Direction } from '@webgamekit/animation';

animateTimeline([
  { id: 'update', every: 1, do: () => updatePhysics() }
], frame);
```

### [@webgamekit/game](./packages/game.md)

Reactive game state management that works with any UI framework.

```typescript
import { createGame } from '@webgamekit/game';

const game = createGame({ score: 0, lives: 3 });
game.setData('score', 100);
game.setStatus('playing');
```

### [@webgamekit/audio](./packages/audio.md)

Audio playback utilities for games and interactive experiences.

```typescript
import { initializeAudio, createSound, playSound } from '@webgamekit/audio';

const audioContext = initializeAudio();
const sfx = createSound(audioContext, '/audio/jump.mp3');
playSound(sfx);
```

## Next Steps

- **[Monorepo Architecture](./architecture/monorepo.md)** - Understand the project structure
- **[Package Documentation](./packages/threejs.md)** - Detailed API references

## Contributing

This is a personal project, but feel free to explore the code and use it as inspiration for your own projects.
