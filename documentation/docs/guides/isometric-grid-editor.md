---
sidebar_position: 22
---

# Building a scene on the isometric grid

The Isometric Editor at `/tools/IsometricEditor` fills a board by clicking it. A primitive is
picked from the palette, the cell under the pointer lights up, and a click drops the model into
that cell snapped to its centre. It is a placement tool rather than a scene editor: the Scene
Editor stays where it is, and this view does one thing.

![The board with a plaza of slabs, a run of walls, two columns, a stack of blocks and two spheres, beside the palette in the Config panel](/img/isometric-editor/board.webp)

## Source files

- `src/views/Tools/IsometricEditor/IsometricEditor.vue` — the view and its pointer handling
- `src/views/Tools/IsometricEditor/config.ts` — the palette, the scene and the control schema
- `src/views/Tools/IsometricEditor/grid.ts` — the snapping and grid arithmetic

## The palette

Five primitives, each declared in `MODEL_PALETTE` with a shape, a colour and a size **in cells**
rather than world units, so a footprint keeps its proportions when the cell size changes.

| Model  | Shape    | Fills                                    |
| ------ | -------- | ---------------------------------------- |
| Block  | cube     | a whole cell                             |
| Slab   | cube     | a cell, ankle high — a floor tile        |
| Wall   | cube     | a cell across, thin, one and a half high |
| Sphere | ball     | a cell, resting on the ground            |
| Column | cylinder | a cell, tall                             |

Adjacent placements meet with no seam, so a run of slabs reads as one floor and a run of walls
as one wall. Models place unrotated; a wall therefore always runs along X, and turning one is
done afterwards from its Elements panel row.

Two entries in the same list are not models. **Erase** clears the cell under the pointer, and
**Clear all** empties the board.

## The grid

One model per cell, so clicking an occupied square replaces what is on it rather than burying
it. The tile under the pointer is highlighted before the click, which is the only way to tell
which square a click will land in on an isometric projection.

![The peach highlight tile marking the empty cell under the pointer](/img/isometric-editor/cell-highlight.webp)

Cell size is a control in the Config panel. The board itself never changes size: the grid is
drawn to fit a whole number of cells inside it, so a cell size that does not divide the board
leaves a thin ring around the edge where the highlight refuses to appear. Changing the cell size
redraws the grid and leaves models already placed exactly where they are.

The division count is always even. A `GridHelper` draws its lines outward from `-size / 2`, so
an odd count puts every drawn line half a cell out of step with the cells the snapping computes
from the origin, and models land straddling the line they were aimed at.

## Placement against orbit

The camera orbits by dragging the same canvas that placement clicks land on. A press and a
release more than a few pixels apart is treated as a drag and places nothing, which is what
keeps both gestures on one surface.

## Every placement is a scene element

Models are built through `getCube`, `getBall` and `getCylinder`, so each one carries a fixed
rigid body and appears in the Elements panel like anything else in a scene. Rows are named by
the cell they occupy — `block_-1,0` — and open on the position and rotation controls every
object gets. Moving one through the panel takes its rigid body with it.

![The Elements panel listing each placement by its cell, with one block expanded on its position and rotation controls](/img/isometric-editor/elements-panel.webp)

The board is not persisted: leaving the view and coming back gives an empty grid.
