---
sidebar_position: 5
---

# Animation with Three.js

## AnimationMixer

The `THREE.AnimationMixer` drives skeletal and morph-target animations. It must be updated every frame with the elapsed delta:

```ts
mixer.update(delta);
```

**Double-update bug**: the `finished` event on an `AnimationAction` fires synchronously inside `mixer.update()`. If the event handler also calls `mixer.update()`, the mixer advances twice in one frame — animations skip a frame and timing breaks. Guard the handler so it only fires once and never calls `mixer.update()` recursively.

## AnimationAction Transitions

Blending between actions (e.g. walk → idle) uses `crossFadeTo`:

```ts
idleAction.reset().fadeIn(0.3);
walkAction.fadeOut(0.3);
```

Calling `action.reset()` before `fadeIn` is important — without it, if the action was previously playing at the end of its clip, it starts from the last frame instead of the beginning.

## Blocking Animations

Some actions (attacks, jump start) must complete fully before the character can move again. Implemented by:

1. Playing the clip with `action.setLoop(THREE.LoopOnce, 1).clampWhenFinished = true`
2. Listening to `mixer.addEventListener('finished', handler)`
3. Only resuming movement logic after the event fires

The `finished` event includes the `action` that finished, so multiple blocking clips can share one listener.

## Timeline System

The project uses a frame-accurate timeline manager rather than raw `requestAnimationFrame` callbacks. Each action declares its update frequency (every N frames) and priority. This decouples "how often does physics run" from "how often does the camera update", and makes it easy to throttle expensive operations (chunk streaming, shadow map updates) without touching render frequency.
