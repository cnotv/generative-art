---
sidebar_position: 21
---

# Building a Curved Physical Bowl

A bowl that balls fall into, roll around and settle in the bottom of. The shape is easy;
the physics has two traps that make balls stop dead halfway up the wall.

![A thick-walled bowl holding a scatter of balls](/img/curved-bowl/bowl-with-balls.webp)

## Source files

- `src/views/Experiments/PhysicBall.vue` — the working example this guide is drawn from

## No primitive can be a bowl

Every solid collider shape — cuboid, ball, cylinder, capsule, convex hull — is convex. A bowl
is not: it is a shape with a hollow, and any convex approximation of it fills that hollow. The
balls then rest on a lid where the opening should be.

The collider has to be the surface itself, triangle by triangle, which Rapier calls a trimesh.

## Turn the shape from a profile

A half sphere would give a bowl of no thickness, which looks wrong at the rim and gives the
physics a wall with no substance. Revolving a profile gives a real wall instead: up the inside,
across the rim, back down the outside.

```typescript
const RADIUS = 13
const THICKNESS = 1
const SEGMENTS = 48

const inner = Array.from({ length: SEGMENTS + 1 }, (_, step) => {
  const angle = (step / SEGMENTS) * (Math.PI / 2)
  return new THREE.Vector2(RADIUS * Math.sin(angle), -RADIUS * Math.cos(angle))
})
const scale = (RADIUS + THICKNESS) / RADIUS
const outer = inner.map((point) => new THREE.Vector2(point.x * scale, point.y * scale)).reverse()

const geometry = new THREE.LatheGeometry(
  [...[...outer].reverse(), ...[...inner].reverse()],
  SEGMENTS
)
```

Both arcs are reversed, and the outer wall comes first. That ordering is not cosmetic — see
below.

## Winding decides whether the physics works

`LatheGeometry` winds its triangles according to the direction its profile travels. Get it the
wrong way round and the mesh is inside out. Nothing tells you: drawing with
`side: THREE.DoubleSide` hides it, and a plain trimesh collider does not care which way a
triangle faces.

It starts to matter the moment you ask the solver to treat the wall as a smooth surface, which
is the next section. Check it with the signed volume of the mesh, which is positive when the
triangles face outwards:

```typescript
const position = geometry.attributes.position.array
const index = geometry.index.array
const signedVolume = Array.from({ length: index.length / 3 }).reduce((total, _, triangle) => {
  const [a, b, c] = [0, 1, 2].map((corner) => index[triangle * 3 + corner] * 3)
  return (
    total +
    (position[a] * (position[b + 1] * position[c + 2] - position[b + 2] * position[c + 1]) -
      position[a + 1] * (position[b] * position[c + 2] - position[b + 2] * position[c]) +
      position[a + 2] * (position[b] * position[c + 1] - position[b + 1] * position[c])) /
      6
  )
}, 0)
```

For the bowl above it should come out around `+1142`, which is the volume of the material the
walls are made of. A number of the same size with a minus sign means the profile is running the
other way; reverse it.

## The collider, and the seam problem

A trimesh is a bag of separate triangles. A ball rolling across the join between two of them
meets the next one edge on and stops dead, partway up the wall, for no reason the scene can
show you. `FIX_INTERNAL_EDGES` has the solver take the neighbouring triangle's normal into
account, so the wall behaves as the continuous curve it looks like.

```typescript
const collider = RAPIER.ColliderDesc.trimesh(
  geometry.attributes.position.array as Float32Array,
  new Uint32Array(geometry.index!.array),
  RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES
)
```

This is where winding comes back: those neighbouring normals point into the wall on an
inside-out mesh, and balls grip it harder than before rather than rolling free. If the flag
appears to make things worse, the mesh is inverted.

## Moving it

For a bowl that stays put, attach the collider to nothing and it is static. For one that can be
tipped or slid with the contents responding, attach it to a kinematic body: the solver then
knows the wall is moving and carries whatever rests against it.

```typescript
const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased())
world.createCollider(collider, body)
```

Drive it from whatever the input is, once per frame, and copy the same pose onto the mesh:

```typescript
body.setNextKinematicRotation(rotation)
body.setNextKinematicTranslation(position)
```

Two things to know if you do this:

- **Chase the input, do not snap to it.** Moving the bowl straight to the pointer teleports the
  wall onto the balls and drags them along in a lump. Interpolating towards the target instead
  (around 15% of the remaining distance per frame) leaves them free to slide against it.
- **Friction decides whether turning the bowl does anything.** Too low and the wall slides
  underneath the balls, leaving them where they were; too high and they cling to the side
  instead of rolling down. Around `1` to `1.5` for a ball of radius 0.5 to 1 gives both.
