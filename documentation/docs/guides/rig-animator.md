---
sidebar_position: 23
---

# Posing a model into an animation

The Rig Animator at `/tools/RigAnimator` turns an uploaded model into a standalone animation
clip. Upload a model, select a bone, drag it into a pose, drop a keyframe on the rig timeline,
move to another frame and pose it again. Three.js interpolates between whatever keyframes
exist, so two poses are already a movement.

![mixamorigRightArm selected and pulled into a pose: the marker turned rose, its rotation and position both edited, every other bone still marked in the rest colour and shrinking toward the fingertips](/img/animation/rig-posing.webp)

## Source files

- `src/views/Tools/RigAnimator/RigAnimator.vue`: the view (scene setup, pointer picking and
  dragging, wiring the rig timeline and the Config panel schema to the composables below)
- `src/views/Tools/RigAnimator/useRigModel.ts`: the loaded model, its rig, its bone markers,
  its rest poses and the selected bone
- `src/views/Tools/RigAnimator/useRigKeyframes.ts`: the authored pose keyframes, the preview
  clip built from them, and explicit autosave persistence on every genuine edit
- `src/views/Tools/RigAnimator/useRigKeyframeIO.ts`: every way keyframes enter or leave the
  tool: GLB/JSON export, JSON import, loading a bundled preset, autosave restore and reset
- `src/views/Tools/RigAnimator/rigModel.ts`: loading a model file and generating an auto-rig
- `src/views/Tools/RigAnimator/boneMarkers.ts`: the clickable, hierarchy-scaled per-bone markers
- `src/views/Tools/RigAnimator/boneDragPlane.ts`: the camera-facing plane a drag reads the
  pointer against, so posing never jumps with a world axis
- `src/views/Tools/RigAnimator/boneDragTarget.ts`: resolves a drag toward a world-space target
  into a two-bone IK solve, a one-bone aim, a pole-hint re-aim, or (for the skeleton root only)
  a plain translate, and resets whichever bones a drag rotated back to rest
- `src/views/Tools/RigAnimator/frameRange.ts`, `keyframeOps.ts`: pure helpers for resizing the
  timeline's frame range and repositioning a dragged keyframe
- `src/views/Tools/RigAnimator/autosave.ts`: reading and writing the autosaved edit in
  `localStorage`
- `src/views/Tools/RigAnimator/presets.ts`: the bundled example animations, and sampling one
  into a sparse set of pose keyframes
- `src/views/Tools/RigAnimator/RigTimeline.vue`: the dedicated panel for playback, keyframes,
  the frame axis, presets, import and export (see below)
- `src/views/Tools/RigAnimator/cameraFraming.ts`: framing the camera to whatever scale the
  uploaded model happens to use
- `src/views/Tools/RigAnimator/export.ts`: the GLB/JSON export and JSON import file handling
- `src/views/Tools/RigAnimator/panelSchema.ts`: the Config panel schema (upload, auto-rig,
  bone selection and pose fields), rebuilt whenever the bone list or the auto-rig availability
  changes
- `src/views/Tools/RigAnimator/cameraPoseMapping.ts`: pure mapping from detected camera
  landmarks to world-space bone targets, anchored and scaled to the loaded rig
- `src/views/Tools/RigAnimator/useCameraPoseCapture.ts`: the webcam stream and the MediaPipe
  Pose Landmarker, running live detection for the capture dialog's overlay
- `src/views/Tools/RigAnimator/useCameraPhotoPose.ts`: reading a pose from a single uploaded
  photo instead of the live feed
- `src/views/Tools/RigAnimator/useRigCameraPose.ts`: the camera-pose-capture readiness check
  and applying a detected pose onto the rig
- `src/views/Tools/RigAnimator/timelineTicks.ts`: picking a readable tick interval for the rig
  timeline's ruler, whatever the frame range happens to be
- `src/views/Tools/RigAnimator/useRigKeyframeClipboard.ts`: copying and pasting a keyframe's pose
- `src/views/Tools/RigAnimator/useRigBoneMarkerVisibility.ts`: whether the rig's bone markers
  render, re-applied whenever the markers are recreated
- `src/views/Tools/RigAnimator/CameraPoseCapture.vue`: the capture dialog (mirrored camera
  preview, skeleton overlay, Capture/Cancel)
- `src/views/Tools/RigAnimator/useRigHandPose.ts`: the hand pose picker's readiness check and
  applying a preset to whichever hand the selected bone belongs to
