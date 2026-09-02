---
sidebar_position: 23
---

# Posing a model into an animation

The Rig Animator at `/tools/RigAnimator` turns an uploaded model into a standalone animation
clip. Upload a model, select a bone, move and rotate it into a pose, drop a keyframe, move to
another frame and pose it again. Three.js interpolates between whatever keyframes exist, so
two poses are already a movement.

![mixamorigRightArm selected and pulled into a pose: the translate gizmo at its joint, the marker turned rose, its rotation and position both edited, every other bone still marked in the rest colour and shrinking toward the fingertips](/img/animation/rig-posing.webp)

## Source files

- `src/views/Tools/RigAnimator/RigAnimator.vue`: the view (scene setup, canvas picking, and
  wiring the panel schema to the composables below)
- `src/views/Tools/RigAnimator/useRigModel.ts`: the loaded model, its rig, its bone markers,
  its rest poses and the selected bone
- `src/views/Tools/RigAnimator/useRigKeyframes.ts`: the authored pose keyframes and the preview
  and export clips built from them
- `src/views/Tools/RigAnimator/rigModel.ts`: loading a model file and generating an auto-rig
- `src/views/Tools/RigAnimator/boneMarkers.ts`: the clickable, hierarchy-scaled per-bone markers
- `src/views/Tools/RigAnimator/useBoneGizmo.ts`: the translate gizmo (Three.js's own
  `TransformControls`) for dragging the selected bone
- `src/views/Tools/RigAnimator/timelineSource.ts`: exposes the pose keyframes to the shared
  Timeline panel
- `src/views/Tools/RigAnimator/cameraFraming.ts`: framing the camera to whatever scale the
  uploaded model happens to use
- `src/views/Tools/RigAnimator/export.ts`: the GLB and JSON export/import
- `src/views/Tools/RigAnimator/panelSchema.ts`: the Config panel schema, rebuilt whenever the
  bone list, the keyframe list or the auto-rig availability changes
- `src/views/Tools/RigAnimator/config.ts`: the scene setup and every tunable, as values only
- `packages/animation/src/pose.ts`, `humanoidRig.ts`, `rig.ts`: the framework-agnostic logic.
  See the [animation package's rigging section](/docs/packages/animation#rigging-and-pose-animation)
  for the pose-capture, clip-building and auto-rig API.

## Uploading a model

The view opens with a default character already loaded, so there is something to pose before
uploading anything. Any FBX, GLB or GLTF replaces it through the panel's file input. If it
already carries a skeleton (a Mixamo export, a rigged glTF character), the bone list appears
immediately. The camera re-frames to whatever scale the model happens to use, since a Mixamo
FBX is roughly a hundred times the scale of a typical glTF asset and a fixed camera position
would put one of them somewhere behind a shoe.

## Picking and posing a bone

Every bone gets a small marker, sized as a fraction of the whole rig's spread so it reads at any
model scale, and shrinking with hierarchy depth so a hip or shoulder joint reads larger than a
fingertip several bones further down the chain. Clicking a marker on the canvas, or picking a
name from the **Bone** dropdown, selects it: the marker turns rose, every other one stays the
default periwinkle, and a translate gizmo appears at the bone's joint.

Rotating and moving both work two ways, kept in sync with each other:

- **Drag the gizmo** in the 3D view to move the bone. The orbit camera steps aside for the
  duration of the drag.
- **Type into the Bone Rotation / Bone Position fields**, ranged to whatever scale the loaded
  rig happens to be.

Either one updates the model live and the other's fields immediately, so a pose is built by eye
against the model rather than by typing numbers blind.

Only rotation is part of a keyframe. Moving a bone corrects where it sits, which is most useful
for nudging an auto-rigged skeleton's guessed joint placement, rather than authoring an animated
translation, so a position edit is not captured by **Add Keyframe at Frame** and does not appear
in the exported clip.

Moving a bone can also easily go too far: a joint dragged well past its rest offset tears the
mesh at that seam, since translation, unlike rotation, does not preserve limb length. **Reset
Bone to Rest Pose** undoes any position or rotation edit on the selected bone back to how it
was when the rig was loaded (or auto-rigged), without touching any other bone or any keyframe
already captured.

## Keyframes and interpolation

Frame-based scheduling already has a home in this app: the Timeline panel, shared with every
other view that schedules something over frames. Each pose keyframe you drop shows up there as
a named bar, `Pose @ frame 12`, and its own **Play/Pause** button runs the clip in real time.
**Frame** in the Config panel is the authoring position: **Add Keyframe at Frame** captures
every bone's current rotation and position at that frame, replacing whatever keyframe already
sat there; **Delete Keyframe at Frame** removes it. Moving Frame while nothing is playing scrubs
the preview to that instant, interpolated between whichever keyframes bracket it: two poses ten
frames apart already read as a movement once you scrub between them.

## Auto-rig for a model with no skeleton

A model with meshes but no skeleton shows **Auto-rig as Humanoid** instead of a bone list.
It generates a canonical Mixamo-named bone hierarchy sized from the model's own bounding box,
then binds each mesh to it by nearest-bone proximity. This is a heuristic, not a hand-weighted
rig: it is meant to get an unrigged humanoid posable at all, and can pinch at a joint on
unusual proportions. There is no detection step deciding whether a model "looks" humanoid: the
button is offered whenever a skeleton is missing, and posing it is how you find out whether the
fit works for that particular mesh.

## Saving the animation

**Export GLB** bakes the model and the authored clip into one `.glb`, playable in any glTF
viewer or engine outside this tool. **Export JSON** saves just the pose keyframes, which
**Import Poses (JSON)** reads back into this same tool for further editing: the GLB is the
portable result, the JSON is the editable source.
