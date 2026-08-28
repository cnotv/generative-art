---
sidebar_position: 22
---

# Building a city on the isometric grid

The Isometric Editor at `/tools/IsometricEditor` fills a board by clicking it. A component is
picked from the palette, the cell under the pointer lights up, and a click drops the component
into that cell snapped to its centre. It is a placement tool rather than a scene editor: the
Scene Editor stays where it is, and this view does one thing.

![A small city of terraced houses, a downtown cluster of towers, shop rows, parks and fenced outskirts, laid out on a road grid](/img/isometric-editor/city.webp)

## Source files

- `src/views/Tools/IsometricEditor/IsometricEditor.vue` — the view and its pointer handling
- `src/views/Tools/IsometricEditor/config.ts` — `CITY_MODELS`, the scene and the control schema
- `src/views/Tools/IsometricEditor/models.ts` — assembling a catalogue entry into a scene group
- `src/views/Tools/IsometricEditor/grid.ts` — the snapping and grid arithmetic

## The components

The palette does not offer primitives. It offers pieces of a city, each assembled from two or
three primitives — a house is a box with a wider box for a roof, a tree is a cylinder with a
sphere on top — so a placement reads as a thing rather than a shape.

![One of each component on the board, beside the palette in the Config panel](/img/isometric-editor/components.webp)

| Component | Made of                           | Reads as                           |
| --------- | --------------------------------- | ---------------------------------- |
| House     | body box, wide roof box           | a cottage; a run of them a terrace |
| Shop      | body box, roof band, awning strip | a shopfront on the street side     |
| Tower     | tall shaft box, cap box           | an office block, three cells high  |
| Tree      | trunk cylinder, canopy sphere     | a street tree                      |
| Park      | grass slab, two bushes            | a green square                     |
| Road      | one flat slab                     | tarmac; a run of them a street     |
| Fence     | rail box, two posts               | a boundary along the X axis        |

Two entries are not components. **Erase** clears the cell under the pointer, and **Clear all**
empties the board.

### Adding one

A component is data, not code: an entry in `CITY_MODELS` with a `label`, a palette `swatch` and
a list of parts. Each part names a primitive, its size and the offset of its underside, both
**in cells** rather than world units, so the whole catalogue follows the grid when its cell size
changes.

```ts
{
  value: 'tree',
  label: 'Tree',
  swatch: 0x8fbfa0,
  parts: [
    { shape: 'cylinder', size: [0.16, 0.45, 0.16], offset: [0, 0, 0], color: 0xa8917c },
    { shape: 'ball', size: [0.62, 0.62, 0.62], offset: [0, 0.4, 0], color: 0x8fbfa0 }
  ]
}
```

`buildCityModel` walks the parts through `getCube`, `getBall` and `getCylinder` and collects
them into one `THREE.Group`, so a placement moves, hides and disposes as a single object. A ball
is positioned from its centre while the other two sit on their underside, and the builder lifts
balls by their radius so every `offset` means the same thing.

**No part may reach past its own cell.** A part that overhangs intersects whatever is placed next
door, and a run of roads or fences stops reading as one continuous thing. A test enforces it:
`|offset| + size / 2` never exceeds half a cell on X or Z.

## The grid

One component per cell, so clicking an occupied square replaces what is on it rather than
burying it. The tile under the pointer is highlighted before the click, which is the only way to
tell which square a click will land in on an isometric projection.

![The peach highlight tile marking the empty cell under the pointer](/img/isometric-editor/cell-highlight.webp)

Cell size is a control in the Config panel. The board itself never changes size: the grid is
drawn to fit a whole number of cells inside it, so a cell size that does not divide the board
leaves a thin ring around the edge where the highlight refuses to appear. Changing the cell size
redraws the grid and leaves components already placed exactly where they are.

The division count is always even. A `GridHelper` draws its lines outward from `-size / 2`, so
an odd count puts every drawn line half a cell out of step with the cells the snapping computes
from the origin, and components land straddling the line they were aimed at.

## Placement against orbit

The camera orbits by dragging the same canvas that placement clicks land on. A press and a
release more than a few pixels apart is treated as a drag and places nothing, which is what
keeps both gestures on one surface. Orbiting is also how the heights read, since the default
isometric angle flattens them.

![The same city from a lower three-quarter angle, where the tower cluster and terrace roofs read as heights](/img/isometric-editor/city-angle.webp)

## Every placement is a scene element

Each placement appears in the Elements panel like anything else in a scene. Rows are named by
the cell they occupy — `house_-1,-1` — and open on the position and rotation controls every
object gets. The group is what moves; the builder gives each part a fixed rigid body, and moving
a placement through the panel takes those colliders with it.

![The Elements panel listing each placement by its cell, with one house expanded on its position and rotation controls](/img/isometric-editor/elements-panel.webp)

Components place unrotated, so a fence always runs along X. Turning one is done afterwards from
its panel row. The board is not persisted: leaving the view and coming back gives an empty grid.
