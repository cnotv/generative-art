---
sidebar_position: 99
---

# Minigolf Multiplayer: Turns, Ball Physics, and Hole Entry

This documents three non-obvious problems encountered while building the multiplayer minigolf game.

## Turn system → simultaneous play

The first multiplayer design assigned a `currentPlayerIndex` tracked in the Pinia store and broadcast over a `TURN_CHANNEL`. The host controlled whose turn it was, advancing the index after the ball stopped.

This caused several problems:

- **Player 1 plays on both browsers.** The `onPointerDown` handler had no guard checking whether the current peer was actually the active player, so anyone could shoot on any turn.
- **Uneven turn counts.** The host advanced the turn too eagerly — before remote ball positions were confirmed as stopped — so some players got fewer shots.
- **Waiting is frustrating.** On slow holes, one player sat idle watching another play.

The simplest fix was to remove turns entirely. Each browser now manages its own ball independently. `localStrokes` is a plain `ref` on each client. When a player holes out (or exhausts strokes), they call `broadcastScore()`. The host watches a `allPlayersScored` computed and advances the hole once every player has a score for the current index. No turn state, no synchronisation of "whose turn" — just score collection.

**Key insight:** in simultaneous play you don't need a shared "active player" at all. Each peer only needs to broadcast their own ball position and score. The host acts as a score aggregator, not a turn gatekeeper.

## Ball deceleration: making the final roll feel responsive

The default Rapier damping values stopped the ball too suddenly at high values or left it rolling forever at low ones. The approach that worked was layered:

1. **Rapier linear/angular damping** (`BALL_LINEAR_DAMPING = 0.8`, `BALL_ANGULAR_DAMPING = 1.2`) provides baseline energy loss per physics step.
2. **Extra drag in the animation loop** — each frame, if ball speed is between 0.01 and 1.5 m/s, velocity is multiplied by 0.88:

   ```ts
   if (speed > 0.01 && speed < 1.5) {
     ballState.body.setLinvel({ x: vel.x * 0.88, y: vel.y, z: vel.z * 0.88 }, false)
   }
   ```

   This creates a "settling" effect: fast shots feel natural, slow final rolls bleed speed quickly. The y-component is left untouched to preserve gravity pull into the hole.

3. **Gravity scale × 10** (`setGravityScale(10)`) ensures the ball falls into the cup decisively once it crosses the edge, rather than bouncing around the rim.

The per-frame drag in the 0.01–1.5 band is the key. Without it, balls creep across the green for several seconds at near-zero speed before Rapier's sleep threshold kicks in.

## Physical hole entry: compound ground collider with a gap

The first implementation used a single solid `BoxGeometry` for the ground and detected hole entry by checking `ball.y < -BALL_RADIUS`. The ball appeared to "teleport" into the hole rather than fall.

The fix creates a physically open hole in the ground plane:

1. **`groundPiecesAroundHole()`** decomposes the rectangular ground into four pieces — left strip, right strip, front strip, rear strip — leaving a gap of `HOLE_RADIUS * 2` at the hole position.
2. **`buildGroundColliders()`** creates one compound `RigidBody` with one `cuboid` collider per piece. A separate `ceilBody` and `cupBody` complete the physics sandwich.

```
Ground pieces (top view):
┌──────────────────────────┐
│  left  │  gap  │  right  │
│        │  hole │         │
│  front │       │  front  │
└──────────────────────────┘
```

The ball falls through the gap under 10× gravity and lands on the cup bottom collider. Visually the mesh is still a single uncut `BoxGeometry` — the hole marker (disc + cup walls) sits on top and hides the gap.

**Pitfall:** early versions created one `RigidBody` per ground piece, which produced eight overlapping bodies (4 floor pieces × left+right from a mis-scoped loop). The compound approach — many colliders on one body — avoids this and matches Rapier best practices.

## `isRigidBodyValid` crash on hole transition

When advancing to a new hole, `clearHoleObjects()` removes all physics bodies. The Rapier version used in this project does not expose `world.isRigidBodyValid()`. Calling it throws `TypeError: ctx.world.isRigidBodyValid is not a function`.

Fix: wrap every `world.removeRigidBody()` in a try-catch:

```ts
const safeRemoveBody = (body: RigidBody, world: World): void => {
  try {
    world.removeRigidBody(body)
  } catch {
    // already removed or handle not valid
  }
}
```

This is safe because Rapier itself throws on an already-removed handle, and we do not need the return value.
