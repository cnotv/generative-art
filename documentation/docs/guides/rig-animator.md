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
  dragging, wiring the rig timeline and the Config panel schema to the composables below,
  keyboard/gamepad frame shortcuts via `@webgamekit/controls`)
- `src/views/Tools/RigAnimator/useRigModel.ts`: the loaded model, its rig, its bone markers,
  its rest poses and the selected bone
- `src/views/Tools/RigAnimator/useRigKeyframes.ts`: the authored pose keyframes, the preview
  clip built from them, and explicit autosave persistence on every genuine edit
- `src/views/Tools/RigAnimator/useRigPlayback.ts`: real-time playback of the preview clip
  (play/pause, per-tick advance, scrubbing to a frame)
- `src/views/Tools/RigAnimator/useRigKeyframeIO.ts`: every way keyframes enter or leave the
  tool: GLB/JSON export, JSON import, loading a bundled preset, autosave restore and reset
- `src/views/Tools/RigAnimator/rigModel.ts` (+ `.test.ts`): loading a model file, generating an
  auto-rig, and ordering the Bone dropdown's display
- `src/views/Tools/RigAnimator/boneMarkers.ts`: the clickable, hierarchy-scaled per-bone markers
- `src/views/Tools/RigAnimator/boneDragPlane.ts`: the camera-facing plane a drag reads the
  pointer against, so posing never jumps with a world axis
- `src/views/Tools/RigAnimator/boneDragTarget.ts`: resolves a drag toward a world-space target
  into a two-bone IK solve, a one-bone aim, a pole-hint re-aim, or (for the skeleton root only)
  a plain translate, carries the skeleton root along with an interactive drag on a foot or the
  head (see "Dragging never stretches a segment" below), and resets whichever bones a drag
  rotated back to rest
- `src/views/Tools/RigAnimator/useRigBoneDragTarget.ts`: wraps `boneDragTarget.ts`'s solve for
  the view, syncing the panel's Bone Position field with whatever the solve lands on
- `src/views/Tools/RigAnimator/frameRange.ts`, `keyframeOps.ts`: pure helpers for resizing the
  timeline's frame range, repositioning one or many dragged keyframes together, and merging a
  new source's sampled keyframes into a body-part scope without disturbing the rest
- `src/views/Tools/RigAnimator/bodyPartGroups.ts` (+ `.test.ts`): the five body-part groups a
  capture or preset can be scoped to, and the pure logic behind toggling one from the Merge
  Target diagram — see **Merging sources by body part** below
- `src/views/Tools/RigAnimator/MergeTargetDiagram.vue`: the clickable stick-figure diagram
  itself, docked on the canvas
- `src/views/Tools/RigAnimator/frameSelection.ts`: the drag-select / Shift+click / Shift+arrow
  range selection's pure logic — normalizing the two endpoints and which keyframes fall inside
- `src/views/Tools/RigAnimator/autosave.ts`: reading and writing the autosaved edit in
  `localStorage`
- `src/views/Tools/RigAnimator/presets.ts`: the bundled example animations, and sampling one
  into a sparse set of pose keyframes
- `src/views/Tools/RigAnimator/useRigMotionRecording.ts`: the frame-timing logic behind
  **Record Motion** — when real elapsed time has reached a new frame to sample
- `src/views/Tools/RigAnimator/useRigRecordedPresets.ts`: session-only presets built from a
  finished Record Motion take, offered in the same **Presets** picker as the bundled clips
- `src/views/Tools/RigAnimator/RigTimeline.vue`: the dedicated panel for playback, keyframes,
  the frame axis, presets, import and export (see below)
- `src/views/Tools/RigAnimator/cameraFraming.ts` (+ `.test.ts`): framing the camera to whatever
  scale the uploaded model happens to use, and to a detected photo's own viewing angle
- `src/views/Tools/RigAnimator/export.ts`: the GLB/JSON export and JSON import file handling
- `src/views/Tools/RigAnimator/panelSchema.ts`: the Config panel schema (upload, auto-rig,
  bone selection and pose fields), rebuilt whenever the bone list or the auto-rig availability
  changes
- `src/views/Tools/RigAnimator/cameraPoseMapping.ts`: pure mapping from detected camera
  landmarks to world-space bone targets, anchored and scaled to the loaded rig, plus the
  exponential-moving-average landmark smoothing the live camera feed uses
- `src/views/Tools/RigAnimator/cameraHandPoseMapping.ts` (+ `.test.ts`): pure mapping from
  detected hand landmarks to per-finger joint curl, hand orientation, and MediaPipe's
  handedness label to the rig's actual left/right
- `src/views/Tools/RigAnimator/useVideoLandmarkDetection.ts`: runs MediaPipe's Pose and Hand
  Landmarkers against a playing `<video>` element in a `requestAnimationFrame` loop, including
  hand orientation alongside finger curl, shared by the live webcam feed and an uploaded video
  file
- `src/views/Tools/RigAnimator/useCameraPoseCapture.ts`: the webcam stream for the capture
  dialog's overlay, wiring `useVideoLandmarkDetection` against it
- `src/views/Tools/RigAnimator/useVideoPoseCapture.ts`: an uploaded video file played through
  once, wiring `useVideoLandmarkDetection` against it the same way the webcam stream does
- `src/views/Tools/RigAnimator/useVideoTimelineSync.ts`: keeps the rig timeline's frame and an
  uploaded video's playback position in sync while the **Sync timeline to video** toggle is on
- `src/views/Tools/RigAnimator/useCameraPhotoPose.ts`: reading a body and hand pose from a
  single uploaded photo instead of a continuous feed
- `src/views/Tools/RigAnimator/useRigCameraPose.ts`: the camera-pose-capture readiness check
  and applying a detected pose onto the rig
