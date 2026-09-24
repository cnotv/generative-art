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
  dragging, wiring the rig timeline and the rig panel's settings to the composables below,
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
  auto-rig, adopting the bones that actually carry the hierarchy, and ordering the Bone
  dropdown's display
- `src/views/Tools/RigAnimator/boneMarkers.ts`: the clickable, hierarchy-scaled per-bone markers
- `src/views/Tools/RigAnimator/boneDragPlane.ts`: the camera-facing plane a drag reads the
  pointer against, so posing never jumps with a world axis
- `src/views/Tools/RigAnimator/boneDragTarget.ts`: resolves a drag toward a world-space target
  into a two-bone IK solve, a one-bone aim, a pole-hint re-aim, or (for the skeleton root only)
  a plain translate, and resets whichever bones a drag rotated back to rest
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
  **Record Motion**: when the capture's clock has reached a new frame or sample, and swapping the
  take for filtered keyframes when it ends (the filter itself is `filterRecordedSamples` in
  `keyframeOps.ts`)
- `src/views/Tools/RigAnimator/useRigRecordedPresets.ts`: session-only presets built from a
  finished Record Motion take, offered in the same **Presets** picker as the bundled clips
- `src/views/Tools/RigAnimator/RigTimeline.vue`: the dedicated panel for playback, keyframes,
  the frame axis, presets, import and export (see below)
- `src/views/Tools/RigAnimator/rigGround.ts` (+ `.test.ts`): the ground disc under the loaded
  model and the key light's shadow fitted to it
- `src/views/Tools/RigAnimator/cameraFraming.ts` (+ `.test.ts`): framing the camera to whatever
  scale the uploaded model happens to use, and to a detected photo's own viewing angle
- `src/views/Tools/RigAnimator/export.ts`: the GLB/JSON export and JSON import file handling
- `src/views/Tools/RigAnimator/RigConfigAccordion.vue`: the rig panel's settings, one collapsed
  accordion section per group, rendered with the shared `ConfigControls`
- `src/views/Tools/RigAnimator/panelSchema.ts`: the rig panel's setting groups (upload, auto-rig,
  bone selection and pose fields), rebuilt whenever the bone list or the auto-rig availability
  changes
- `src/views/Tools/RigAnimator/cameraPoseMapping.ts` (+ `.test.ts`): body landmark helpers:
  BlazePose's landmark indices, mirroring, the camera yaw estimate, and the time-based One Euro
  filter the live feed smooths every landmark with
- `src/views/Tools/RigAnimator/cameraHandPoseMapping.ts` (+ `.test.ts`): hand landmark helpers:
  mirroring a detected hand onto the other side, and MediaPipe's handedness label to a side
- `src/views/Tools/RigAnimator/cameraPoseFrame.ts` (+ `.test.ts`): one detected frame of body,
  hands and head together: mirroring and smoothing it as a whole, holding each hand steady
  against the detector's own misreadings, the face matrix read into a head rotation, and the crop
  geometry the face and hand detectors run on
- `src/views/Tools/RigAnimator/cameraPoseDetection.ts`: loading the pose, hand and face
  detectors, and running the hand and face ones on crops around the detected body
- `src/views/Tools/RigAnimator/cameraPoseRetarget.ts` (+ `.test.ts`): turning every bone of the
  rig to match a detected frame, see **How a detected pose drives the rig** below
- `src/views/Tools/RigAnimator/fixtures/`: the default character's real skeleton and nine
  frames MediaPipe detected from a dance clip, which the retargeting tests run against
- `src/views/Tools/RigAnimator/useVideoLandmarkDetection.ts`: runs the detectors against a
  playing `<video>` element in a `requestAnimationFrame` loop, shared by the live webcam feed
  and an uploaded video file
- `src/views/Tools/RigAnimator/useCameraPoseCapture.ts`: the webcam stream for the capture
  dialog's overlay, wiring `useVideoLandmarkDetection` against it
- `src/views/Tools/RigAnimator/useVideoPoseCapture.ts`: an uploaded video file played through
  once, wiring `useVideoLandmarkDetection` against it the same way the webcam stream does
- `src/views/Tools/RigAnimator/useVideoTimelineSync.ts`: keeps the rig timeline's frame and an
  uploaded video's playback position in sync while the **Sync timeline to video** toggle is on
- `src/views/Tools/RigAnimator/useCameraPhotoPose.ts`: reading a body, hands and head from a
  single uploaded photo instead of a continuous feed
- `src/views/Tools/RigAnimator/useRigCameraPose.ts`: the camera-pose-capture readiness check,
  the rig's rest pose measured when it is adopted, and applying a detected frame onto the rig
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
- `src/views/Tools/RigAnimator/poseSimilarity.ts` (+ `.test.ts`): pose estimation measures for
  comparing two skeletons over time, used by `clipReproduction.test.ts` to score a capture against
  a recording of a preset
