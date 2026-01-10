---
sidebar_position: 4
---

# Package: @webgamekit/game

Reactive game state management system that works with any UI framework.

## Installation

```bash
pnpm add @webgamekit/game
```

## Basic Usage

```typescript
import { createGame } from '@webgamekit/game';

const game = createGame({
  score: 0,
  lives: 3,
  level: 1
});

// Update state
game.setData('score', 100);
game.setStatus('playing');

// Access state
console.log(game.data.score); // 100
console.log(game.status); // 'playing'
```

## API Reference

### createGame(initialConfig, bindTo?, cleanupHook?)

Creates a new game state manager.

**Parameters**:
- `initialConfig`: Initial game data as key-value pairs
- `bindTo`: Optional reactive reference (Vue ref, React state setter)
- `cleanupHook`: Optional cleanup function for garbage collection

**Returns**: `GameState` object

### GameState

```typescript
interface GameState {
  status: GameStatus;
  data: Record<string, any>;
  setData: (key: string, value: any) => void;
  setStatus: (status: GameStatus) => void;
}
```

### GameStatus

```typescript
type GameStatus = 'idle' | 'playing' | 'paused' | 'gameover' | 'win';
```

## Framework Integration

### Vue 3

```vue
<script setup lang="ts">
import { shallowRef, onUnmounted } from 'vue';
import { createGame, type GameState } from '@webgamekit/game';

const gameState = shallowRef<GameState>();

const game = createGame(
  { score: 0, lives: 3 },
  gameState,
  onUnmounted
);

const startGame = () => {
  game.setStatus('playing');
};

const addScore = (points: number) => {
  game.setData('score', game.data.score + points);
};
</script>

<template>
  <div v-if="gameState">
    <p>Score: {{ gameState.data.score }}</p>
    <p>Lives: {{ gameState.data.lives }}</p>
    <p>Status: {{ gameState.status }}</p>
    <button @click="startGame">Start</button>
  </div>
</template>
```

### React

```tsx
import { useState, useEffect } from 'react';
import { createGame, type GameState } from '@webgamekit/game';

function GameComponent() {
  const [gameState, setGameState] = useState<GameState>();

  useEffect(() => {
    const game = createGame(
      { score: 0, lives: 3 },
      { value: gameState, set: setGameState }
    );
    
    return () => {
      // Cleanup
    };
  }, []);

  return (
    <div>
      <p>Score: {gameState?.data.score}</p>
      <p>Status: {gameState?.status}</p>
    </div>
  );
}
```

## State Management Patterns

### Centralized Game Logic

```typescript
const game = createGame({
  score: 0,
  lives: 3,
  level: 1,
  enemies: [],
  powerups: []
});

// Game actions
const actions = {
  hit: () => {
    const lives = game.data.lives - 1;
    game.setData('lives', lives);
    if (lives <= 0) {
      game.setStatus('gameover');
    }
  },
  
  collect: (points: number) => {
    game.setData('score', game.data.score + points);
  },
  
  nextLevel: () => {
    game.setData('level', game.data.level + 1);
    game.setData('enemies', []);
  },
  
  reset: () => {
    game.setData('score', 0);
    game.setData('lives', 3);
    game.setData('level', 1);
    game.setStatus('idle');
  }
};
```

### With Three.js Scene

```typescript
import { getTools } from '@webgamekit/threejs';
import { createGame } from '@webgamekit/game';

const game = createGame({
  score: 0,
  playerHealth: 100,
  enemiesKilled: 0
});

const { animate } = await getTools({ canvas });

animate({
  beforeTimeline: () => {
    // Check game conditions
    if (game.data.playerHealth <= 0) {
      game.setStatus('gameover');
    }
  },
  timeline: [
    {
      id: 'score-tick',
      every: 60,
      do: () => {
        if (game.status === 'playing') {
          game.setData('score', game.data.score + 1);
        }
      }
    }
  ]
});
```

## Best Practices

### Use shallowRef in Vue

For performance, use `shallowRef` instead of `ref`:

```typescript
// ✅ Good - shallow reactivity
const gameState = shallowRef<GameState>();

// ❌ Avoid - deep reactivity overhead
const gameState = ref<GameState>();
```

### Separate UI from Game Logic

Keep game logic in the state manager, UI in components:

```typescript
// game.ts
export const game = createGame({ score: 0 });
export const addScore = (n: number) => game.setData('score', game.data.score + n);

// Component.vue
import { game, addScore } from './game';
```

### Type Your Game Data

```typescript
interface MyGameData {
  score: number;
  lives: number;
  level: number;
  inventory: string[];
}

const game = createGame<MyGameData>({
  score: 0,
  lives: 3,
  level: 1,
  inventory: []
});
```