- `src/views/Tools/RigAnimator/timelineTicks.ts`: picking a readable tick interval for the rig
  timeline's ruler, whatever the frame range happens to be
- `src/views/Tools/RigAnimator/useRigKeyframeClipboard.ts`: copying and pasting one keyframe's
  pose or a whole selected block of them, offset-relative so paste can drop it anywhere
- `src/views/Tools/RigAnimator/useRigFrameRipple.ts`: ripple removing or inserting a selected
  frame range, shifting everything after it and changing the timeline's own length, unlike a
  plain keyframe delete
- `src/views/Tools/RigAnimator/useRigBoneMarkerVisibility.ts`: whether the rig's bone markers
  render, re-applied whenever the markers are recreated
- `src/views/Tools/RigAnimator/rigColliders.ts` (+ `.test.ts`): pure derivation of one capsule
  per bone segment from the loaded skeleton, and the per-frame read of where that capsule sits
- `src/views/Tools/RigAnimator/marbles.ts` (+ `.test.ts`): pure helpers for one marble's drop
  point, radius and texture, picking the texture from the Marble Editor's own marble assets
- `src/views/Tools/RigAnimator/rigPhysicsObjects.ts`: creating and disposing the bone capsules,
  a marble, the enclosing walls, the hanging lamp and the touch-sensor spawn cube
- `src/views/Tools/RigAnimator/useRigPhysics.ts`: owns those bodies, driving the continuous
  marble flow as a timeline action, following the posed bones each frame and checking each frame
  whether a bone is touching the spawn cube
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

A third docked button, Physics, sits beside these two. Once it is on, a fourth joins it, Marble
Flow, which starts and stops the drip; dropping one on demand is a touch, not a button, covered
in its own section below along with Physics.

![Upload Model, Capture Pose from Camera and Physics docked at the top left of the canvas](/img/animation/rig-canvas-controls.webp)

## Picking and posing a bone