- `scripts/extract-video-landmarks.mjs`, `scripts/render-clip-comparison.mjs`: turning a recording
  into a test fixture, and rendering a test's result side by side with the recording
- `src/views/Tools/RigAnimator/config.ts`: the scene setup and every tunable, as values only
- `packages/rig/src/pose.ts`, `humanoidRig.ts`, `rig.ts`, `ik.ts`, `handPose.ts`: the
  framework-agnostic logic. See the [rig package's docs](/docs/packages/rig) for the
  pose-capture, clip-building, auto-rig, IK and hand pose API.

## Uploading a model

The view opens with a default character already loaded, so there is something to pose before
uploading anything. **Upload Model**, docked on the canvas itself rather than in the rig
panel, replaces it with any FBX, GLB or GLTF. If it already carries a skeleton (a Mixamo export,
a rigged glTF character), the bone list appears immediately. The camera re-frames to whatever
scale the model happens to use, since a Mixamo FBX is roughly a hundred times the scale of a
typical glTF asset and a fixed camera position would put one of them somewhere behind a shoe.

The model stands on a ground disc placed level with its lowest point as loaded, the soles of its
feet in the rest pose, and sized to the model for the same reason. The scene's key light keeps its
direction but has its shadow camera fitted to the model too: its default one is a few units wide,
which a model in centimetres never falls inside, so without refitting it there was no shadow to
show where the feet meet the floor. **Keep Feet on Ground** holds the lowest foot at that same
height while the camera drives the rig.

![The default character in its rest pose standing on the sand coloured ground disc, its shadow cast behind it](/img/animation/rig-ground.webp)

The other docked buttons, left to right: **Bone Markers**, once the model carries a rig, shows
or hides the markers described next. **Show Rig Panel**, a gear, opens and closes the rig panel
described under **Capturing a pose from the camera**, which also holds every setting. **Start
Camera Tracking** opens that panel if it is closed and starts following the webcam, or stops
it. **Record Motion**, a solid red dot, appears once the panel has a live camera or a video to
record from, see **Recording motion** below. **Camera Preview**, while the panel is open, shows
or hides its video preview. **Physics** turns the simulation on, and once it is on **Marble
Flow** starts and stops the drip; dropping one on demand is a touch, not a button, covered in
its own section below. Each toggle flips the same setting as its checkbox in the rig panel, so
the two places always agree.

![Upload Model, Bone Markers, the rig panel gear, Start Camera Tracking, the red Record Motion dot, Camera Preview and Physics docked at the top left of the canvas](/img/animation/rig-canvas-controls.webp)

## Picking and posing a bone

Every bone gets a small marker, sized as a fraction of the whole rig's spread so it reads at any
model scale, and shrinking with hierarchy depth so a hip or shoulder joint reads larger than a
fingertip further down the chain. A marker is drawn small so it does not hide the model, yet
clicks wider than it looks: a pointer ray picks it anywhere within
`BONE_MARKER_HIT_RADIUS_MULTIPLIER` drawn radii of its centre. Across a hand those enlarged areas
overlap, so the marker whose centre the ray passes closest to wins, rather than whichever one
sits nearer the camera. Clicking a marker, or picking a name from the rig panel's **Bone**
dropdown, selects it: the marker turns rose, every other one stays the default periwinkle.
**Show Bone Markers**, in the same panel or on the docked Bone Markers button, hides them all for
a clean view of the model itself; picking a bone by clicking its marker is unavailable while they
are hidden, but
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
- **Type into the Bone Rotation / Bone Position fields** in the rig panel, ranged to
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

Undo, redo and the action log are one control at the left of the timeline's first row: the two
arrows, and a caret beside them that opens the log. Undo steps back through
every change to the keyframe list, whatever made it: a keyframe added or deleted, a block
dragged, pasted or cut, a polish pass, a whole recorded take. The log names each one, newest
first, and strikes through the ones undo has taken away, so a stack of similar steps is still
readable. Fifty steps are kept.

Clicking a line in the log goes straight to that point instead of walking there a step at a
time, in either direction: click one that is struck through to come back forward again. The
next edit made from wherever you stopped drops everything after it, the way undo then drawing
does in any editor.

![The action log open above the timeline row after clicking its oldest line, with the two newer Added keyframe lines struck through and a single keyframe left on the timeline](/img/animation/rig-action-log.webp)

Loading a model, importing a file or restoring the autosave starts the history over rather
than being another step to walk back: undoing past a load would put the previous model's
keyframes onto bones that no longer exist.

Posing a bone by hand is not on that list. A pose only becomes an edit once it is captured as
a keyframe, and until then **Reset Bone to Rest Pose** is what takes it back.

Typing an exact position can still go too far: a joint moved well past its rest offset tears
the mesh at that seam, since translation, unlike rotation, does not preserve limb length. An IK
reach beyond a limb's own proportions can likewise pull it into an unnatural line. **Reset Bone
to Rest Pose** undoes either back to how the selected bone, and whichever ancestor bone(s) a
drag actually rotated, was when the rig was loaded or auto-rigged, without touching any other
bone or any keyframe already captured.

## The rig timeline

Frame scheduling, keyframes and every way an animation enters or leaves the tool live on one
dedicated bar docked along the bottom of the view, not in the rig panel and not on the
app's shared Timeline panel (built for generic scheduled actions, not pose keyframes). The main
row holds transport and editing; a second row, collapsed by default, holds **Hand Pose** and
**Presets** — see **A second row for Hand Pose and Presets** below.

![The rig timeline after a recorded take: Play, Add, Delete, Copy, Paste, Remove and Insert Frames, Filter and Reduce, the ruler and track full of keyframe markers, and icon-only import, export and reset](/img/animation/rig-timeline.webp)

- **Play/Pause** and **Add keyframe** act on the current frame.
- **Delete** and **Copy** act on the current selection when one covers any keyframes (see
  below), or on the keyframe at the current frame otherwise. **Paste** drops the copied
  keyframe(s) starting at the current frame, replacing any keyframe already there, and applies
  the pose landing on the current frame to the live rig immediately, the same as scrubbing onto
  an existing keyframe would.
- **Filter** (the wave icon) smooths the selected keyframes, or the whole clip when nothing is
  selected, one pass further each press. Every keyframe between the first and last of them drops
  a spike, keeping whichever of itself and its two neighbours is closest to the other two, then
  eases halfway toward the midpoint of those neighbours, which softens jitter; a steady movement
  stays where it is, and the first and last keyframes never move. **Reduce** (the shrink icon)
  halves the same keyframes each press, removing every second one between the first and last so
  interpolation fills the gaps. Both need at least three keyframes to act on.
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
  has, and while the animation is playing (not recording) playback carries on from the frame
  clicked instead of snapping back; click-and-drag instead grows a range selection live from where the drag started to
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

Camera capture and Upload Photo/Video also run MediaPipe's Hand Landmarker alongside the Pose
Landmarker, so the fingers follow the real hand instead of only these canned presets. Every
finger joint turns to point where the detected one points, which carries curl, spread and the
thumb's reach across the palm alike, and the hand itself turns to the detected palm. This rides
along on the same live application the body does, with no separate button. A finger's middle and
last joints are hinges, though: they only curl, about the same axis the Hand Pose presets curl
them around, so a reading that bends one sideways or backward lands as a plain curl instead of a
finger bending like a tentacle. See **Keep Joints in Human Range** below.

A hand the Hand Landmarker finds on the whole frame takes priority over anything the body
detector suggests about it. Its side comes from the body's nearer visible wrist, since on a
full-body clip the detector's own left/right label disagreed with the nearest wrist about half
the time; with no wrist in view, a close-up of just a hand, the label decides, read straight
through with no swap. Only a side the whole frame missed is looked for again, in a crop around
that side's own wrist, because the Hand Landmarker is trained on close-ups and misses a hand that
is small in a wide shot. A frame showing a hand but no body curls only that hand's fingers and
leaves the rest of the rig exactly as it was, rather than snapping a body the camera is simply
not showing back to rest. The same holds inside a body: a limb whose landmarks fall under
**Landmark Confidence Needed**, an arm swinging behind the torso, is left where the last frame
that saw it put it, instead of dropping to its rest pose. An upper arm is held when its shoulder
or elbow is lost, a forearm and hand when the elbow or wrist is, and likewise for thigh, shin and
foot.

The Hand Landmarker is also the only source for which way a palm faces. BlazePose reports a
pinky and an index point of its own, but they sit a hand's width apart and jitter by centimetres,
and a palm read from them disagreed with the Hand Landmarker's by more than 90° on about half the
frames of the attached dance clip. Switching between the two whenever the hand detector lost the
hand turned the rig's hand over each time. With no hand found, the forearm and hand now keep the
roll the upper arm gives them; **Palms from Body When No Hand Found** brings the old fallback back.

The hand detector still misreads a palm for a frame or two, so each hand is steadied before any
smoothing. A hand it loses keeps its last reading for **Hold a Lost Hand**, 330 ms by default,
instead of dropping out. A palm turned more than **Palm Turn to Confirm**, 45° by default, from the
last reading it trusted is ignored until three readings in a row agree on it: no wrist turns that
far between two frames, while the detector does. How much each of these helped, and how it was
measured, is in [Copying a Performer onto a Rig](/docs/journey/camera-motion-retargeting).

## Auto-rig for a model with no skeleton

A model with meshes but no skeleton shows **Auto-rig as Humanoid** in the rig panel instead
of a bone list. It bakes every mesh into the model's own space, generates a canonical
Mixamo-named bone hierarchy sized from the model's bounding box, then binds all the meshes to it
as one surface, walking that surface out from each bone (a graph search, not a straight line
through the model), so a narrow gap the skin doesn't actually cross does not pull weight from
one limb into another. A model denser than `AUTO_SKIN_SURFACE_VERTEX_LIMIT` is bound by
straight-line distance instead, since the surface search grows with the square of the vertex
count. This is a heuristic, not a hand-weighted rig: it is meant to get an unrigged humanoid
posable at all, and can pinch at a joint on unusual proportions. Why each of those steps exists
is in [Auto-rigging an upload](/docs/journey/auto-rigging-uploads). There is no detection step deciding whether a model "looks"
humanoid: the button is offered whenever a skeleton is missing, and posing it is how you find
out whether the fit works for that particular mesh.

## Capturing a pose from the camera

Once the rig has every bone the mapping cannot do without (`mixamorigHips` and both arms and
forearms; the spine, neck, head, legs, fingers and toes are driven whenever the rig has them),
the rig panel captures from the camera. It docks at the top right of the screen: the 3D view
stays fully visible and interactive beside it, so you can watch the rig mirror you live instead
of only seeing a preview of the camera feed. The gear on the canvas opens it without starting
anything; **Start Camera Tracking** on the canvas, or the camera icon inside the panel, starts
the webcam, and a second press stops it. Opening the panel never turns the camera on by itself.
Its controls are icons: an X at the top closes it, and the action row under the feed holds
upload, camera, and for a video play and sync. Below them sit every setting of the tool, one
accordion section each (Bone, Camera Pose, Camera Smoothing, Camera Detect, Camera Bones,
Physics and Timeline), all collapsed when the panel opens, and the panel scrolls when an open
section runs past the rig timeline. The panel shows a mirrored webcam feed with a live skeleton
overlay from
MediaPipe's Pose Landmarker. The overlay only draws a landmark MediaPipe is actually confident
about: one it isn't, typically a body part out of frame, still gets a guessed position
internally, and drawing that would show a confident-looking line to something that isn't really
there.

The model re-centers within the part of the canvas the panel leaves visible rather than sitting
off-center against the panel's edge, without the 3D canvas itself ever resizing: opening the
panel shifts the camera's own view offset, the same technique used for tiled or multi-window
rendering, so the model appears centered in whatever is actually visible. Closing the panel
clears it, and restores the camera's aspect ratio in the same step: setting the
offset replaces that aspect with the wider virtual frame's own, and clearing it does not put it
back, which left the model squashed to half its width.

![The rig panel docked at the top right beside the still-interactive 3D view: an uploaded video's preview, the posing scope and status lines, the action icons and the collapsed setting sections, with the red record dot on the canvas](/img/animation/rig-camera-split-screen.webp)

Every detected frame applies straight to the rig, live, the moment it arrives: there is no
separate "capture" click. This is what makes the split screen actually prove the mapping
matches, rather than only a snapshot of it, since you can move and immediately see whether the
rig moved the same way. **Add Keyframe** on the rig timeline still commits whatever the rig's
current pose happens to be to the animation, the same as it always has.

### Recording motion instead of posing one keyframe at a time

Every detected frame already applies live to the rig, but committing it to the timeline
normally still takes a manual **Add Keyframe** click per pose. **Record Motion**, the solid red
dot docked on the canvas while the rig panel has a live camera or a video running, turns a live performance into an authored clip automatically
instead: while it is on, every applied camera frame samples the rig's current pose onto the
timeline at whatever frame real elapsed time has reached, at the panel's own FPS setting, so
scrubbing the timeline afterward plays back the performance the same way any hand-authored
clip does. The visible frame range grows to keep up with a long take rather than cutting it
off, the same way the timeline's own resize handle only ever extends to fit real content.
**Stop Recording**, the same toggle's second click once its dot has turned into a square, ends
the take; closing the rig panel, stopping the camera or switching to an uploaded photo stops it too, since a still
photo has nothing to keep sampling. Recording works the same way against an uploaded video, see
below; only a still photo cannot be recorded from.

A take samples the rig's pose several times per timeline frame, as often as detection keeps up:
twice from the live camera (`RECORDING_SAMPLES_PER_FRAME`), and as many times as **Video Slowdown
Ratio** from an uploaded video. The keyframes that appear while recording are only a live
preview: when the take ends, before it is saved, they are replaced by one keyframe per frame
filtered from every sample within half a frame of it. With three samples or more, each bone keeps
the rotation closest to all the others, so a misread pose is dropped outright instead of landing
on the timeline; with only two they are averaged, and a single sample is kept as it is.

Two settings in **Camera Pose**, both on by default, then clean the take up the way the
timeline's Filter and Halve buttons would, over the take's own keyframes only. **Smooth
Recording** runs Filter six times (`RECORDING_SMOOTHING_PASSES`), pulling each keyframe toward the
frames either side of it. **Thin Out Recording** then runs Halve twice (`RECORDING_HALVING_PASSES`),
so the take keeps one keyframe in four, first and last always included, and interpolates the rest.
Smoothing goes first so thinning never keeps a misread frame. The counts were measured on a
recording of the Running preset: six smoothing passes cost nothing, two halvings stay within about a
degree of the full take, and every further halving loses the stride quickly.

![The Rig Animator after recording an uploaded video: Camera Pose shows Video Slowdown Ratio at 10 with Smooth Recording and Thin Out Recording both checked, and the timeline below carries one keyframe every four frames from 0 to 120](/img/animation/rig-recording-cleanup.webp)

![The canvas buttons mid-recording: the record toggle has turned into a solid red square, between the camera and Camera Preview buttons](/img/animation/rig-record-motion.webp)

Recording and the rig timeline's own **Play/Pause** both drive the current frame, so starting
either one stops the other first rather than letting them fight over it. For the same reason a
live frame is not applied while the timeline plays: the clip poses the rig every tick, and a
camera frame landing in between yanked it back to the live pose for a frame, which read as the
model twitching. While recording, the
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

**Upload Photo/Video**, the upload icon in the panel's action row, reads a pose from an uploaded
file instead of the live feed, useful for
posing from a reference photo, testing against a known performance, or when there is no
working camera. A photo runs the same Pose Landmarker in its image mode and feeds the result
through the exact same mapping, applying it once as soon as a person is found. A video instead
plays through once, slowed down by **Video Slowdown Ratio**, ten times by default, and runs the exact same
live VIDEO-mode detection loop the
camera feed uses (`useVideoLandmarkDetection`, shared between them), so it drives the rig
continuously the same way a webcam does. Playing it never records anything by itself: **Play
Video** / **Pause Video**, a play icon that joins the action row once a video is loaded, plays and
pauses the clip on its own, without starting a take or moving the timeline, so the mapping can be
watched first, and it stays on the action row even while the preview is hidden. While the clip
plays, the preview leaves out the detected skeleton so the video itself can be watched; paused, it
draws what detection read for the frame on screen. Record Motion
then works against it exactly as it does against the camera: clicking it on a paused video plays
the video too, and the take ends on its own once the video reaches its natural end, the same as a
manual **Stop Recording** click would. It plays once rather than looping specifically so that end
has something to trigger on. Detection only runs while the video actually plays:
pausing it stops posing the model and stops a take sampling the same frozen frame, and the
status line says detection is paused until playback resumes. The camera runs from the moment it
is started until it is stopped, and a photo is read once. Either kind stays available once
something is already loaded, so picking a different file never needs switching back to the
camera first, and the camera icon in the action row switches back from either. A photo or video is shown as it is, not mirrored, since
neither is a self-view the way a live webcam feed is, and the detected pose maps onto the rig
unmirrored too, matching what the upload actually shows. Uploading either always turns **Show
Camera Preview** on too, regardless of whatever it was last left at: the whole point of picking
one is to look at it and its detected pose together, and running detection against an upload
with the preview still hidden would show nothing for it.

An uploaded video also gets its own native controls (play, pause, seeking and playback speed, all clickable through the skeleton overlay drawn on top of them), and a **Sync Timeline to Video** link icon
toggle next to Record Motion, on by default; it shows a broken link while off. With sync on, dragging the rig timeline's own playhead
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
where MediaPipe's landmarks are first read, before any of the mapping below ever sees them.
`mirrorCameraPoseFrame` mirrors the hands and the head's rotation in the same step, so all three
agree on which side is which. Everything downstream, the retargeting and the
camera-angle-matching yaw estimate alike, simply reads whichever frame it is handed, and a
pre-mirrored one comes out correctly mirrored on its own. A photo or an uploaded video is not
mirrored, since its own preview is not mirrored either.

### How a detected pose drives the rig

The rig never has a joint placed at a detected position. Every bone is turned instead, by how far
the matching part of the performer has turned from the rig's own rest pose, measured once when
the rig is loaded. That is what lets any rig copy a performer whatever its proportions: a T-pose
stretches fully straight and a reach overhead points straight up, where scaling a wrist position
to the rig's shoulder width used to leave a longer-armed character's elbows bent. The reasoning,
the libraries and papers it draws on, and what the attached dance clip showed are in
[Copying a Performer onto a Rig](/docs/journey/camera-motion-retargeting).

![Nine moments of a dance clip beside the default character posed from it: walking, an arm raised overhead, a turn, arms stretched out, a high kick and a profile](/img/animation/rig-camera-dance-retarget.webp)

- **Torso.** The hips turn to face square to the detected hip line and the chest to the shoulder
  line, so turning around turns the whole rig. A lean is shared out: the pelvis takes part of it
  and the spine bones split the rest evenly, so a back bends rather than hinging at the hips.
  With the hips out of frame, a webcam framed on the upper body, the pelvis stays put and the
  chest turns about the vertical alone.
- **Head.** When the Face Landmarker finds the face, its reading turns the head directly and the
  neck takes half the turn. Otherwise the ears and nose do, tipped back up by the 19° a level
  gaze reads downward from them. The face is looked for on the whole frame first, which is all a
  webcam close-up needs; when that misses and a body is in view, it is looked for again in a crop
  around the nose, since on a full-body clip it was never found in the whole frame and was found
  in most frames of the crop. A face reading turned further from the chest than a neck can turn
  is a misdetection and the ears stand in for that frame. A face filmed on its own, with no body,
  turns only the neck and head.
- **Arms and legs.** Each upper arm points at the elbow, forearm at the wrist, thigh at the knee,
  shin at the ankle and foot at the toes. How each one is rolled about its own length comes from
  what shows it: which way the forearm swings off the upper arm, which way the kneecap and foot
  point, and the palm for the forearm and hand. A segment whose landmarks drop out of view is
  skipped on its own, so a wrist behind the body still leaves the upper arm following. A
  landmark the pose detector places outside the image counts as out of view however confident
  it claims to be: it is a guess, so legs below a webcam framed on the upper body keep their rest
  pose instead of following it.
- **Hands.** See **Fingers from the camera** above.

Applying a captured pose resets to rest, and then drives, only whichever body-part groups the
Merge Target diagram currently has active; see **Merging sources by body part** below. With
every region active, the default, that is the whole rig: a bone the mapping does not drive this
frame never keeps a stale pose left over from an earlier manual edit or a previous capture.

A model with more than one skinned mesh, such as Mixamo's Y Bot, loads with one mesh's skeleton
hung at zero offset beneath the other's bones of the same name. The tool adopts the topmost bone
of each such pair, the one carrying the real hierarchy: posing a lower copy turned only the
vertices bound to it, and the model came apart at every joint.

![Mixamo's Y Bot posed from the same clip, an arm raised overhead and a high kick, every limb attached](/img/animation/rig-camera-ybot-retarget.webp)

### Switching each rule on and off

Every rule the capture follows has its own checkbox in the rig panel, all on by default, so a
pose that reads wrong can be taken apart one rule at a time. **Camera Detect** rules decide what
MediaPipe reads from each frame; **Camera Bones** rules decide which bones that reading turns.

![The rig panel with its Camera Pose, Camera Detect and Camera Bones sections expanded, every rule on except the opt in ones](/img/animation/rig-camera-rule-toggles.webp)

- **Face Tracker for Head** runs the Face Landmarker; off, the head is read from the ears and
  nose. **Face Search Around Nose** looks again in a crop around the body's nose when the whole
  frame shows no face, the case of a face small in a wide shot.
- **Hand Tracker for Fingers** runs the Hand Landmarker. **Hand Search Around Wrists** looks
  again in a crop around a wrist the whole frame found no hand at. **Hand Side by Nearest Wrist**
  sides a hand by the body's wrist instead of the detector's own label.
- **Ignore Body Outside Image** treats a body landmark placed outside the picture as not
  detected. **Fit Body to Image** pulls each body landmark from the pose detector's 3D reading
  onto the line from the camera through where the detector saw it in the picture: 1, the default,
  pulls it all the way and 0 uses the 3D reading alone. **Mirror Live Camera** reflects the webcam's body, hands and head to match its
  mirrored preview. **Only While Video Plays** stops reading a paused video.
- **Turn Hips**, **Bend Spine**, **Turn Neck and Head**, **Aim Arms**, **Aim Legs** and **Aim
  Feet** each leave their bones at rest when off.
- **Correct Ear and Nose Head Pitch** tips a head read from the ears back up by the 19° a level
  gaze reads downward. **Ignore Impossible Head Turns** drops a face reading turned further from
  the chest than a neck can turn, which a face half hidden behind an arm produced, and uses the
  ears for that frame instead.
- **Roll Upper Arms from Elbows**, **Roll Forearms and Hands to Palms** and **Roll Thighs from
  Knees and Feet** each keep the limb pointing the same way when off, and only drop how it is
  rolled about its own length.
- **Palms from Body When No Hand Found**, off by default, reads the palm from BlazePose's own
  wrist, pinky and index whenever the Hand Landmarker found no hand, as the capture used to. See
  **Fingers from the camera** for why it is off.
- **Ignore Turns That Flip the Body**, on by default, holds the body to turning no faster than a
  body can. Facing the camera and facing away project the same width, and the depth that separates
  them is read across a torso barely wider than the error in it, so the detector lands on either
  from one frame to the next and the whole rig spins round and back. Each frame may turn the body
  only as far as that frame's own evidence of turning allows, which is how much of the hip line
  lies along depth: none at all when square to the camera, all of it when side-on. Switch it off
  to see a take exactly as the detector read it. Why it happens, and why the three obvious fixes
  made it worse, is in [The Body That Turns Round and Back](../journey/bone-roll-flips.md).
- **Keep Joints in Human Range**, on by default, keeps every joint the capture turns inside the
  range a body can reach, measured from the rig's own rest pose: how far each one may swing off
  its rest direction and how far it may roll about its own length, from a few degrees for a
  finger's roll to a full turn for a shoulder's swing. A finger's middle and last joints only
  curl. The values are `CAMERA_JOINT_LIMITS_DEGREES` in `config.ts`. Without it the detector's
  misreadings go straight through: on the attached dance clip a thigh rolled 149°, a forearm
  173° and a finger joint bent 126° sideways, which tore the skin at the hip and wrung the
  forearm flat. Off, every segment points exactly where the landmarks say, however far past a
  joint that is. Each joint is limited on top of its already limited parent, so the bone below
  still reaches the detected direction whenever a human joint could. With the hips out of frame
  the spine's own roll limit also caps how far the chest turns, about 60°.

The remaining options tune the result:

- **Keep Feet on Ground**, on by default, raises or lowers the whole rig so its lowest foot stays
  where it stands at rest. World landmarks are centred on the hips, so nothing in them says how
  high the body is: without this a crouch folds the legs up off the floor instead of bringing the
  hips down. Recorded keyframes store rotations only, so a recorded take plays the crouch back
  without the lowered hips.
- **Use Depth (Z Axis)**, on by default, reads every direction in three dimensions. A single photo
  gives MediaPipe far less to judge depth from than a video's own motion does, making z the least
  reliable of the three axes it reports; turning this off reads every body direction flattened
  onto the image plane instead.
- **Match Camera Angle to Photo**, off by default, turns the 3D view's own camera to roughly the
  angle the photo shows the subject from, so a turned pose reads as turned in the viewport too
  instead of always being viewed square-on. This is the one camera-relative detail a single
  photo's body landmarks can actually support: MediaPipe's world landmarks are already
  normalized to a real-world body scale, so unlike the subject's facing direction, nothing in
  them hints at how close or how zoomed in the original camera was. The angle comes from the
  shoulder line's own tilt in the horizontal plane: facing the camera straight on, both
  shoulders sit at the same depth, and turning moves one shoulder closer to the camera than the
  other by exactly the angle turned. Off by default since it moves the view every applied frame,
  which fights any manual orbiting done in between.
- **Video Slowdown Ratio**, 10 by default, from 1 to 16, sets two things at once for an uploaded
  video: how many times slower it plays, and how many poses Record Motion samples per frame of it
  before filtering them down to one keyframe. The two go together because a video slowed N times
  gives detection about N readings of each of its frames. Record Motion times a video take by the
  video's own position rather than the clock on the wall, so the recorded clip keeps the video's
  real timing at any ratio. 1 plays at normal speed with one sample a frame and nothing to filter.
  16 is the ceiling because browsers will not play a video slower than a sixteenth of its speed.
  The smoothing times above still run on the wall clock, so at a ratio of 10 they act on a tenth as
  much of the video.
- **Show Camera Preview**, off by default, shows the mirrored video/photo preview when turned
  on, as does the docked Camera Preview button beside the camera one while capture is open; hidden, the docked panel shrinks down to just its action buttons and the model gets the
  full canvas to sit in, while the feed keeps being read and applied to the rig exactly the
  same either way. Uploading a photo or video turns it on automatically even if it was off, see
  **Upload Photo/Video** above.

### Smoothing the live feed

A live camera detection runs roughly every frame, and MediaPipe's own per-frame landmark noise,
most visible on depth, reads as jiggle if applied to the rig straight. Every landmark, body and
hands alike, and the head's rotation pass through a One Euro filter before they drive anything:
a smoothing whose strength follows how fast each landmark moves. Held still, where jiggle shows
most, a landmark is smoothed over the full time set in the rig panel; moving fast, where lag
shows most, it is let through close to as detected. A fixed blend per frame could only trade one
for the other. The filter also works from the time between readings rather than per frame, so
the same setting feels the same whether detection manages fifteen readings a second or sixty. A
photo is a single detection with nothing to smooth against, so this only affects the camera and
an uploaded video.

Every knob behind that trade sits under **Camera Smoothing** in the rig panel, to tune jerky
movement by eye:

![The rig panel's Camera Smoothing section expanded, its sliders at their defaults](/img/animation/rig-camera-smoothing-sliders.webp)

| Slider                     | Default | Raise it when                                                              |
| -------------------------- | ------- | -------------------------------------------------------------------------- |
| Landmarks Held Still (ms)  | 150     | a pose held still still jiggles; 0 turns landmark smoothing off            |
| Let Go on Fast Moves       | 12      | fast moves trail behind; lower it when fast moves look shaky               |
| Speed Sensitivity (Hz)     | 1       | the start of a fast move lags; lower it when noise reads as sudden motion  |
| Let Go on Fast Head Turns  | 2       | head turns trail behind; lower it when the head shakes                     |
| Max Jump per Frame (m)     | 0.15    | real fast moves get held back; lower it when single frames snap            |
| Bones Settle (ms)          | 0       | limbs snap between poses, dropping out to rest or flipping their roll      |
| Max Joint Speed (°/s)      | 720     | real fast moves lag; lower it when a limb still flips for a frame          |
| Hold a Lost Hand (ms)      | 330     | a hand drops out and back; lower it when a hand lingers after leaving      |
| Palm Turn to Confirm (°)   | 45      | a real quick wrist turn lags; lower it when a palm still flips; 180 is off |
| Landmark Confidence Needed | 0.5     | limbs follow guesses; lower it when a limb stays frozen too long           |
| Roll Starts at Bend (°)    | 10      | a nearly straight arm or leg rolls back and forth                          |
| Roll Full at Bend (°)      | 30      | the roll changes too abruptly as a limb bends                              |

**Bones Settle** works on the result rather than the landmarks: each bone eases from where the
last frame left it toward its new rotation, which smooths snaps landmark smoothing cannot see,
such as a limb picked up again after being held. A pose applied after more than half
a second lands whole, so a new photo or a resumed video is not blended from a stale pose. **Max
Joint Speed** caps how fast any bone may turn between two readings. A misread frame flipping a
forearm's roll half a turn asks for thousands of degrees a second, far past any dancer, so it is
spread over several readings instead and mostly undone by the next good reading before it shows;
0 turns the cap off. Max Jump
clamps how far a landmark may move in a single reading, so a genuine fast movement still gets
there, just over a couple of extra readings instead of one.

### Frame shortcuts

**Space** (keyboard) or the gamepad's left face button adds a keyframe at the current frame, the
same as the timeline's own **Add Keyframe** button. **Left Arrow** or the gamepad's D-pad left
steps to the next frame; **Right Arrow** or D-pad right steps to the previous one. **Shift+Left
Arrow** and **Shift+Right Arrow** extend the frame selection by one frame in that same direction
instead of stepping the playhead — see **Selecting a range of frames** above. These are
suppressed while a text or number field elsewhere in the panel has focus, so typing a bone
rotation or a Config value never gets hijacked by the arrow keys moving the cursor within it.

### Scoring a capture against a recording

A recording of the rig playing a preset is a test case with a known answer. The script
`scripts/extract-video-landmarks.mjs` runs MediaPipe's pose and face detectors over every frame of
a video in headless Chromium and writes the readings as a fixture:

```sh
node scripts/extract-video-landmarks.mjs recording.mp4 src/views/Tools/RigAnimator/fixtures/runningClipFrames.json
```

`clipReproduction.test.ts` replays that fixture through the same steps a live capture takes, with
the Config panel's defaults, and scores the rig against the preset it recorded using the measures
in `poseSimilarity.ts`. What the scores mean, and what the first recording showed, is in
[Copying a Performer onto a Rig](../journey/camera-motion-retargeting.md#scoring-a-capture-against-a-recording-of-the-rig-itself).

To see the scores, render them. The test writes both rigs' poses when given a path, and a second
script plays them on the default character beside the recording, with each frame's limb angle
error:

```sh
CLIP_COMPARISON_OUTPUT=comparison.json pnpm vitest run src/views/Tools/RigAnimator/clipReproduction.test.ts
node scripts/render-clip-comparison.mjs recording.mp4 comparison.json comparison.mp4
```

## Merging sources by body part

Every source that can drive the rig — a camera or photo capture, a bundled preset, a
Record Motion take — is scoped by the **Merge Target** diagram, a small stick figure with five
clickable regions, Left Arm, Right Arm, Left Leg, Right Leg and Spine / Head (the torso, neck
and head, plus the root bone), all active by default. It only shows up while the rig panel
is open, docked on the canvas next to it, since that is the one place scoping a source
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

**Physics**, docked on the canvas with the other buttons, turns the
posed rig into something other objects can hit. It is a way to see a pose as a physical shape
rather than a silhouette: a cupped hand catches marbles, a flat one does not, and playing the
timeline back sweeps them around as the limbs move through them. It mirrors the rig panel's
own **Simulate** checkbox under Physics, the same toggle either way.

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
