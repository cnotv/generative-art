---
sidebar_position: 120
---

# Why short views show a white strip

A view whose content is shorter than the window paints the theme background down to where
its content ends, and plain white below that. It looks like the view failed to stretch, so
the instinct is to give the view a height. That treats the symptom.

## The mechanism

The page background is not drawn by `body`. It is drawn by the **canvas**, the surface
behind the whole document, which is larger than any element and cannot itself be styled.
CSS fills that canvas by borrowing a background from the document, following a specific
order of preference:

| Situation                            | What paints the canvas  |
| ------------------------------------ | ----------------------- |
| `html` has a background              | that background         |
| `html` is transparent, `body` is not | `body`'s, propagated up |
| both transparent                     | the browser's default   |

The second row is the one people rely on without knowing it: setting a background on `body`
normally covers the entire viewport, however short the content, because the value is lifted
off `body` and used for the canvas. Crucially, an element whose background has been
propagated is then painted as though it were transparent — the value is moved, not copied.

That lifting only happens when `html` has nothing of its own. Give `html` a background and
it wins, `body`'s stays on `body`, and `body` is only as tall as its content. Everything
below the content shows the `html` colour.

## Why it looked like a layout bug

The theme sets its colours on `body`, so light mode looks correct and dark mode appears to
work down to the fold. Only the region past the content reveals that two different surfaces
are being painted. Because the visible boundary sits exactly where the view's content ends,
the evidence points at the view rather than at the document.

The tell is that the strip is the _same_ colour in both themes while the area above it
changes. A view that simply failed to stretch would leave a gap in the theme's own
background colour, not a fixed one.

## The lasting form of the fix

Making one view fill the viewport hides the strip for that view and leaves every other short
view exposed. The durable fix is for `html` to carry no background of its own, or the same
themed value as `body`, so propagation works as the rest of the CSS assumes.

This repo currently sets an opaque background on `:root` in `src/style.css` — a leftover
from the project scaffold, sitting beside other scaffold defaults. It is still there, so
short views still need their own minimum height until it is removed.