Every bone gets a small marker, sized as a fraction of the whole rig's spread so it reads at any
model scale, and shrinking with hierarchy depth so a hip or shoulder joint reads larger than a
fingertip further down the chain. Clicking a marker, or picking a name from the Config panel's
**Bone** dropdown, selects it: the marker turns rose, every other one stays the default
periwinkle. **Show Bone Markers**, in the same panel, hides them all for a clean view of the
model itself; picking a bone by clicking its marker is unavailable while they are hidden, but
the **Bone** dropdown still selects one. That dropdown lists the core skeleton first, in a
posing-relevant order (hips, spine, neck, head, then each limb root), before anything else the
rig happens to carry (fingers, toes, a custom rig's own extra bones), rather than whatever
arbitrary order the model's own source file listed its skeleton in: an uploaded model's own
`skeleton.bones` array reflects however its skin table happened to store them, not the
hierarchy, and came back for the bundled default model as Neck, Spine2, Spine1, LeftShoulder,
Spine, Hips, in that order. Reordering only the dropdown's display, never the rig's own bone
array, is what makes a spine bone to bend a back into a seated or prone curve findable at all,
rather than buried in a scramble of fifty finger bones.

Rotating and moving both work two ways, kept in sync with each other:

- **Drag the marker itself** in the 3D view to pose the bone; see the next section for exactly
  what that does. The orbit camera steps aside for the duration of the drag, and the motion
  always tracks the cursor 1:1 on a plane facing the camera, rather than jumping according to
  how foreshortened a world axis looks from that angle.
- **Type into the Bone Rotation / Bone Position fields** in the Config panel, ranged to
  whatever scale the loaded rig happens to be.

Either one updates the model live and the other's fields immediately, so a pose is built by eye
against the model rather than by typing numbers blind. A single spine segment only bends its
own immediate parent when dragged (see "Dragging never stretches a segment" below), so curving
a whole back into a seated or prone pose means selecting Spine, Spine1, Spine2 and Neck in turn
and rotating each a little, the same way a real spine's curve is really several vertebrae each
bending a small amount rather than one joint bending sharply.

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

Dragging a **foot or the head** also carries the skeleton root along with it, translated by
however far that end effector still has to travel to reach the drag target, before the two-bone
solve above runs. The leg or neck then only has to close whatever small gap is left, rather than
bending to cover the whole distance itself: a leg supports the body's own weight and a head sits
on top of the spine, so pulling either normally moves the body along with it, the way it does in
life, rather than stretching the limb away from a body that stays planted. A hand is deliberately
left out of this: reaching for something normally bends the elbow while the torso stays put, and
this is the same reason applying a captured camera pose does not carry the root along either
(every limb has to reach its own already-correct target independently in that pass; only an
interactive single-bone drag gets this).

| Before the drag                                                                                  | After dragging one foot                                                                                                                                              |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ![Standing T-pose, bone markers on, both feet level](/img/animation/rig-root-follow-before.webp) | ![The same rig after dragging the right foot marker upward: the whole body has risen with it, the leg itself barely bent](/img/animation/rig-root-follow-after.webp) |

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
app's shared Timeline panel (built for generic scheduled actions, not pose keyframes). The main
row holds transport and editing; a second row, collapsed by default, holds **Hand Pose** and
**Presets** — see **A second row for Hand Pose and Presets** below.

![The rig timeline: Play/Add/Delete/Copy/Paste, the ruler and draggable/resizable track with its keyframe markers, a bundled preset picker, and icon-only import/export/reset](/img/animation/rig-timeline.webp)

- **Play/Pause** and **Add keyframe** act on the current frame.
- **Delete** and **Copy** act on the current selection when one covers any keyframes (see
  below), or on the keyframe at the current frame otherwise. **Paste** drops the copied
  keyframe(s) starting at the current frame, replacing any keyframe already there, and applies
  the pose landing on the current frame to the live rig immediately, the same as scrubbing onto
  an existing keyframe would.
- **Remove Frames** and **Insert Frames** act on the current selection only (both disabled with
  none active) and change the timeline's own length, unlike Delete: **Remove Frames** cuts the
  selected range out entirely and shifts everything after it back to close the gap, shrinking
  the timeline; **Insert Frames** opens up blank room the size of the selection at its own
  start and shifts everything after it forward, growing the timeline by that much. Either way
  the selection is gone afterward, since the frames it covered no longer mean the same thing.
- **The ruler**, above the track, marks frames at whatever round interval keeps roughly fifteen
  ticks readable across the current range (every 10 frames at the default 150-frame range,
  further apart for a longer one). Clicking or dragging the ruler behaves exactly like the track
  below it does — see the next two bullets.
- **The track** is the frame axis. A plain click scrubs the playhead there, same as it always
  has; click-and-drag instead grows a range selection live from where the drag started to
  wherever it ends, released, shaded across the track behind the keyframe markers so they stay
  visible on top of it — see **Selecting a range of frames** below. Each keyframe still shows as
  a small diamond you can drag to reposition it, dropping onto an already-occupied frame
  replaces whatever sat there, same as **Add Keyframe** does; dragging one that is part of the
  current selection instead moves the whole selected block together, preserving its spacing. A
  handle at the track's right edge extends or shrinks the visible frame range; it never shrinks
  past the current frame or the furthest keyframe.
- **Import**, **Export JSON**, **Export GLB** and **Reset** sit at the right as plain icons,
  followed by the chevron that opens the second row.

### A second row for Hand Pose and Presets

**Hand Pose** and **Presets** are reached far less often than the transport and editing actions
above them, so they live in a second row, collapsed by default: the chevron at the right end of
the main row opens and closes it, keeping the always-visible row from crowding out the track
itself. Below an 1080px-wide viewport, **Import**, **Export JSON**, **Export GLB** and **Reset**
move into this second row too, freeing up the main row down to just the controls used
constantly on a narrower screen; above that width they stay in the main row as usual. Either
way each of those four is a single button reachable from exactly one row at a time, not two
separate controls.

### Selecting a range of frames

Copy, Delete and dragging a keyframe all act on more than one frame at once once a selection is
active, shown as a translucent red band across the track — the same red as the playhead —
sitting behind the keyframe markers rather than covering them. Three ways to set or extend it:

- **Click and drag** on the ruler or the track: the band grows live from the frame the drag
  started on to wherever the pointer currently is, and freezes there on release. Releasing
  without ever having moved the pointer is just a plain click instead — it seeks the playhead
  there and drops any existing selection, exactly like a click always did before selection
  existed.
- **Shift+click** a frame to extend the existing selection to it (or, with nothing selected yet,
  to start one running from the current playhead frame to the clicked one). This never seeks the
  playhead and never clears the selection, even without a drag.
- **Shift+Left Arrow / Shift+Right Arrow** extends the selection by one frame at a time in either
  direction, starting from the current playhead frame if nothing is selected yet — see **Frame
  shortcuts** below.

A keyframe inside the active selection gets a highlighted ring so it is clear which ones Copy,
Delete or a block drag will actually touch.

## Hand pose presets

**Hand Pose**, in the rig timeline's second row (see **A second row for Hand Pose and Presets**
above), offers a handful of canned finger poses (**Open**, **Fist**,
**Point**, **Thumbs Up**) for whichever hand the currently selected bone belongs to: select the
hand itself or any of its fingers, and the dropdown enables once every finger bone that hand
needs is present on the rig. Applying a preset curls each finger joint by the preset's angle
around its own local X axis, composed on top of that joint's rest pose rather than overwriting
its rotation outright, and only ever touches the selected hand's own fingers. The composition
matters for the thumb's own first joint specifically: it rests with a real tilt on every axis
(anatomically, not an authoring accident), unlike the four straight fingers and the thumb's own
other two joints, whose rest is near enough to zero, so overwriting just the X component used to
leave a curled thumb barely moving at all. The same positive angle that curls a straight finger
into the palm curls that one joint away from it instead, so its own angle alone is negated. Like a
manual bone edit, applying a preset changes the live rig immediately; **Add Keyframe** is still
what commits it to the timeline. Finger bones are not part of the auto-rig heuristic's generated
skeleton, so this is only available on a model that already shipped with them, such as a genuine
Mixamo export.

![The right hand curled into the Fist preset, its fingers closed while the rest of the rig stays untouched](/img/animation/rig-hand-pose-fist.webp)

### Fingers from the camera

Camera capture and Upload Photo also run MediaPipe's Hand Landmarker alongside the Pose
Landmarker, reading real per-finger curl instead of only offering these canned presets. For each
hand it detects, it measures the bend at every joint the same way a preset's angle already
means, zero for straight and growing as the joint curls, and applies it through the exact same
`applyHandPose` a preset uses, so it fits a model's fingers no differently than picking Fist
would. This rides along on the same live application the body mapping already does: no separate
button, no separate confidence gate, since a hand simply not being detected in frame just leaves
whatever the fingers were doing untouched.

Every joint's bend, the thumb's included, is measured the same way: the angle between the
landmark before it, the joint itself, and the landmark after it, using the wrist as the "before"
point for each finger's own first joint. `applyHandPose` composes that angle onto the joint's own
rest-pose quaternion rather than overwriting it outright, which is what makes a single shared
formula work for the thumb's first joint (its CMC) too, despite that joint's own rest pose
carrying a real tilt on every axis that the four straight fingers' own first joints do not (see
"Hand pose presets" above). Verified against a real recorded gesture sequence run through the
live pipeline, not only synthetic landmarks: see
[the journey doc](/docs/journey/rig-animator-pose-capture-fixes) for two dead ends ruled out
along the way, including one that reads as anatomically reasonable right up until a real camera
disagrees with it.

