---
sidebar_position: 99
---

# Scenery primitives do not share a unit

Why a forest built from the toolkit's own primitives came out with giant canopies and
vanishing leaves, and the two mental models that fix both.

## A ball's size is a radius; everything else is an extent

The cube and cylinder builders read their size as the full measurement across the shape:
a trunk declared at half a unit is half a unit wide. The ball builder hands its size
straight to the sphere underneath, where the same field is a radius: a canopy declared
at three units is six across. Nothing in the call site distinguishes the two, so a row
of trees laid out with one sizing habit grows lollipops twice the intended crown.

The correction is to size canopies in radii and everything else in extents, and to distrust
any mixed primitive layout until each shape has been checked against a known reference —
a trunk of declared width next to a canopy of declared size — rather than against the
numbers alone.

## An instanced scatter is culled by the seed it was grown from

An instanced mesh computes its bounds from its base geometry: one leaf at the origin.
The renderer then culls thousands of scattered instances against that single small box,
so the whole litter layer disappears the moment the origin plane leaves the frame — even
though most leaves are still in full view. The fix is to opt the scatter out of frustum
culling entirely, since no single box can honestly bound it.

![Forest road view](/img/forest-road/view.webp)
