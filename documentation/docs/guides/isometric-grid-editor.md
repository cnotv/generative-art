---
sidebar_position: 22
---

# Building a city on the isometric grid

The Isometric Editor at `/tools/IsometricEditor` fills a board by clicking it. A component is
picked from the palette, the cell under the pointer lights up, and a click drops the component
into that cell snapped to its centre. Holding the button and dragging paints a run of them. It
is a placement tool rather than a scene editor: the Scene Editor stays where it is, and this
view does one thing.

**Load small city** fills the board with a worked example, which is a faster introduction than
an empty grid.

![A small city of terraced houses, a downtown cluster of towers and skyscrapers, a school, a hospital, a city hall, planted squares, and a river along one side crossed by the main avenue](/img/isometric-editor/city.webp)

## Source files

- `src/views/Tools/IsometricEditor/IsometricEditor.vue` — the view and its pointer handling
- `src/views/Tools/IsometricEditor/config.ts` — `CITY_MODELS`, `CITY_PRESET` and the scene, as
  values only: a config file in this repo holds no logic
- `src/views/Tools/IsometricEditor/panelControls.ts` — the Config panel schema, derived from the
  catalogue so a new component brings its own palette button
- `src/views/Tools/IsometricEditor/preset.ts` — expanding a layout's rectangles into cells
- `src/views/Tools/IsometricEditor/models.ts` — assembling a catalogue entry into a scene group
- `src/views/Tools/IsometricEditor/grid.ts` — the snapping and grid arithmetic
- `src/views/Tools/IsometricEditor/strokes.ts` — what a press on a cell does

## The components

The palette does not offer primitives. It offers pieces of a city, each assembled from a handful
of them — a house is a box with a wider box for a roof, a hospital is a box with two thin bars
crossed on its roof — so a placement reads as a thing rather than a shape.

![One of each component on the board, beside the palette in the Config panel](/img/isometric-editor/components.webp)

| Component  | Made of                               | Reads as                           |
| ---------- | ------------------------------------- | ---------------------------------- |
| House      | body box, wide roof box               | a cottage; a run of them a terrace |
| Shop       | body box, roof band, awning strip     | a shopfront on the street side     |
| School     | long low body, roof, bell tower       | a schoolhouse                      |
| Hospital   | body, roof, two bars crossed on it    | the red cross reads from above     |
| City hall  | base, portico step, upper block, dome | the civic building of the town     |
| Tower      | tall shaft box, cap box               | an office block, two cells high    |
| Skyscraper | shaft, narrower upper shaft, spire    | downtown, nearly twice a tower     |
| Tree       | grass slab, trunk cylinder, canopy    | a street tree on its own patch     |
| Bushes     | grass slab, two bush spheres          | a planted green square             |
| Grass      | one thin slab                         | mown green, fresher than the board |
| Water      | one thin slab                         | a run of them a river or a lake    |
| Road       | one flat slab                         | tarmac; a run of them a street     |
| Fence      | rail box, two posts                   | a boundary along the X axis        |

Grass, Water, Tree and Bushes share one slab height, so a tree on its patch lies flush with the
plain grass beside it and a riverbank meets the water without a step. Anything that stands on
green ground carries its own grass rather than needing a tile placed under it, since only one
component fits in a cell.

**The board starts green**, so nothing has to be laid down before building and erasing a cell
returns it to open ground. The Grass tile is a shade fresher than the board it lies on: laying
grass on grass has to show, or the component would do nothing at all.

**Erase** is not a component: it forces a stroke to empty the cells it crosses, which is how a
sweep starting on bare ground clears a run. **Clear all** empties the board.

### Adding one

A component is data, not code: an entry in `CITY_MODELS` with a `label`, a palette `swatch` and
a list of parts. Each part names a primitive, its size and the offset of its underside, both
**in cells** rather than world units, so a part is written against the square it has to fit
rather than against `CELL_SIZE`.

