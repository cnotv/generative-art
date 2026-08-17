# Runner Starter

An endless runner: three lanes, obstacles arriving out of the dark, a score, and a collision
that ends the run.

Copy this folder anywhere. It depends on published `@webgamekit/*` versions and imports nothing
from the repository it ships in, so it builds on its own.

```bash
pnpm install
pnpm dev
```

## What is where

| File            | Holds                                                                     |
| --------------- | ------------------------------------------------------------------------- |
| `src/config.ts` | lane positions, speeds, spawn rate, hit radius, key bindings, scene setup |
| `src/main.ts`   | three timeline actions: steer, spawn, and run the track                   |

## The shape to copy

The whole game is three named actions on a timeline. `spawn obstacles` uses `frequency` so it
runs every forty-fifth frame rather than counting frames itself, and the other two run every
frame. Naming them is what lets you later pause one category, log another, or draw them on the
timeline panel.

Everything that moves is scaled by `getDelta()`, so the game runs at the same speed on a 60Hz
and a 144Hz screen. Forgetting that is the single most common way a first prototype ends up
unplayable on someone else's machine.

## What it deliberately does not do

Obstacles are `type: 'fixed'` boxes moved by hand rather than physics bodies under forces, and
the collision test is two distance comparisons rather than Rapier's intersection queries. For a
lane runner, that is the whole of it — reach for the physics engine when the geometry stops
being boxes on a line.

There is no difficulty curve, no pooling and no restart button. Pooling is the first thing to
add if you raise the spawn rate: `getCube` allocates, and this file allocates one per spawn.
