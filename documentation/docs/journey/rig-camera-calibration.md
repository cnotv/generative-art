---
sidebar_position: 127
---

# Rig Animator: what camera calibration can and cannot fix

Three constraints found while building calibration for the Rig Animator's camera capture,
each invisible until this feature specifically needed the data MediaPipe does not provide.

## World landmarks carry no room position

MediaPipe's Pose Landmarker reports two coordinate spaces per frame: normalized image-space
landmarks (0 to 1 across the frame, the same space the skeleton overlay draws in) and
"world" landmarks, scaled to real-world metres and used for every bone mapping in this tool.
World landmarks are not room-position tracking, though the name invites that reading. They
are normalized to the detected person's own body, centered near the hip, the same way a
local coordinate frame is centered on an object rather than the world it sits in. A person
who steps a metre to the left produces the same world landmarks as one standing still; only
the normalized image landmarks shift.

This means "how far has the whole body moved" cannot be answered from the data this tool
already reads for everything else. Calibration's whole-body-position axis reads the raw
image-space landmarks instead, converts the on-screen drift into world units using the same
per-frame shoulder-width scale the rest of the mapping already computes, and accepts that a
step toward or away from the camera reads as no movement at all: the conversion scale itself
depends on the very depth axis that would need to change to detect it. Solving that properly
would need a second signal depth can actually be read from (stereo, a depth sensor, or a
second calibration pass dedicated to it), not a fix available inside the existing single-frame
pipeline.

## A feature that measured nothing since it shipped

`cameraUseHips` ("Move Hips to Photo") maps the detected hip midpoint onto the rig's root
bone. Reading the mapping code, the target position is anchored to the rig's own hip center
and offset by the landmark's distance from its own reference center. For every other mapped
bone (a wrist, an ankle), that reference center is the shoulder or hip midpoint, a different
point from the one being mapped, so the offset is real. For the hip mapping specifically, the
landmark being mapped and its own reference center are the same point: the hip midpoint,
compared against itself, always computes to zero. The formula was live and running every frame
this checkbox was on; it just always resolved to "no offset from rest," indistinguishable at a
glance from the root bone simply not being driven yet.

This survived because the toggle defaults off, and turning it on produces a rig that holds its
rest position quietly rather than one that visibly breaks. Nothing about reading the code flags
it: the formula is the same shape as every other mapped bone, just fed a reference center that
happens to coincide with its own target. Calibration's whole-body-position offset now drives
the same hip bone through a separate path with a real reference point (the calibrated origin,
not the landmark itself), independent of this checkbox; the checkbox's own mapping is
unchanged; a fix to make `cameraUseHips` compute a real offset on its own would need a
different, dedicated reference point the same way.

## A sign that can only be confirmed live

Wrist rotation is read as the angle between two hand landmarks in the camera's own screen
plane. Whether turning a hand clockwise in front of the camera should turn the mapped bone
clockwise or counterclockwise on screen depends on which way the rig faces its own viewing
camera relative to which way the subject faces their webcam, the same class of question this
tool's hand-side resolution and body mirroring already got wrong once each, on paper, before a
real camera session showed the opposite. Every one of those was fixed only by clicking the
actual result on a live feed and reading which way it actually turned, not by re-deriving the
convention from documentation.

No physical camera was available while building this, so the wrist-rotation delta ships with
its sign unconfirmed, flagged in the code as a single axis constant, with the expectation that
whoever first tests it live flips one sign if the hand turns the wrong way rather than
re-deriving the whole mapping. The lesson carried forward from the earlier two fixes is which
one line to change, not that the reasoning can be trusted without the check.