The measured angle is scaled by **Hand Sensitivity** (1.5 by default) before it drives the rig,
the same idea as **Reach Multiplier** above but for finger curl instead of limb reach. A real
hand rarely folds a joint, the thumb's own base joint especially, as far as the canned presets'
hand-picked extremes do: reading a recorded clip's raw angles directly against those presets, the
thumb's outer two joints reached or passed the preset's own reference values, but its base joint
topped out well short of it, even during a gesture the video showed clearly closing toward a
fist. Applying it exactly as measured is a real, defensible choice (see "Extra details to try"
below for that trade-off), but it reads as barely moving next to a preset's own confident range,
so the default asks for something closer to that range instead. See
[the journey doc](/docs/journey/rig-animator-pose-capture-fixes) for the two earlier findings
(what the raw geometry can and cannot reach on its own) this scaling builds on.

MediaPipe's own handedness label, and its own left/right landmark indices, are read straight
through with no swap: an earlier version swapped the Hand Landmarker's label specifically,
reasoning from MediaPipe's documented caveat that it assumes a mirrored ("selfie") input; a
real camera session immediately surfaced that as wrong, an arm and its own hand visibly moving
as if they belonged to each other. The body Pose Landmarker's own left/right needs no swap
either, confirmed separately against a real photo. What the live camera path does instead, for
both detectors together, is described below.

### Hand rotation from the camera

A detected hand also turns its own hand bone: which way the palm faces, not only where the
wrist sits or how curled each finger is. Two directions from the hand's own landmarks (along the
fingers, from the wrist to the middle knuckle; across the knuckle row, from the index knuckle to
the pinky knuckle) are enough to fully orient it, matched against the rig's own equivalent rest
directions (read straight off the middle, index and pinky finger bones' own rest positions,
since they are direct children of the hand bone) rather than against wherever the hand bone
happens to be pointing at that instant. That distinction matters here specifically: the arm's
own position solve leaves the hand pointing wherever its own target happens to put it, with no
relationship to the hand's own detected orientation, so an alignment measured from "wherever it
currently is" can land close enough to the exact opposite of the target to flip unpredictably
between frames — confirmed against a real recorded gesture sequence before this shipped; see
[the journey doc](/docs/journey/rig-animator-pose-capture-fixes) for what that looked like and
why building the target directly, with no reference to "current" at all, fixed it. Requires the
same finger bones the finger-curl detection above does; a rig with no fingers is left untouched.

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
there. The body skeleton's own rough hand points (a pinky/index/thumb knuckle per side, far
coarser than the dedicated Hand Landmarker's own 21 points per hand) are dropped from this
overlay whenever that hand was separately detected, so the two skeletons never draw on top of
each other for the same hand.

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

### Recording motion instead of posing one keyframe at a time

Every detected frame already applies live to the rig, but committing it to the timeline
normally still takes a manual **Add Keyframe** click per pose. **Record Motion**, next to
Close in the camera panel, turns a live performance into an authored clip automatically
instead: while it is on, every applied camera frame samples the rig's current pose onto the
timeline at whatever frame real elapsed time has reached, at the panel's own FPS setting, so
scrubbing the timeline afterward plays back the performance the same way any hand-authored
clip does. The visible frame range grows to keep up with a long take rather than cutting it
off, the same way the timeline's own resize handle only ever extends to fit real content.
**Stop Recording**, the toggle's own second click, ends the take; closing the camera panel or
switching to an uploaded photo stops it too, since a still photo has nothing to keep sampling.
Recording works the same way against an uploaded video, see below — only a still photo cannot
be recorded from.

