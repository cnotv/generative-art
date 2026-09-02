---
sidebar_position: 23
---

# Posing a model into an animation

The Rig Animator at `/tools/RigAnimator` turns an uploaded model into a standalone animation
clip. Upload a model, pick a bone by clicking its marker or from the panel list, drag it into a
pose, drop a keyframe, move to another frame and pose it again. Three.js interpolates between
whatever keyframes exist, so two poses are already a movement.

![Selecting mixamorigRightArm and dropping it into a pose, with every other bone still marked in the rest colour](/img/animation/rig-posing.webp)

## Source files

- `src/views/Tools/RigAnimator/RigAnimator.vue` — the view: scene setup, canvas picking, and
  wiring the panel schema to the composables below
- `src/views/Tools/RigAnimator/useRigModel.ts` — the loaded model, its rig and its bone markers
- `src/views/Tools/RigAnimator/useRigKeyframes.ts` — the authored pose keyframes and the preview
  and export clips built from them
- `src/views/Tools/RigAnimator/rigModel.ts` — loading a model file and generating an auto-rig
- `src/views/Tools/RigAnimator/boneMarkers.ts` — the clickable per-bone markers
- `src/views/Tools/RigAnimator/cameraFraming.ts` — framing the camera to whatever scale the
  uploaded model happens to use
- `src/views/Tools/RigAnimator/export.ts` — the GLB and JSON export/import
- `src/views/Tools/RigAnimator/panelSchema.ts` — the Config panel schema, rebuilt whenever the
  bone list, the keyframe list or the playback state changes
- `src/views/Tools/RigAnimator/config.ts` — the scene setup and every tunable, as values only
- `packages/animation/src/pose.ts`, `humanoidRig.ts`, `rig.ts` — the framework-agnostic logic:
  see the [animation package's rigging section](/docs/packages/animation#rigging-and-pose-animation)
  for the pose-capture, clip-building and auto-rig API

## Uploading a model

Any FBX, GLB or GLTF loads through the panel's file input. If it already carries a skeleton —
a Mixamo export, a rigged glTF character — the bone list appears immediately. The camera
re-frames to whatever scale the model happens to use, since a Mixamo FBX is roughly a hundred
times the scale of a typical glTF asset and a fixed camera position would put one of them
somewhere behind a shoe.

## Picking and posing a bone

Every bone gets a small marker, sized as a fraction of the whole rig's spread so it reads at any
model scale. Clicking a marker on the canvas, or picking a name from the **Bone** dropdown,
selects it and loads its current rotation into the X/Y/Z fields. The selected marker turns
rose; every other one stays the default periwinkle. Editing the rotation fields rotates the bone
live, so a pose is built by eye against the model rather than by typing numbers blind.

## Keyframes and interpolation

**Frame** is the current position on the timeline. **Add Keyframe at Frame** captures every
bone's current rotation at that frame; adding one at a frame that already holds a keyframe
replaces it. Moving Frame while nothing is playing scrubs the preview to that instant,
interpolated between whichever keyframes bracket it — two poses ten frames apart already read
as a movement once you scrub between them. **Play Preview** runs the clip in real time at the
chosen **FPS**; **Delete Keyframe at Frame** removes whatever keyframe sits at the current frame.

## Auto-rig for a model with no skeleton

A model with meshes but no skeleton shows **Auto-rig as Humanoid** instead of a bone list.
It generates a canonical Mixamo-named bone hierarchy sized from the model's own bounding box,
then binds each mesh to it by nearest-bone proximity. This is a heuristic, not a hand-weighted
rig: it is meant to get an unrigged humanoid posable at all, and can pinch at a joint on
unusual proportions. There is no detection step deciding whether a model "looks" humanoid —
the button is offered whenever a skeleton is missing, and posing it is how you find out whether
the fit works for that particular mesh.

## Saving the animation

**Export GLB** bakes the model and the authored clip into one `.glb`, playable in any glTF
viewer or engine outside this tool. **Export JSON** saves just the pose keyframes, which
**Import Poses (JSON)** reads back into this same tool for further editing — the GLB is the
portable result, the JSON is the editable source.
