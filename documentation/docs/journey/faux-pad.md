---
sidebar_position: 7
---

# Faux-Pad (Touch Controls)

A virtual joystick rendered as a DOM element — the user drags from a center point and the displacement vector drives input actions.

## Key Findings

- **Circular boundary clamping**: without clamping, the thumb can be dragged far outside the visual circle, producing extreme axis values. The displacement vector must be clamped to the circle's radius before normalisation.

```ts
const distance = Math.min(Math.hypot(dx, dy), maxRadius);
const angle = Math.atan2(dy, dx);
```

- **8-way directional detection**: converting the angle to one of 8 sectors (N, NE, E, SE, S, SW, W, NW) requires dividing the circle into 45° arcs. An `axisThreshold` (dead zone) prevents accidental diagonals when the user intends a cardinal direction.
- **Touch event `change` fires only on new file**: the browser's file input `change` event does not fire if the same file is re-selected. Fix: clear `input.value = ''` after processing so the browser treats the next selection as a new change.
- **`touchend` must release all active actions**: when the user lifts their finger, every action that was active for that touch identifier must be explicitly released. Missing this causes "stuck" keys where the character keeps moving after the finger is lifted.
- **Active touch tracking by identifier**: if multiple touches are active, each touch must be tracked by `touch.identifier`, not by index. Index-based tracking breaks when a second finger lands and changes the array order.
