---
sidebar_position: 6
---

# Binding Three.js Data to Vue

Three.js mutates objects in place — `mesh.position.x = 5` does not trigger Vue's reactivity system. Bridging the two requires deliberate effort.

## Strategies

**Store-mediated updates**: Three.js callbacks (OrbitControls `change` event, animation loop) write to a Pinia store. Vue components read from the store reactively.

```ts
orbitControls.addEventListener('change', () => {
  cameraConfigStore.position = {
    x: camera.position.x,
    y: camera.position.y,
    z: camera.position.z,
  };
});
```

**`toRaw` for Three.js objects**: wrapping a Three.js object in a Vue `ref` or `reactive` causes Vue to deeply proxy every property, which breaks internal Three.js assumptions (e.g. `instanceof` checks, internal `__webglTexture` references). Use `markRaw` when storing Three.js objects in reactive state, or `toRaw` before passing them to Three.js APIs.

```ts
const orbit = toRaw(store.orbitReference); // unwrap before use
```

**One-way data flow for config**: UI sliders write config values into a Pinia store. The animation loop reads from the store each frame and applies the values to Three.js objects. This avoids two-way bindings that would cause feedback loops.

## Issues Encountered

- **OrbitControls bypassing reactivity**: panning/zooming with OrbitControls directly mutates `camera.position` without going through any store. The camera panel stayed stale until a `change` listener was wired to sync back.
- **Reactive proxy breaking `instanceof`**: storing a `THREE.Scene` inside `reactive({})` wrapped it in a Proxy. Rapier physics checks `obj instanceof THREE.Mesh` internally and failed silently. Fix: `markRaw(scene)` before storing.
- **`watchEffect` for DOM side effects**: `document.body.style.userSelect` can't be set inside a Pinia store (ESLint `functional/immutable-data` is `error` in stores). Moved to `App.vue`'s `watchEffect`, which is the correct place for DOM side effects driven by reactive state.