- `src/views/Tools/RigAnimator/config.ts`: the scene setup and every tunable, as values only
- `packages/rig/src/pose.ts`, `humanoidRig.ts`, `rig.ts`, `ik.ts`, `handPose.ts`: the
  framework-agnostic logic. See the [rig package's docs](/docs/packages/rig) for the
  pose-capture, clip-building, auto-rig, IK and hand pose API.

## Uploading a model

The view opens with a default character already loaded, so there is something to pose before
uploading anything. **Upload Model**, docked on the canvas itself rather than in the Config
panel, replaces it with any FBX, GLB or GLTF. If it already carries a skeleton (a Mixamo export,
a rigged glTF character), the bone list appears immediately. The camera re-frames to whatever
scale the model happens to use, since a Mixamo FBX is roughly a hundred times the scale of a
typical glTF asset and a fixed camera position would put one of them somewhere behind a shoe.

![Upload Model and Capture Pose from Camera docked at the top left of the canvas](/img/animation/rig-canvas-controls.webp)

## Picking and posing a bone

Every bone gets a small marker, sized as a fraction of the whole rig's spread so it reads at any
model scale, and shrinking with hierarchy depth so a hip or shoulder joint reads larger than a
fingertip further down the chain. Clicking a marker, or picking a name from the Config panel's
**Bone** dropdown, selects it: the marker turns rose, every other one stays the default
periwinkle. **Show Bone Markers**, in the same panel, hides them all for a clean view of the
model itself; picking a bone by clicking its marker is unavailable while they are hidden, but
the **Bone** dropdown still selects one.

Rotating and moving both work two ways, kept in sync with each other:

- **Drag the marker itself** in the 3D view to pose the bone; see the next section for exactly
  what that does. The orbit camera steps aside for the duration of the drag, and the motion
  always tracks the cursor 1:1 on a plane facing the camera, rather than jumping according to
  how foreshortened a world axis looks from that angle.
- **Type into the Bone Rotation / Bone Position fields** in the Config panel, ranged to
  whatever scale the loaded rig happens to be.

Either one updates the model live and the other's fields immediately, so a pose is built by eye
against the model rather than by typing numbers blind.

Only rotation is part of a keyframe. Typing into Bone Position corrects where a bone sits,
which is most useful for nudging an auto-rigged skeleton's guessed joint placement, rather than
authoring an animated translation, so it is not captured by **Add Keyframe** and does not
appear in the exported clip.

## Dragging never stretches a segment

Dragging a marker never moves the selected bone itself. Instead it rotates whichever ancestor
bone(s) get it to wherever the drag ends, so no segment's length ever changes, only its
direction, the way a puppet's limb bends or swings rather than stretching:

- A bone with **two Bone ancestors**, a hand or a foot on any rig regardless of naming, is the
  end of a limb: it solves analytically (the same closed-form two-bone solve any rigging tool
  uses for a shoulder/elbow or a hip/knee) so the two ancestor bones rotate to reach the target.
  The bend favours whichever side it already bent toward before the drag, so the limb keeps a
  consistent, predictable pose as the target moves. A target farther than the limb can reach
  clamps to the fully extended limb rather than failing to solve.
- A bone with **only a Bone parent** (a spine segment, a shoulder root, a thigh whose own
  parent is the skeleton root) has no full chain, so its parent alone rotates to aim it at the
  target: the whole subtree below that parent, everything attached to the dragged bone,
  swings with it as one rigid piece, exactly as tipping a puppet's torso swings its arms too.
- The **skeleton root** (a model's hip bone, typically) has no Bone parent to rotate, so it
  keeps translating freely: nothing above it to preserve a segment length against, so dragging
  it repositions the whole rig rather than stretching anything.

Either way the result is only ever rotation, so it is exactly what **Add Keyframe** already
captures, no different from posing each bone by hand one at a time.

![mixamorigRightHand dragged upward: the elbow bent to follow it, the mesh at the shoulder and elbow intact, the Bone Position field still reading the hand's rest offset since only its shoulder and elbow ancestors rotated](/img/animation/rig-ik-reach.webp)

### Re-aiming the bend without moving the hand

Selecting a hand or foot and then dragging its own mid joint (the elbow, the knee) does not
move that joint as an end effector. Since the joint is the middle of the _selected_ bone's own
chain, dragging it instead re-solves that same chain with the hand or foot held fixed exactly
where it already is, and only the pole hint, which side the bend leans toward, following the
drag. It reads as swinging the elbow around a hand that stays put, exactly like nudging a
puppet's elbow without letting go of its hand. Dragging any other bone, including that same mid
joint when nothing else is selected, poses it normally instead.

## Undoing a bad edit

Typing an exact position can still go too far: a joint moved well past its rest offset tears
the mesh at that seam, since translation, unlike rotation, does not preserve limb length. An IK
reach beyond a limb's own proportions can likewise pull it into an unnatural line. **Reset Bone
to Rest Pose** undoes either back to how the selected bone, and whichever ancestor bone(s) a
drag actually rotated, was when the rig was loaded or auto-rigged, without touching any other
bone or any keyframe already captured.

## The rig timeline

Frame scheduling, keyframes and every way an animation enters or leaves the tool live on one
dedicated bar docked along the bottom of the view, not in the Config panel and not on the
app's shared Timeline panel (built for generic scheduled actions, not pose keyframes): a single
row, split into parts left to right.

![The rig timeline: Play/Add/Delete/Copy/Paste, the ruler and draggable/resizable track with its keyframe markers, a bundled preset picker, and icon-only import/export/reset](/img/animation/rig-timeline.webp)

- **Play/Pause**, **Add keyframe** and **Delete keyframe** act on the current frame.
- **Copy** and **Paste** copy the pose at the current frame onto a clipboard and paste it onto
  whatever frame you scrub to afterward, replacing any keyframe already there. Paste applies the
  pose to the live rig immediately, the same as scrubbing onto an existing keyframe would.
- **The ruler**, above the track, marks frames at whatever round interval keeps roughly fifteen
  ticks readable across the current range (every 10 frames at the default 150-frame range,
  further apart for a longer one). Clicking or dragging the ruler scrubs the playhead exactly
  like the track below it does.
- **The track** is the frame axis. Click or drag anywhere on it to scrub the playhead;
  interpolation between whichever keyframes bracket that instant is what makes two poses ten
  frames apart already read as a movement. Each keyframe shows as a small diamond you can drag
  to reposition it, dropping onto an already-occupied frame replaces whatever sat there, same
  as **Add Keyframe** does. A handle at the track's right edge extends or shrinks the visible
  frame range; it never shrinks past the current frame or the furthest keyframe.
- **Presets**, **Import**, **Export JSON**, **Export GLB** and **Reset** sit at the right, the
  first as a labelled dropdown and the rest as plain icons: see the next two sections.

## Hand pose presets

**Hand Pose**, next to Copy/Paste, offers a handful of canned finger poses (**Open**, **Fist**,
**Point**, **Thumbs Up**) for whichever hand the currently selected bone belongs to: select the
hand itself or any of its fingers, and the dropdown enables once every finger bone that hand
needs is present on the rig. Applying a preset curls each finger joint around its local X axis,
the flexion axis on both hands for a mixamorig-named rig, and only ever touches the selected
hand's own fingers. Like a manual bone edit, it changes the live rig immediately; **Add
Keyframe** is still what commits it to the timeline. Finger bones are not part of the auto-rig
heuristic's generated skeleton, so this is only available on a model that already shipped with
them, such as a genuine Mixamo export.

![The right hand curled into the Fist preset, its fingers closed while the rest of the rig stays untouched](/img/animation/rig-hand-pose-fist.webp)

## Auto-rig for a model with no skeleton

A model with meshes but no skeleton shows **Auto-rig as Humanoid** in the Config panel instead
of a bone list. It generates a canonical Mixamo-named bone hierarchy sized from the model's own
bounding box, then binds each mesh to it by walking the mesh's own surface out from each bone
(a graph search, not a straight line through the model), so a narrow gap the skin doesn't
actually cross does not pull weight from one limb into another. This is a heuristic, not a
hand-weighted rig: it is meant to get an unrigged humanoid posable at all, and can pinch at a
joint on unusual proportions. There is no detection step deciding whether a model "looks"
humanoid: the button is offered whenever a skeleton is missing, and posing it is how you find
out whether the fit works for that particular mesh.

## Capturing a pose from the camera

Once the rig has every bone the mapping needs (`mixamorigLeftShoulder`,
`mixamorigRightShoulder`, and a `mixamorigLeftHand`/`RightHand`/`LeftFoot`/`RightFoot`/`Head` to
drive), **Capture Pose from Camera**, docked on the canvas next to Upload Model, opens a panel
docked to the right half of the screen: the 3D view stays fully visible and interactive in the
left half, so you can watch the rig mirror you live instead of only seeing a preview of the
camera feed. The panel shows a mirrored webcam feed with a live skeleton overlay from
MediaPipe's Pose Landmarker. The overlay only draws a landmark MediaPipe is actually confident
about: one it isn't, typically a body part out of frame, still gets a guessed position
internally, and drawing that would show a confident-looking line to something that isn't really
there.

The model re-centers within the now-narrower visible half rather than sitting off-center against
the panel's edge, without the 3D canvas itself ever resizing: opening the panel shifts the
camera's own view offset, the same technique used for tiled or multi-window rendering, so the
model appears centered in whatever is actually visible. Closing the panel clears it.

![The camera panel docked to the right of the still-interactive 3D view, side by side for a live comparison](/img/animation/rig-camera-split-screen.webp)

Every detected frame applies straight to the rig, live, the moment it arrives: there is no
separate "capture" click. This is what makes the split screen actually prove the mapping
matches, rather than only a snapshot of it, since you can move and immediately see whether the
rig moved the same way. **Add Keyframe** on the rig timeline still commits whatever the rig's
current pose happens to be to the animation, the same as it always has.

**Upload Photo** reads a pose from a still image instead of the live feed, useful for posing
from a reference photo or when there is no working camera. It runs the same Pose Landmarker in
its image mode and feeds the result through the exact same mapping, applying it once as soon as
a person is found. **Use Camera** switches back. A photo is shown as it is, not mirrored, since
it is not a self-view the way a live webcam feed is.

The mapping reads the detector's 3D world landmarks for the wrist, ankle and nose, anchors them
to the rig's own shoulder center, and scales them by the ratio between the rig's shoulder width
and the detected person's, so the same pose maps sensibly regardless of the model's scale.
Anchoring to the shoulders rather than the hips matters in practice: a webcam framed for arms
and head, the normal way to use this feature, usually leaves the hips out of frame, where
MediaPipe still reports a low-confidence guessed position for them rather than nothing, and
anchoring to that guess used to throw the whole mapping off. Each mapped bone then reaches for
its target through the exact same drag-to-chain IK solve a mouse drag on that bone already uses
(see "Dragging never stretches a segment" above): no separate rotation math for camera input,
just a different source of target positions. A body part out of frame, or below the detector's
own confidence threshold, leaves its bone untouched rather than snapping it to the origin.

The head applies before the hands specifically, even though both are just entries in the same
mapping table: the head's own IK chain root is the upper spine, an ancestor of both arms, so
aiming the head bends the spine the arms hang off. Applying it after the hands would drag an
already-placed hand out of position along with that bend.

Spine bend and fingers are not driven by the camera: the Pose Landmarker has no per-vertebra
landmarks to drive a convincing torso curve, so this only drives the limbs and the head. Fingers
have their own manual presets instead, above.

## Presets: evaluating the timeline with real motion

Hand-authoring every keyframe is not the only way to get something on the timeline to try.
**Presets** picks from a handful of real Mixamo mocap clips already bundled under
`public/animations/` (idle, walk, jump, kick, punch, roll, running), sharing this rig's own
bone names since they come from the same character set. A mocap clip carries far more frames
than this tool's sparse pose-keyframe model is meant to show, so picking one samples it down to
twelve evenly-spaced keyframes rather than importing every original frame, replacing whatever
was on the timeline. It is a quick way to see the drag, resize and playback interactions
working against a real, varied pose, not just a hand-posed test case.

## Saving and loading the animation

**Export GLB** bakes the model and the authored clip into one `.glb`, playable in any glTF
viewer or engine outside this tool. **Export JSON** saves just the pose keyframes, which
**Import** reads back into this same tool for further editing: the GLB is the portable result,
the JSON is the editable source.

## The edit survives a refresh

Every keyframe add, delete, drag and frame-range resize is saved to `localStorage` as it
happens, and restored automatically the next time the view loads, so an accidental refresh does
not lose the work in progress. Only the edit itself is saved, never the loaded model: an
uploaded file's blob URL cannot survive a refresh anyway, so the restored keyframes apply to
whatever model loads next, correctly if it is still the same rig. **Reset** on the rig timeline
clears every keyframe and the autosave behind them, back to a blank edit, whenever you want to
start over rather than undo one thing at a time.
