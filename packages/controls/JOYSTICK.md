# Virtual Joystick Controller

Framework-agnostic virtual joystick controller for @webgamekit/controls package. Interprets touch/mouse input into directional actions with configurable deadzone and direction detection.

## Features

- **Framework-agnostic**: Pure TypeScript, works with any UI framework
- **Directional mapping**: Automatically converts joystick angle to directional actions
- **4-way or 8-way directions**: Configurable direction detection modes
- **Deadzone support**: Prevent unintentional inputs with configurable deadzone
- **Visual feedback**: Automatically updates joystick position on screen
- **Event-driven**: Emits action/release events like other controllers

## Basic Usage

### In Vue Component

```vue
<script setup lang="ts">
import { createJoystickController } from '@webgamekit/controls';
import { ref, onMounted, onUnmounted } from 'vue';

const edgeRef = ref<HTMLElement | null>(null);
const insideRef = ref<HTMLElement | null>(null);

let joystick: JoystickController;

onMounted(() => {
  if (!edgeRef.value || !insideRef.value) return;

  const mappingRef = {
    current: {
      joystick: {
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

  joystick = createJoystickController(mappingRef, handlers, {
    deadzone: 0.15,
    directionThreshold: 45,
    enableEightWay: false
  });

  joystick.bind(edgeRef.value, insideRef.value);
});

onUnmounted(() => {
  if (joystick && edgeRef.value && insideRef.value) {
    joystick.unbind(edgeRef.value, insideRef.value);
  }
});
</script>

<template>
  <div ref="edgeRef" class="joystick-edge">
    <div ref="insideRef" class="joystick-inside"></div>
  </div>
</template>
```

### Using the TouchControl Component

The TouchControl Vue component wraps the joystick controller:

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

## Configuration Options

### JoystickOptions

```typescript
interface JoystickOptions {
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

### createJoystickController(mappingRef, handlers, options?)

Returns a `JoystickController` with:

- `bind(edgeElement, insideElement)`: Attach event listeners
- `unbind(edgeElement, insideElement)`: Remove event listeners
- `getPosition()`: Get current joystick state
- `reset()`: Reset to center position
- `isActive()`: Check if joystick is being used

### JoystickPosition

```typescript
interface JoystickPosition {
  x: number;        // Normalized X (-1 to 1)
  y: number;        // Normalized Y (-1 to 1)
  distance: number; // Distance from center (0 to 1)
  angle: number;    // Angle in degrees (0-360)
}
```

## Integration with createControls

The joystick controller integrates seamlessly with the main controls system:

```typescript
import { createControls, isMobile } from '@webgamekit/controls';

const { currentActions } = createControls({
  mapping: {
    keyboard: { w: 'move-forward', a: 'turn-left', d: 'turn-right' },
    joystick: { up: 'move-forward', left: 'turn-left', right: 'turn-right' }
  },
  onAction: (action) => {
    console.log('Action triggered:', action);
  }
});

// Check if any action is active
if (currentActions['move-forward']) {
  // Player is moving forward
}
```

## Styling

The TouchControl component comes with default BEM-style classes:

```css
.touch-control {
  position: fixed;
  width: 100px;
  height: 100px;
  /* Custom styles here */
}

.touch-control__edge {
  /* Outer boundary circle */
}

.touch-control__inside {
  /* Inner movable circle */
}
```

## Examples

### Game Movement Control

```vue
<TouchControl
  :mapping="{ up: 'moving', left: 'turn-left', right: 'turn-right' }"
  :options="{ deadzone: 0.15 }"
  @action="(action) => currentActions[action] = true"
  @release="(action) => currentActions[action] = false"
  style="left: 25px; bottom: 25px"
/>
```

### Jump Button

```vue
<TouchControl
  :mapping="{ up: 'jump', down: 'jump', left: 'jump', right: 'jump' }"
  :options="{ deadzone: 0.1 }"
  @action="handleJump"
  style="right: 25px; bottom: 25px"
/>
```

### 8-Way Movement

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
