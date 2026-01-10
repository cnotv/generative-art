---
sidebar_position: 2
---

# Package: @webgamekit/controls

Framework-agnostic multi-input controller supporting keyboard, gamepad, touch, and virtual FauxPad.

## Installation

```bash
pnpm add @webgamekit/controls
```

## Basic Usage

```typescript
import { createControls } from '@webgamekit/controls';

const { currentActions, destroyControls } = createControls({
  mapping: {
    keyboard: {
      w: 'move-forward',
      a: 'turn-left',
      d: 'turn-right',
      ' ': 'jump'
    },
    gamepad: {
      buttonA: 'jump',
      leftStickX: 'turn',
      leftStickY: 'move'
    }
  },
  onAction: (action, trigger, device) => {
    console.log(`${action} triggered by ${trigger} on ${device}`);
  }
});

// Check active actions
if (currentActions['move-forward']) {
  // Player is moving forward
}

// Cleanup on unmount
destroyControls();
```

## FauxPad (Virtual Joystick)

A virtual touch controller that interprets touch/mouse input into directional actions.

### Features

- **Framework-agnostic**: Pure TypeScript, works with any UI framework
- **Directional mapping**: Automatically converts angle to directional actions
- **4-way or 8-way directions**: Configurable direction detection modes
- **Deadzone support**: Prevent unintentional inputs with configurable deadzone
- **Visual feedback**: Automatically updates position on screen

### Usage in Vue

```vue
<script setup lang="ts">
import { createFauxPadController, type FauxPadController } from '@webgamekit/controls';
import { ref, onMounted, onUnmounted } from 'vue';

const edgeRef = ref<HTMLElement | null>(null);
const insideRef = ref<HTMLElement | null>(null);

let fauxpad: FauxPadController;

onMounted(() => {
  if (!edgeRef.value || !insideRef.value) return;

  const mappingRef = {
    current: {
      fauxpad: {
        up: 'move-forward',
        down: 'move-backward',
        left: 'turn-left',
        right: 'turn-right'
      }
    }
  };

  const handlers = {
    onAction: (action, trigger, device) => {
      console.log(`Action: ${action} from ${trigger}`);
    },
    onRelease: (action, trigger, device) => {
      console.log(`Released: ${action}`);
    }
  };

  fauxpad = createFauxPadController(mappingRef, handlers, {
    deadzone: 0.15,
    directionThreshold: 45,
    enableEightWay: false
  });

  fauxpad.bind(edgeRef.value, insideRef.value);
});

onUnmounted(() => {
  if (fauxpad && edgeRef.value && insideRef.value) {
    fauxpad.unbind(edgeRef.value, insideRef.value);
  }
});
</script>

<template>
  <div ref="edgeRef" class="fauxpad-edge">
    <div ref="insideRef" class="fauxpad-inside"></div>
  </div>
</template>
```

### Usage in React

```tsx
import { useRef, useEffect } from 'react';
import { createFauxPadController, type FauxPadController } from '@webgamekit/controls';

function FauxPad() {
  const edgeRef = useRef<HTMLDivElement>(null);
  const insideRef = useRef<HTMLDivElement>(null);
  const fauxpadRef = useRef<FauxPadController | null>(null);

  useEffect(() => {
    if (!edgeRef.current || !insideRef.current) return;

    const mappingRef = {
      current: {
        fauxpad: {
          up: 'move-forward',
          down: 'move-backward',
          left: 'turn-left',
          right: 'turn-right'
        }
      }
    };

    const handlers = {
      onAction: (action: string, trigger: string, device: string) => {
        console.log(`Action: ${action} from ${trigger}`);
      },
      onRelease: (action: string, trigger: string, device: string) => {
        console.log(`Released: ${action}`);
      }
    };

    fauxpadRef.current = createFauxPadController(mappingRef, handlers, {
      deadzone: 0.15,
      directionThreshold: 45,
      enableEightWay: false
    });

    fauxpadRef.current.bind(edgeRef.current, insideRef.current);

    return () => {
      if (fauxpadRef.current && edgeRef.current && insideRef.current) {
        fauxpadRef.current.unbind(edgeRef.current, insideRef.current);
      }
    };
  }, []);

  return (
    <div ref={edgeRef} className="fauxpad-edge">
      <div ref={insideRef} className="fauxpad-inside" />
    </div>
  );
}
```

### Using TouchControl Component

The TouchControl Vue component wraps the FauxPad controller:

```vue
<template>
  <TouchControl
    :mapping="{
      up: 'move-forward',
      down: 'move-backward',
      left: 'turn-left',
      right: 'turn-right'
    }"
    :options="{ deadzone: 0.15 }"
    @action="(action, direction) => console.log(action, direction)"
    @release="(action, direction) => console.log('released', action)"
    style="left: 25px; bottom: 25px"
  />
</template>
```

## Configuration

### FauxPadOptions

