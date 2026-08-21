---
'@webgamekit/controls': minor
---

Measure device tilt from world horizontal instead of from a calibrated pose. A device lying
flat now reads level, so the zero is one the player can find by putting the device down rather
than one that exists only inside the controller.

Breaking: `motion.recalibrate()` is gone from `MotionControls`, along with the neutral pose it
retook and the `screen.orientation` change listener that retook it on a rotation. Readings are
still rotated into the screen's frame as they arrive, so a rotated screen needs no reset.

The trade is posture: a device held up to be read sits past any usable lean limit, so a game
using motion now asks to be played with the device roughly face up.
