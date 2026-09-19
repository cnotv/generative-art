---
sidebar_position: 128
---

# Auto-rigging an upload

Why an unrigged upload to the Model Editor came back with sliders that did nothing, or with a
body that tore at the joints: four faults that had to be cleared before a plain mesh could be
reshaped like a rigged character, and one limit that remains.

The Model Editor runs the Rig Animator's auto-rig on any upload without a skeleton. Until then
that auto-rig had only ever been exercised by hand, on the button, one model at a time, so each
of these had gone unseen.

## The vertices and the bones were measured in different spaces

The skeleton was placed from the model's bounding box in world space and hung under the model's
root, while each mesh was weighed in its own local space. A mesh sitting at its root with no
transform of its own does not notice. A model built from parts does: a leg hung under an offset
hip node, or a whole figure scaled up a hundredfold, has every vertex compared against bones in
another frame, and each one binds to whichever bone happens to sit nearest in the wrong one.

The binding also happened before the new skinned mesh joined the model, so its bind matrix left
out every transform above it. Both are fixed by the same move: bake every mesh's transforms
into a copy of its geometry, in the model's own space, weigh it there, then attach it before
binding. A mirrored transform turns the triangles inside out once it is baked, so their winding
is turned back.

## Each part was weighed as if it were the whole body

The weighting walks the mesh's surface out from a seed on every bone. Run once per mesh, every
bone seeds inside every part: a separate sphere for a head is carved up between the neck, both
shoulders and the spine, each claiming the stretch of sphere nearest its seed, and the head bone
itself often gets none of it. The meshes are now weighed as one surface, so each bone seeds once,
where it truly sits nearest, and a part no seed reaches falls back to the bones nearest it in a
straight line.

## The surface search grows with the square of the mesh

| Vertices | Surface auto-skin time |
| -------- | ---------------------- |
| 961      | 0.2 s                  |
| 2601     | 1.8 s                  |
| 5041     | 6.8 s                  |

Each step of the search rescans its whole frontier and rebuilds its adjacency by copying, so the
time roughly quadruples each time the vertex count doubles. A typical downloaded character of
twenty to fifty thousand vertices would hold the page for minutes. Above a budget of three
thousand vertices the auto-rig now binds by straight-line distance to the two nearest bone
segments, a single linear pass that took half a second on a stripped Mixamo character. It lets
weight bleed across a narrow gap such as an armpit, which matters far less for resizing a limb
than for posing it.

The search itself is left as it is. Replacing its frontier with a binary heap is the real fix,
but the package's lint rules out the in-place array mutation a heap is usually built from.

## The template only fits a figure built like a person

The generated skeleton places each joint at a fixed fraction of the model's height: the neck at
85 per cent, the head at 90. A figure with a head a third of its height, like the stickman, has
its head bone inside the head sphere's upper half and its spine running straight through the
middle of it, so the head binds to the spine and the shoulders and tears when anything above
the waist is resized. Nothing in the weighting can recover from joints placed in the wrong
place; fitting the joints to the figure's own parts is the step the heuristic does not take.

The skeleton did gain one bone: the head now ends at `mixamorigHeadTop_End` on the top of the
model, as a Mixamo rig's does. Before, the head was the end of its chain, a single point rather
than a segment, so the skin above the neck had only that point to bind to.

## Exporting refuses the whole model over one texture

`GLTFExporter` throws, and exports nothing, when any texture's image cannot be drawn: one still
decoding, which an FBX's embedded textures are for a few seconds after the model appears, or one
that never arrives because the file points at an image it does not carry. Download now waits
for pending images and leaves any still unreadable out of that one export, handing them back to
the model straight after.

The exporter also wraps anything that is not a scene in a scene of its own. A capture script that
takes the last scene announced through `__THREE_DEVTOOLS__` picks up that wrapper after an
export and renders the model with no lights, in solid black; take the first scene announced
instead.