```typescript
interface FauxPadOptions {
  deadzone?: number;           // Min distance to trigger (0-1, default: 0.1)
  directionThreshold?: number;  // Angle threshold for 4-way (default: 45 degrees)
  enableEightWay?: boolean;     // Enable 8-way detection (default: false)
}
```

### Direction Detection

**4-way mode (default)**:
- 0° ± 45°: right
- 90° ± 45°: down
- 180° ± 45°: left
- 270° ± 45°: up

**8-way mode**:
- 0° - 22.5°: right
- 22.5° - 67.5°: down-right
- 67.5° - 112.5°: down
- 112.5° - 157.5°: down-left
- etc.

## API Reference

### createControls(config)

Creates a unified control system.

**Parameters**:
- `config.mapping`: Key mappings for each input device
- `config.onAction`: Callback when action is triggered
- `config.onRelease`: Callback when action is released

**Returns**:
- `currentActions`: Reactive object with active actions
- `destroyControls`: Cleanup function

### createFauxPadController(mappingRef, handlers, options?)

Returns a `FauxPadController` with:

- `bind(edgeElement, insideElement)`: Attach event listeners
- `unbind(edgeElement, insideElement)`: Remove event listeners
- `getPosition()`: Get current position state
- `reset()`: Reset to center position
- `isActive()`: Check if being used

### FauxPadPosition

```typescript
interface FauxPadPosition {
  x: number;        // Normalized X (-1 to 1)
  y: number;        // Normalized Y (-1 to 1)
  distance: number; // Distance from center (0 to 1)
  angle: number;    // Angle in degrees (0-360)
}
```

## Examples

### Vue Examples

#### Game Movement Control

```vue
<TouchControl
  :mapping="{ up: 'moving', left: 'turn-left', right: 'turn-right' }"
  :options="{ deadzone: 0.15 }"
  @action="(action) => currentActions[action] = true"
  @release="(action) => currentActions[action] = false"
  style="left: 25px; bottom: 25px"
/>
```

#### Jump Button

```vue
<TouchControl
  :mapping="{ up: 'jump', down: 'jump', left: 'jump', right: 'jump' }"
  :options="{ deadzone: 0.1 }"
  @action="handleJump"
  style="right: 25px; bottom: 25px"
/>
```

#### 8-Way Movement

```vue
<TouchControl
  :mapping="{
    up: 'move-up',
    down: 'move-down',
    left: 'move-left',
    right: 'move-right'
  }"
  :options="{ enableEightWay: true, deadzone: 0.2 }"
  style="left: 25px; bottom: 25px"
/>
```

### React Examples

#### Game Movement Control

```tsx
import { useRef, useEffect, useState } from 'react';
import { createFauxPadController } from '@webgamekit/controls';

function GameControls() {
  const edgeRef = useRef<HTMLDivElement>(null);
  const insideRef = useRef<HTMLDivElement>(null);
  const [actions, setActions] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!edgeRef.current || !insideRef.current) return;

    const mappingRef = {
      current: {
        fauxpad: { up: 'moving', left: 'turn-left', right: 'turn-right' }
      }
    };

    const fauxpad = createFauxPadController(mappingRef, {
      onAction: (action) => setActions(prev => ({ ...prev, [action]: true })),
      onRelease: (action) => setActions(prev => ({ ...prev, [action]: false }))
    }, { deadzone: 0.15 });

    fauxpad.bind(edgeRef.current, insideRef.current);

    return () => fauxpad.unbind(edgeRef.current!, insideRef.current!);
  }, []);

  return (
    <div ref={edgeRef} className="fauxpad-edge" style={{ left: 25, bottom: 25 }}>
      <div ref={insideRef} className="fauxpad-inside" />
    </div>
  );
}
```

#### Jump Button

```tsx
function JumpButton({ onJump }: { onJump: () => void }) {
  const edgeRef = useRef<HTMLDivElement>(null);
  const insideRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!edgeRef.current || !insideRef.current) return;

    const mappingRef = {
      current: {
        fauxpad: { up: 'jump', down: 'jump', left: 'jump', right: 'jump' }
      }
    };

    const fauxpad = createFauxPadController(mappingRef, {
      onAction: () => onJump()
    }, { deadzone: 0.1 });

    fauxpad.bind(edgeRef.current, insideRef.current);

    return () => fauxpad.unbind(edgeRef.current!, insideRef.current!);
  }, [onJump]);

  return (
    <div ref={edgeRef} className="fauxpad-edge" style={{ right: 25, bottom: 25 }}>
      <div ref={insideRef} className="fauxpad-inside" />
    </div>
  );
}
```

## Styling

The TouchControl component uses BEM-style classes:

```css
.touch-control {
  position: fixed;
  width: 100px;
  height: 100px;
}

.touch-control__edge {
  /* Outer boundary circle */
}

.touch-control__inside {
  /* Inner movable circle */
}
```