![The camera panel's action row mid-recording: Record Motion toggled to a red Stop Recording button, next to Upload Photo and Close](/img/animation/rig-record-motion.webp)

Recording and the rig timeline's own **Play/Pause** both drive the current frame, so starting
either one stops the other first rather than letting them fight over it. While recording, the
preview clip is not rebuilt or scrubbed on every sampled frame either — only once, when the
take ends — since rebuilding it from the whole keyframe list on every one of several samples a
second made each capture slower than the last and read as the model stuttering, even though
every frame was still captured correctly underneath it.

Starting a take also captures the live pose already on the rig at that exact instant, before
any elapsed-time sampling begins. Without that, the take's very first frame carried no
keyframe of its own — sampling only ever adds one once real time has moved past it — so
scrubbing or playing into the start of the recording interpolated from whatever pose, if any,
already sat there instead, a visible twitch right at the seam. Once a take ends, it is added
to **Presets** — see below — so it can be played back or reloaded the same way a bundled
mocap clip can.

**Upload Photo/Video** reads a pose from an uploaded file instead of the live feed, useful for
posing from a reference photo, testing against a known performance, or when there is no
working camera. A photo runs the same Pose Landmarker in its image mode and feeds the result
through the exact same mapping, applying it once as soon as a person is found. A video instead
plays through once at its own rate and runs the exact same live VIDEO-mode detection loop the
camera feed uses (`useVideoLandmarkDetection`, shared between them), so it drives the rig
continuously the same way a webcam does — Record Motion works against it exactly as it does
against the camera, and starts automatically: uploading a video begins a take as soon as
playback starts, and the take ends on its own once the video reaches its natural end, the same
as a manual **Stop Recording** click would. It plays once rather than looping specifically so
that end has something to trigger on. Either kind stays available once something is already
loaded, so picking a different file never needs switching back to the camera first, and **Use
Camera** switches back from either. A photo or video is shown as it is, not mirrored, since
neither is a self-view the way a live webcam feed is, and the detected pose maps onto the rig
unmirrored too, matching what the upload actually shows. Uploading either always turns **Show
Camera Preview** on too, regardless of whatever it was last left at: the whole point of picking
one is to look at it and its detected pose together, and running detection against an upload
with the preview still hidden would show nothing for it.

An uploaded video also gets its own native scrub bar, and a **Sync timeline to video** toggle
next to Record Motion, on by default. With sync on, dragging the rig timeline's own playhead
seeks the video to match, and scrubbing the video's native controls moves the timeline's frame
back the same way — the two stay locked together in both directions, so comparing a specific
moment in the source against the rig it drove is a single scrub rather than two. Sync only
applies outside a take: while Record Motion is running the timeline is already advancing from
the capture itself, not from playback or a scrub, so sync stands aside rather than fighting it.
Turning the toggle off frees the video to be scrubbed on its own — useful for stepping back
through a longer clip without the timeline chasing every frame of it.

### Mirrored like a real mirror

The live camera path mirrors the detected pose, not only the preview. A rig facing its own
viewing camera the same way the subject faces their webcam moves the subject's real right arm
on whichever screen side an actual mirror would show as the subject's left, unless the pose
itself is reflected the same way the preview already is: `mirrorCameraLandmarks` negates every
landmark's x and swaps each left/right pair (shoulders, wrists, hips, ankles, and so on) right
where MediaPipe's landmarks are first read, before any of the mapping above ever sees them, and
`mirrorCameraHandPoses` does the equivalent swap for which side a detected hand's finger curl
lands on. Everything downstream, the bone mapping and the model-turning yaw estimate below
alike, needed no changes of its own: both simply read whichever pose they are handed, and a
pre-mirrored one comes out correctly mirrored on its own. A photo or an uploaded video gets
neither of these, since its own preview is not mirrored either.

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

Feet and knees scale off the rig's own hip width instead of its shoulder width, anchored to the
hip center rather than the shoulder center, whenever the photo shows the hips confidently: a
rig's leg length does not reliably track its shoulder width the way a real human's roughly
does. A real seated photo surfaced this directly on a stylized character whose own legs, rest
to rest, measured four times its shoulder width, a ratio well past a real body's: scaling the
detected ankle reach off the shoulders left the target barely a third of the leg's own length,
forcing the knee to fold into an unnatural crouch just to take up the slack neither end of the
chain actually had. Feet, knees and the hips themselves are simply left untouched, the same as
any other bone the mapping doesn't drive this frame, whenever the hips aren't confidently
detected: an earlier version fell back to scaling and anchoring them off the shoulders instead,
which kept the ankle visually tracked but moving relative to a basis that had nothing to do with
where the camera actually showed it, reading as the legs drifting on their own rather than
following the feed. A webcam framed for arms and head, the normal way to use this feature,
usually leaves the hips out of frame the whole session, so the legs simply hold still for as
long as that framing lasts, the same as they would with nobody in frame at all.

Confident visibility scores alone turned out not to be enough to trust a hip reading either.
Fed something other than a body, a hand filling the frame being the most common way that
happens, a detector can report a hip landmark pair that is visible, and even lands below the
shoulders, while still being nowhere near a real hip: on a real recorded clip the two landmarks
came back essentially coincident, a span thousandths of a unit wide. Dividing the rig's own real
hip width by a span that tiny produces a scale in the hundreds, and multiplying an ankle's
detected offset by a scale that large flings the resulting target far outside anywhere the rig
itself reaches, reading as the legs launched to some absurd position rather than merely posed
wrong. A hip span below a small fixed floor, comfortably under any real hip width but well above
a coincident pair's, is rejected the same way a missing landmark already is. The foot, knee-pole
and hip targets themselves carry one more check on top of that, independent of how plausible the
hip anchor driving them looked: a real foot, knee or hip never sits above the shoulders in any
pose this feature supports, and a target that maps there, however it got there, is dropped for
the same reason a head target that maps below the shoulders already is.

Applying a captured pose only drives whichever body-part groups the Merge Target diagram
currently has active — see **Merging sources by body part** below. A bone outside every active
group is left exactly as it was, whether that is an earlier capture, a preset, or a manual edit,
so a capture can be re-shot for just one limb without disturbing the rest of the rig. Within an
active group, a bone the mapping does not drive this particular frame either, a landmark that
momentarily drops below the confidence threshold or a bone camera capture never touches at all,
is likewise left exactly where it already was rather than snapped back to rest: a live feed's
own confidence dips from one frame to the next, and resetting on every dip reads as the affected
limb flickering back to rest and forward again instead of just holding still, most visibly on a
hand that drops out of frame for a moment while the body stays tracked.

The head applies before the hands specifically, even though both are just entries in the same
mapping table: the head's own IK chain root is the upper spine, an ancestor of both arms, so
aiming the head bends the spine the arms hang off. Applying it after the hands would drag an
already-placed hand out of position along with that bend.

Aiming the head resets that spine bone to its rest orientation immediately before re-aiming it,
every time the head is driven, the same way the dragged bone's own position is reset before any
drag-to-chain solve. The aim itself turns the bone by the shortest rotation from wherever it
currently faces to the target, so without that reset it turns from whatever a previous frame (or
the torso twist below) left it at rather than from a fixed, known starting point — a live feed's
own frame-to-frame noise, or simply enough frames accumulating something the shortest-rotation
math does not perfectly cancel back out, could then read as the head, and the spine it bends,
lurching into a bent or twisted pose with no relation to the target actually driving it that
frame. Resetting first makes the result a function of this frame's target alone.

Spine bend is not driven by the camera: the Pose Landmarker has no per-vertebra landmarks to
drive a convincing torso curve, so this only drives the limbs and the head. Fingers are, through
a second detector alongside it, covered in "Fingers from the camera" above.

The torso also twists to roughly the angle the photo shows the subject from, so a turned pose
reads as turned on screen too instead of always facing forward: the hips and feet stay planted,
only the chest, arms and head turn, the way a real turn reads rather than the whole rig spinning
in place like a turntable. This is the one camera-relative detail a single photo's body
landmarks can actually support: MediaPipe's world landmarks are already normalized to a
real-world body scale, so unlike the subject's facing direction, nothing in them hints at how
close or how zoomed in the original camera was. The angle comes from the shoulder line's own
tilt in the horizontal plane: facing the camera straight on, both shoulders sit at the same
depth, and turning moves one shoulder closer to the camera than the other by exactly the angle
turned. This turns the torso, not the 3D view's own camera: the viewport stays entirely under
manual orbit control throughout capture, rather than swinging around on every applied frame and
fighting whatever orbiting was done in between.

The twist itself composes on top of the torso bone's current orientation rather than setting an
absolute one, since that same bone can already carry a real pitch from aiming the head (see
above), and overwriting that would fight the head aim on every frame. Composing the same reading
on top of itself every frame, without anything resetting the bone first, wound the torso up
further each time instead of ever settling: holding a turned pose for even a few seconds spun it
far past the angle actually shown. Relying on the head aim's own reset to also keep the torque
settled turned out not to be enough on its own: the head aim only resets the bone when the head
itself is actually driven that frame, and a frame where it isn't (a low-confidence or implausible
detection, more common than it sounds since a single bad reading during a stretch with no real
body in frame can keep failing the same way for several frames running) left the torque composing
onto whatever the last twist left behind, right back to winding up. The torso bone is now reset
to rest unconditionally, before either solve gets anywhere near it, whenever there's a yaw
reading to apply at all: both solves then always start from the same fixed baseline regardless of
which one actually drove the bone that frame.

