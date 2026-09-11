---
sidebar_position: 127
---

# Rig Animator: calibrating the camera with a held T-pose

Why the Rig Animator's camera calibration measures two held T-poses, and how each measurement
turns a flat webcam feed into rotation, sideways movement and distance for the rig's root.

## World landmarks carry no room position

MediaPipe's Pose Landmarker reports two coordinate spaces per frame: normalized image landmarks
(0 to 1 across the frame, the space the skeleton overlay draws in) and "world" landmarks, scaled
to metres and used for every bone mapping in this tool. The name invites reading world landmarks
as room tracking, and they are not: they are normalized to the detected person's own body,
centered near the hip. A person who steps a metre to the left produces the same world landmarks
as one standing still; only the image landmarks shift.

Everything about where the body is, rather than how it is posed, therefore has to come from the
image landmarks, and an image landmark on its own is ambiguous: a body that looks smaller might be
further away or just a smaller person. The front T-pose resolves that. It records how large this
particular person appears at a known moment, so every later frame is read against their own
reference size rather than an assumed average body.

## Distance from apparent size

Under a pinhole camera, apparent size is inversely proportional to distance. Comparing the
calibrated apparent size with the current one gives the ratio of distances directly, without
knowing either distance. Turning that ratio into metres needs one absolute distance, and the
calibration derives it from the real shoulder width MediaPipe reports alongside the shoulders'
apparent span.

That derivation needs the camera's focal length, which a browser cannot read: a media stream
reports its resolution, never its lens. The tool assumes a 60° horizontal field of view, typical
of a laptop webcam, and exposes it as a setting. A wrong value does not break the motion; it
scales every distance and every sideways step by the same proportion, so movement still reads in
the right direction and in the right relative amounts.

The size measured is the vertical span from the shoulders to the hips, not the shoulder width:
turning in place narrows the shoulders but leaves that height unchanged, so distance and rotation
never contaminate each other. With the hips out of frame, the usual framing for a webcam, the span
from the nose to the shoulders stands in, noisier but still unaffected by a turn.

| Measured at calibration      | Read live against it                                       |
| ---------------------------- | ---------------------------------------------------------- |
| Torso height, or head height | distance ratio, then metres from the assumed field of view |
| Shoulder span, square-on     | rotation magnitude, once distance is corrected for         |
| Shoulder direction           | which way the rotation turns                               |
| Body center                  | sideways movement, converted at the current distance       |
| Arm span in metres           | the reach multiplier, against the rig's own arm span       |
| Side-on arm span along depth | the scale MediaPipe's depth axis is missing                |

## Rotation: magnitude from projection, direction from the mapping itself

Turning away from the camera shortens the shoulders' apparent span by the cosine of the turn.
Once the distance ratio has removed the part of that shrinkage caused by stepping back, the
inverse cosine gives how far the body has turned. The cosine is flat near square-on, so small
turns under-read, and steep near side-on, so large turns read well; a turn past a quarter turn,
with the back to the camera, shows the same span as the mirror turn in front and is not
distinguished.

The magnitude says nothing about direction, and direction is exactly the question this tool has
answered wrong on paper before: hand sides and body mirroring were both reasoned out from
MediaPipe's documented conventions, and both turned out backwards on a live camera. The rotation
direction avoids that trap by construction. It is read from the shoulder line after the same axis
flips the limb mapping applies to every landmark, compared against the shoulder line recorded
square-on. Whatever convention the camera, the mirroring or the rig happens to use, the root turns
the same way the mapped hands already land, because both come out of one transform. Hand rotation
uses the same idea: the wrist-to-knuckle angle is read on the scene's viewing plane through the
same mirroring as the body, and applied as a turn relative to the T-pose.

## MediaPipe compresses depth

World landmark depth is estimated from a single view and consistently comes out shallower than
the matching horizontal extent. Square-on, the arms of a T-pose span the horizontal axis, which
MediaPipe measures well; turned side-on, the same arms span the depth axis. The side T-pose reads
that depth extent, and since the front pose already recorded the true arm span, their ratio is the
factor depth is missing. It rescales depth for the limb mapping, so a hand reaching toward the
camera reaches as far on the rig, and for the rotation direction, which reads depth directly.

## The root had nowhere to record its position

Keyframes held bone rotations only, a sensible choice when every edit rotated a joint and bone
positions described the rig's proportions. Root motion broke that assumption: a take that walks
toward the camera recorded a rig walking in place, since the movement lived only in the root's
position. Keyframes now carry positions as well, restricted to the skeleton root, found by
structure rather than by name. Every other bone still records rotation only, so editing a limb's
position in the panel keeps adjusting the rig rather than animating it.

## A hip mapping that moved nothing on real rigs

Before calibration, "Move Hips to Photo" mapped the detected hip midpoint onto the root. The limb
mapping places each target relative to a reference center, and on any rig with upper-leg bones
that center for the legs is the detected hip midpoint itself, so the hip target was always the
hips measured against themselves: zero offset, every frame. Its unit test passed because the test
rig had no upper-leg bones, which sends the leg mapping down its shoulder-anchored fallback, where
the offset is real. Nothing about the formula looked wrong, and on a real Mixamo rig the checkbox
simply held the root at rest, indistinguishable from not being driven yet. Calibrated root motion
replaced it rather than repairing it, since a correct hip offset needs exactly the reference size
and distance only a calibration can supply.
