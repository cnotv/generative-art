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

This repo set an opaque white background on `:root` in `src/style.css`, a leftover from the
project scaffold. It now takes the same themed value as `body`, and a short view no longer
needs a minimum height of its own to hide the strip.

![A short view in dark mode with a white band filling the viewport below where its content ends](/img/background-propagation/short-view-strip-before.webp)

_Before: the same content, the same theme, and a white canvas showing below it._

![The same short view in dark mode, the theme background continuing to the bottom of the viewport](/img/background-propagation/short-view-strip-after.webp)

_After: `html` carries the themed value, so the canvas it paints matches the page._

## The other scaffold default on the same block

The `:root` rule that held the stray background held a stray text colour beside it, and that
one was doing more damage. The scaffold ships a near-white colour intended for a dark page,
directly above a white background. Anything that did not set a colour of its own therefore
inherited white text on a white surface.

It stayed hidden because almost nothing inherits. Well-built components set their own colour
from the theme tokens, so the broken default only surfaced where a component had forgotten
to, and it never surfaced in dark mode, where near-white happens to be correct. Across every
route only ten text nodes were inheriting at all, and three of them were the format buttons
of a converter tool, sitting invisible on a white panel.

![A format selector showing one dark selected button and three apparently empty white buttons](/img/background-propagation/inherited-colour-before.webp)

_Before: three of these buttons have labels. They are white text on a white panel._

![The same format selector with all four labels legible: WebP, JPEG, AVIF and PNG](/img/background-propagation/inherited-colour-after.webp)

_After: the inherited default follows the theme, and the labels appear._

The lesson generalises past this one line: a default inherited by the whole document must be
defined in the same terms as the surface behind it. A fixed colour paired with a themed
background is a bug waiting for the first component that forgets to override it.

## Text over a canvas is not covered by either

Fixing the inherited colour uncovered a second class of element. A heads-up display floating
over a 3D canvas has no themed surface behind it at all: the browser cannot tell what colour
the scene is painting under the text, and the theme has no opinion either.

Such an overlay had been relying on the scaffold's white default and would have flipped to
dark text over a dark scene. It cannot inherit and it cannot use the theme's foreground
token, because both describe the document rather than the render. It has to carry its own
fixed colour and an outline strong enough to survive whatever the scene puts behind it,
which is what `--color-canvas-overlay-foreground` and `--shadow-text-canvas-overlay` are
for. An automated contrast sweep cannot catch this class either: walking up the DOM for a
painted background finds the page, not the canvas, so these have to be looked at.