The yaw reading itself is also gated against what a real capture session plausibly shows. Past a
full profile turn, a shoulder-line reading alone is no longer trusted by itself: a detector fed
something other than a body, a hand filling the frame being the most common way that happens,
can still report a confident shoulder line at some arbitrary, often near-180-degree angle, and
taking that at face value read as the torso snapping to an unrelated, often extreme orientation
that then held there rather than the subject having turned at all. Past that point the hips also
have to be confidently detected before the reading is trusted: a hand filling the frame has no
reason to also confidently place a pair of hips, while a subject genuinely turning their back to
the camera does, so a real full turn now reaches all the way around while the false read still
gets rejected.

![The Config panel's camera pose options, no "Match Camera Angle to Photo" row among them](/img/animation/rig-camera-pose-no-viewpoint-match.webp)

### Extra details to try

Checkboxes and sliders in the Config panel, shown once the rig has every bone the base mapping
needs, control more of what MediaPipe actually detects and how the result is tuned. The preview
toggle below lives in the camera capture panel itself instead, alongside the other camera
capture actions:

- **Bend Elbows to Photo** and **Bend Knees to Photo**, on by default, feed the detected elbow
  and knee landmarks in as the two-bone IK solve's pole hint, the same re-aim a manual drag on
  that mid joint already does (see "Re-aiming the bend without moving the hand" above). Without
  these, a limb's bend direction just keeps whatever its rest pose had, since the base mapping
  only ever drives the hand or foot as the chain's end target: for anything but a rough T-pose,
  the two-bone solve then has to reach the target by rotating almost entirely at the elbow or
  knee while the upper arm or thigh barely moves at all, since that is the only bend direction it
  has to work with. A seated photo is the clearest case: the solve was pulling nearly its whole
  bend into the forearm and shin, which stayed pointed straight down from the shoulder or hip
  like a standing pose, folding the limb into an unnatural zigzag rather than the shoulder/hip
  and elbow/knee sharing the bend the way a real arm or leg actually does. Turning them off goes
  back to that behaviour, closest to the original mapping.
- **Bend Neck to Photo**, on by default, feeds the detected ear midpoint in as the head chain's
  own pole hint, the same idea as the elbow and knee options above. MediaPipe has no landmark
  for the neck itself the way it does for an elbow or knee, so the ear midpoint stands in as the
  closest available proxy for which way the head should lean; without it the neck bends however
  the two-bone solve happens to pick, which read as the head tending to point down with an
  implausible fold at the neck.
- **Move Hips to Photo**, off by default, moves the rig's root to the detected hip midpoint
  instead of leaving it at rest, so a lean or a step reads in the root position too, not only the
  limbs. Left off by default since it did not measurably improve the seated case above on its
  own, and moving the whole root is a bigger, more visible change than re-aiming a limb's bend.
  Unlike every other mapped bone, the root is never snapped back to rest on a frame with no hip
  target of its own — a webcam framed for arms and head routinely loses the hips out of the
  bottom of the frame for a stretch of frames at a time, and resetting the whole rig to the
  origin on each of those read as the model twitching back to rest rather than simply not moving
  that frame. It holds wherever it was last driven to instead, until a fresh hip detection moves
  it again.
- **Use Depth (Z Axis)**, on by default, is the original behaviour: a landmark's estimated depth
  scales into the target the same as its x and y. A single photo gives MediaPipe far less to
  judge depth from than two eyes or a video's own motion parallax do, making z the least
  reliable of the three axes it reports; turning this off projects every target onto the
  shoulder anchor's own depth plane instead of trusting a noisy estimate.
- **Reach Multiplier**, 1 by default, scales every mapped target's distance from its anchor by
  this factor on top of the rig's own proportions, above 1 reaching further than the computed
  scale predicts and below 1 reaching less far. Even with the right bone anchored to the right
  landmark, a rig can still systematically under- or over-reach in a way neither the shoulder nor
  the hip anchor accounts for, most often the head: a stylized character's head and neck length
  relative to its own shoulder width does not have to match a real person's, so the same detected
  nose landmark can pull the neck into a bend that reads as the head always pointing down,
  independent of whatever the photo actually shows. This slider is the manual escape hatch for
  that, tuned by eye per rig rather than solved by a fixed formula.
- **Hand Sensitivity**, 1.5 by default, scales every detected finger joint's own curl angle by
  this factor before it drives the rig, the same idea as Reach Multiplier just above but for
  finger curl instead of limb reach. A real hand rarely folds a joint, the thumb's own base
  joint especially, as far as the canned presets' hand-picked extremes do, so applying the raw
  detected angle unscaled read as barely moving next to those presets' own confident range even
  during a real closing-toward-a-fist gesture. See "Fingers from the camera" above for the
  specific readings this default was chosen against.
- **Show Camera Preview**, a switch in the camera capture panel itself rather than the Config
  panel, off by default, shows the mirrored video/photo preview when turned on; hidden, the
  docked panel shrinks down to just its action buttons and the model gets the full canvas to
  sit in, while the feed keeps being read and applied to the rig exactly the same either way.
  Uploading a photo or video turns it on automatically even if it was off, see
  **Upload Photo/Video** above.

### Smoothing the live feed

A live camera detection runs roughly every frame, and MediaPipe's own per-frame landmark noise,
most visible on depth, reads as jitter if applied to the rig straight. Each frame is blended
against the previous one, an exponential moving average per landmark, before it drives anything;
a photo is a single detection with nothing to blend against, so this only affects the live
camera feed. It costs a small amount of lag for a visibly steadier pose. **Smoothing (Live
Feed)** in the Config panel tunes how much: lower blends in less of each new frame, reading
smoother but laggier. The same blend, and the same slider, also applies to each detected hand's
finger landmarks, tracked separately per hand side rather than by MediaPipe's own per-frame
array order (a hand entering or leaving the frame can shift which index the other hand reports
at, and blending against the wrong hand's last position would read as a jump): a hand's own
per-joint curl angle is a small difference between two nearby points, so the same raw per-frame
noise a body landmark shrugs off reads as visible finger twitching once it is small enough to
change a joint's read angle.

Blending alone still lets one badly misdetected frame through, just scaled down by the smoothing
factor rather than applied whole, which can still read as a sudden snap. **Max Jump (Live
Feed)** clamps how far a landmark may move, past the blend, in a single frame: past that
distance the excess is pulled back rather than applied, so a genuine fast movement still gets
there, just over a couple of extra frames instead of one. Same slider for the body and every
detected hand.

### Frame shortcuts

**Space** (keyboard) or the gamepad's left face button adds a keyframe at the current frame, the
same as the timeline's own **Add Keyframe** button. **Left Arrow** or the gamepad's D-pad left
steps to the next frame; **Right Arrow** or D-pad right steps to the previous one. **Shift+Left
Arrow** and **Shift+Right Arrow** extend the frame selection by one frame in that same direction
instead of stepping the playhead — see **Selecting a range of frames** above. These are
suppressed while a text or number field elsewhere in the panel has focus, so typing a bone
rotation or a Config value never gets hijacked by the arrow keys moving the cursor within it.

## Merging sources by body part

Every source that can drive the rig — a camera or photo capture, a bundled preset, a
Record Motion take — is scoped by the **Merge Target** diagram, a small stick figure with five
clickable regions, Left Arm, Right Arm, Left Leg, Right Leg and Spine / Head (the torso, neck
and head, plus the root bone), all active by default. It only shows up while the camera capture
dialog is open, docked on the canvas next to it, since that is the one place scoping a source
actually matters. Clicking a region, or focusing it with Tab and pressing Enter or Space,
toggles that group on or off; an active region is bright green, an inactive one red — the same
strong go/no-go pair the performance overlay already uses for good/bad, rather than this
project's usual pastel palette, since a binary on/off reads faster as a clear colour than as a
tint. A bone belongs to whichever region its own ancestor chain reaches first walking up toward
the skeleton root (a shoulder or an upper leg marks the start of a limb region; a finger or toe
bone inherits its hand or foot's region the same way), so the figure needs no separate entry for
fingers, toes or a custom rig's own extra bones.

![The Merge Target diagram: two regions clicked off (red) leave the other three (green) active, and the camera capture dialog's status line names exactly those three](/img/animation/rig-merge-target-scope.webp)

With every region active, the default, a source drives the whole rig exactly as before. Turning
some off scopes the _next_ application of a source down to the regions still active: only bones
in those regions are reset and re-driven, and every other bone — however it got its current
pose, an earlier capture, a preset, or a manual edit — is left exactly as it is. That is what
makes a clip buildable from several sources at once: sample a walk preset for the legs, switch
to a camera capture scoped to just the arms, and a hand-authored spine curve underneath both
survives either one.

"Re-shooting" a region falls out of the same rule rather than needing a separate action:
applying a second source scoped to a region already posed from a different one replaces that
region's own contribution — a wobbly arm capture is fixed by capturing it again with only that
region active, without redoing the legs or the spine that were already right. While the camera
capture dialog is open, a status line names exactly which regions the diagram currently has
active, so the scope is visible before capturing rather than only inferable from the diagram's
own colouring.

## Presets: evaluating the timeline with real motion

Hand-authoring every keyframe is not the only way to get something on the timeline to try.
**Presets** picks from a handful of real Mixamo mocap clips already bundled under
`public/animations/` (idle, walk, jump, kick, punch, roll, running), sharing this rig's own
bone names since they come from the same character set. A mocap clip carries far more frames
than this tool's sparse pose-keyframe model is meant to show, so picking one samples it down to
twelve evenly-spaced keyframes rather than importing every original frame. Loading one merges
those sampled keyframes into whichever groups were last active on the Merge Target diagram, the
same scope a camera capture would use — with every region active, the default, that replaces
the whole timeline, same as before. The diagram itself only shows while the camera capture
dialog is open (see **Merging sources by body part** above), but the scope it last set still
applies to a preset loaded with the dialog closed. It is a quick way to see the drag, resize and
playback interactions working against a real, varied pose, not just a hand-posed test case.

A **Record Motion** take that captured any real motion appears in the same dropdown too, as
"Recording 1", "Recording 2" and so on, so a captured performance can be reloaded and replayed
without re-recording it, merged into the Merge Target scope the same way a bundled preset is.
These entries are session-only — a refresh drops them, the same as every unsaved edit that is
not the autosave.

## Dropping marbles on the pose

**Physics**, docked on the canvas next to Upload Model and Capture Pose from Camera, turns the
posed rig into something other objects can hit. It is a way to see a pose as a physical shape
rather than a silhouette: a cupped hand catches marbles, a flat one does not, and playing the
timeline back sweeps them around as the limbs move through them. It mirrors the Config panel's
own **Physics: Simulate** checkbox, the same toggle either way.

![The rig in its rest pose with physics on: a cone-shaded lamp hanging close against its right side and a touch-sensor cube further out past its left hand](/img/animation/rig-physics-lamp-cube.webp)

Turning physics on does not by itself drop anything: it builds the bone capsules, the enclosure,
a heavy cone-shaded lamp hung close to the camera on a rigid pivot arm, and a cube on the rig's
other side. The lamp barely swings and gravity pulls it straight back to hanging still, the way
a real fixture would rather than a pendulum. The cube is a touch sensor, not a button: it has no
collision response of its own, so posing a hand into it does not push it, but the moment a bone
overlaps it a marble drops, the same as pressing a spawn button would, except the model itself is
what presses it. A fourth docked button, Marble Flow, joins Physics once it is on, starting and
stopping the drip described below.

<video controls loop muted playsinline width="720" src="/video/animation/rig-physics-demo.webm">
  Physics is switched on: a lamp and a touch-sensor cube appear beside the rig's rest pose. Marble
  Flow is switched on next, and marbles begin dropping from well above the frame, arriving one at
  a time and catching on the rig's head and outstretched arms as more keep falling.
</video>

Every bone segment, meaning a bone and one of its bone children, gets a capsule sized to that
segment's own length and to a radius scaled off the rig's spread, so the same settings hold for
a Mixamo FBX and a glTF character a hundred times smaller. A branching joint such as the hips
gets one capsule per child rather than one for the joint, and a segment too short to be worth a
body, a coincident bone or a fingertip with nowhere to go, gets none.

The capsules are kinematic, never simulated. Posing, IK, camera capture and clip playback all
write bone transforms, and a dynamic body would fight them for the same values every frame; a
kinematic one is carried by whichever bone it belongs to and pushes everything else out of its
way instead. So the rig is never knocked over by what lands on it, and nothing physical ever
changes a pose or a keyframe.

Marbles arrive one at a time rather than as a single dump, so a hand (posed, or mapped live
from the camera) can be held under the stream and moved through it as it falls, instead of only
ever seeing the aftermath of a heap that landed all at once.

The rest of the settings appear once the toggle is on:

- **Spawn Marbles**, off by default (the docked Marble Flow button is the same switch), starts
  the continuous flow; touching the spawn cube drops one regardless of this setting. Physics
  being on and marbles flowing are separate switches, so enabling one never surprises you with
  the other, and the enclosing walls come and go with this one too: they only matter while
  something is actually falling through them.
- **Marble Flow (Frames)** is the gap between one marble dropping and the next, the same
  interval-action shape the Timeline view uses for its own ball spawner, defaulting to every
  frame. Lower is a denser stream; nothing caps how many accumulate, so a long session keeps
  piling the floor up. **Reset Marbles** clears every marble currently on the floor without
  stopping the flow.
- **Marble Textures**, on by default, paints each marble with one of the Marble Editor's own
  marble images, picked at random per spawn, so the same object drops here as in that game.
  Turning it off leaves the marble a flat pastel colour instead, which is cheaper to draw and
  keeps a dense flow usable.
- **Wall Size** starts at the narrow column the flow falls through rather than the rig's full
  spread, so the walls frame the stream without dwarfing the rig; raise it for more room to
  reach a hand or the lamp through the gap. A floor collider spans the enclosure regardless of
  whether the walls themselves are showing: the view has no ground plane of its own, so without
  it a marble would fall through the world.
- **Wall Opacity**, invisible by default, goes up to solid. Zero keeps the collision without
  drawing anything, useful for looking at the rig unobstructed; solid is the useful one for a
  recording where the walls are the frame.

![A dozen textured marbles mid-fall around the rig, several caught on its head, arm and hip, the lamp and spawn cube visible on either side](/img/animation/rig-physics-marbles.webp)

Everything above is torn out of both the scene and the physics world the moment the toggle goes
off, and rebuilt from scratch when a different model is loaded, so switching it on costs
nothing until it is wanted.

Gravity is scaled to the rig rather than left at the world's own metres per second, since a
Mixamo FBX is a hundred times the scale of a typical glTF character and falling at 9.81 units
in it reads as slow motion. What that costs is speed: a marble then crosses more distance in
one physics step than a wall is thick, which is why they carry continuous collision detection.
The reasoning is in [scale, gravity and tunnelling](/docs/journey/scale-gravity-and-tunnelling).

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
clears every keyframe and the autosave behind them, back to a blank edit, snaps the live rig
back to its rest pose, and returns the playhead to frame 0, whenever you want to start over
rather than undo one thing at a time.