```ts
{
  value: 'tree',
  label: 'Tree',
  swatch: 0x8fbfa0,
  parts: [
    { shape: 'cube', size: [1, GROUND_COVER_HEIGHT, 1], offset: [0, 0, 0], color: GRASS_COLOR },
    { shape: 'cylinder', size: [0.16, 0.45, 0.16], offset: [0, GROUND_COVER_HEIGHT, 0], color: 0xa8917c },
    { shape: 'ball', size: [0.62, 0.62, 0.62], offset: [0, 0.44, 0], color: 0x8fbfa0 }
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

## Drawing on the board

The orbit control is off by default, which frees the drag for drawing. Pressing on a cell starts
a stroke, and every new cell the pointer crosses gets the same treatment, so a street is one
drag rather than fifteen clicks.

![A road drawn in one stroke, a second crossing it, and a terrace of houses drawn beside them](/img/isometric-editor/paint-drag.webp)

What a stroke does is decided where it starts and then held for its whole length:

| Press on                          | The stroke             |
| --------------------------------- | ---------------------- |
| an empty cell                     | fills cells            |
| a cell holding something else     | fills cells, replacing |
| a cell holding the same component | empties cells          |
| any cell, with Erase              | empties cells          |

A press empties a cell only when it would otherwise place the very thing already standing there.
Clicking a house with House selected takes it away; clicking it with Road selected paves over it.
Erasing on any mismatch instead would make paving a road over a terrace a two-pass job, which is
most of what building a city is.

Fixing the mode at the start matters just as much: deciding per cell would flip a road into an
eraser at the first occupied cell it met and chew a hole through the town.

**Orbit camera** in the Config panel hands the drag back to the camera. With it on, dragging
turns the view and only a click that does not move places anything, which is how the angled
views in this guide were taken.

## The grid

One component per cell, so a stroke crossing an occupied square replaces what is on it rather
than burying it. The tile under the pointer is highlighted before the click, which is the only
way to tell which square a click will land in on an isometric projection.

![The peach highlight tile marking the empty cell under the pointer](/img/isometric-editor/cell-highlight.webp)

The white lines float just above the flattest components rather than sitting on the ground, so a
street or a river is still divided into cells instead of swallowing them. Anything taller hides
the lines the way it should, and **Show grid** turns them off for a clean look at the result.

![A run of road and a run of water, both still divided into cells by the white grid drawn over them](/img/isometric-editor/grid-over-flat.webp)

## The board grows and shrinks, the cells do not

A cell is always the same size, because components are sized in cells: changing it would resize
every building in the town. **Board size** changes how many cells there are instead. The ground
is one flat box, so scaling it is the whole resize, and growing the board leaves every placement
exactly where it was with open green around it.

![The same city on a board grown well beyond it, the cells unchanged and open ground all around](/img/isometric-editor/board-size.webp)

Shrinking drops whatever the smaller board no longer covers, rather than leaving it hanging over
the edge. That is destructive and deliberate: the alternative is components floating in the air
outside the grid that nothing can reach to erase.

Every reachable board size is a whole **even** number of cells, which is what the step of two
cells buys. A `GridHelper` draws its lines outward from `-size / 2`, so an odd count would put
every drawn line half a cell out of step with the cells the snapping computes from the origin,
and components would land straddling the line they were aimed at.

## The preset

`CITY_PRESET` is a layout rather than a scene: a board size and, per component, the list of cells
it fills. Loading it clears the board, sizes it to the board the layout was drawn for, and places
every cell through the same `placeModel` a click goes through, so there is no second code path
that can drift from the first.

Runs are written as runs. Each is a rectangle of cells, `[fromX, toX, fromZ, toZ]` inclusive, so
`[-8, 9, 0, 0]` is an avenue, `[8, 8, 1, 9]` half a river and `[-3, -3, 5, 5]` a single school.
That keeps a city of two hundred and forty cells readable as two dozen lines, and it keeps the
layout as **values** rather than function calls: `config.ts` holds no logic, so `expandRun` in
`preset.ts` turns the rectangles into cells at load time.

The avenue crosses the river because it is written one cell longer than the water is wide, and
the road wins the shared cell: that is the whole of the bridge.

Tests hold every named component to one the palette can build, every cell to the board, and
every cell to a single owner: two components claiming one cell would mean the layout on screen
is not the layout that was written. A cell repeated inside one piece is fine, since that is what
a crossroads is.

Turning the orbit on shows what the flat isometric angle hides.

![The same city from a lower three-quarter angle, where the tower cluster and terrace roofs read as heights](/img/isometric-editor/city-angle.webp)

## Every placement is a scene element

Each placement appears in the Elements panel like anything else in a scene. Rows are named by
the cell they occupy — `house_-1,-1` — and open on the position and rotation controls every
object gets. The group is what moves; the builder gives each part a fixed rigid body, and moving
a placement through the panel takes those colliders with it.

![The Elements panel listing each placement by its cell, with one house expanded on its position and rotation controls](/img/isometric-editor/elements-panel.webp)

Components place unrotated, so a fence always runs along X. Turning one is done afterwards from
its panel row. The board is not persisted: leaving the view and coming back gives an empty grid,
and **Load small city** is the quickest way back to something.
