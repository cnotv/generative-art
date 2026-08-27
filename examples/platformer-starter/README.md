# Platformer Starter

A third-person platformer in about a hundred lines: a physics-driven player, fixed platforms to
jump between, keyboard and gamepad input, and a camera that follows.

Copy this folder anywhere. It depends on published `@webgamekit/*` versions and imports nothing
from the repository it ships in, so it builds on its own.

```bash
pnpm install
pnpm dev
```

## What is where

| File            | Holds                                                                        |
| --------------- | ---------------------------------------------------------------------------- |
| `src/config.ts` | every constant — scene, player, platforms, key bindings, speeds              |
| `src/main.ts`   | scene setup and the two timeline actions that move the player and the camera |

Keeping constants in `config.ts` is the convention worth copying: a view or a starter should
read as wiring, with the numbers somewhere you can find them.

## The shape to copy

`getTools` returns the scene, the physics world and the two functions that matter — `setup` for
the world and `animate` for the loop. Everything that happens per frame is a named action on a
timeline rather than a branch inside one giant callback, which is what makes actions removable,
pausable and individually inspectable later.

## What it deliberately does not do

The grounded check is `Math.abs(velocity.y) < 0.05`, which lets you jump at the top of an arc.
Real ground detection is a raycast down from the player, and `controllerForward` in
`@webgamekit/animation` does it properly — the naive version is here so the file stays readable.

There is no editor, no debug panel and no asset loading. Those belong to the playground this
package family came from; a starter that shipped them would be a fork, not a start.
