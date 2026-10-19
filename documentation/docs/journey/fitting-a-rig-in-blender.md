---
sidebar_position: 130
---

# Fitting a rig to a mesh in Blender

The Rig Animator's second bundled example is `character2` skinned to an armature fitted in
Blender from the mesh's own geometry — not the Mixamo skeleton the `.fbx` download carries.
`blender/character-rig.py` builds it in one run, headless or from the UI. These are the parts
that needed more than a first attempt, and the reasoning that fixed them.

## Strip the skeleton before measuring anything

The file arrives with a Mixamo armature, a modifier and Mixamo's own skin weights. All three are
removed at import, before a single vertex is read, so the fit cannot see the skeleton even by
accident. A joint that lands where it does because a previous rig had it there would be a copy
without anyone noticing, which is the one thing the example must not be. The bones keep only the
naming convention (`mixamorig*`), because that is what the rig tooling matches on: the
animator's body-part groups, its auto-rig and the humanoid hierarchy all key off those names.

## What the mesh states, and what the clothing hides

Most joints are measurable from the silhouette alone: the boot's narrowest well-populated row
gives the ankle, the foot's own heel and toe place the ball, a least-squares line through the
arm's cross-sections gives both its droop and the height every arm joint sits at, and the
thinnest cross-section before the hand is the wrist. The shoulder joint sits between the chest
wall and the first ring of the arm's own surface.

Two joints hide under the harem trousers: the pelvis is a mass rather than a landmark, and no
slice of a straight arm says where the elbow is. Those fall back to standard anthropometric
fractions of the figure's own measured height — the hip joints at 53 per cent, checked against
the silhouette (widest at 52), the elbow at 56 per cent of a shoulder-to-wrist span, the knee
halfway down the leg — each noted in the script where it is used. Fitted this way, the whole
21-bone skeleton sits within a centimetre and a half of a hand-tuned skeleton for the same
figure, which is well inside what a length slider can tell apart.

## The glasses are an island, and heat weighting cannot reach them

Blender's automatic weights smear across the mesh surface: they bind a vertex by the bones the
surface carries the heat from. The character's glasses frame floats in front of the face as a
separate island, touching nothing, so heat never arrives and all 1,116 of its vertices came back
with no weight at all — the glasses would stay behind, hanging in the air, the moment the head
turned. The script hands every vertex the heat missed its nearest bone segment: the same
nearest-segment rule the rig package's own fallback uses, with the same answer.

## The exporter gathers every scene's selection

`bpy.ops.export_scene.gltf` exports what is selected across every scene in the file, not just
the active one. The script is meant to be runnable from the Blender UI, on top of whatever
someone has open, and a selection in _their_ scene would travel into the GLB and ship their work
inside the example. The build therefore deselects in every scene before exporting, and does its
whole job in a scratch scene it deletes afterwards: nothing of the open file goes in, and
nothing of the build is left behind.

## The textures decide the asset budget, not the triangles

The mesh is modest — 28,106 triangles — but its textures are 4096 square, with a 12.9 MB normal
map alone, and the repository holds GLBs to a 2 MB budget. Texture size is also what a phone
pays in VRAM, where a 4096 map costs 64 MB each whether the file is compressed or not. Scaled to
1024 and exported as JPEG at quality 90, the cleanly skinned GLB comes to 1.26 MB with no change
visible at the size the editor displays it.

## Verified by rendering it, and by reading it back

Skinning faults show up in motion, not in the numbers, so the build is checked the way a human
would: renders of the rest pose, of a pose that swings both legs, raises an arm and turns the
head, and a close-up of the turned head to confirm the glasses ride along with the face. What
the numbers can check is checked by parsing the GLB itself, without a browser or a WebGL
context: every vertex carries weight, every weight points at a bone the skeleton has, the
skeleton holds a bone for every bone of the animator's humanoid hierarchy, and the budget is
respected. Both live beside the animator as `exampleModels.test.ts`, and the script prints the
landmark table it measured on every run, so a rebuild can be compared against the record one
line at a time.
