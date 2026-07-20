---
sidebar_position: 9
---

# Drawing SVG Glyphs for Track Pieces

Every piece in the marble editor's palette shows a small schematic glyph so
players recognize a piece by shape instead of reading its label. This guide
explains how those glyphs are authored and how to add one for a new piece.

> **Source files**: `src/views/Games/MarbleEditor/editor/PiecePreviewIcon.vue`
> (glyph paths and rendering), `src/views/Games/MarbleEditor/editor/EditorPalette.vue`
> (where the tiles consume the icon). Update this guide when either changes.

## The canvas and stroke contract

Every glyph is a single `<path>` inside a `24 x 24` viewBox with a shared
stroke setup, so all pieces read as one hand-drawn family:

- `fill="none"`, `stroke="currentColor"` — the glyph inherits the LobbyUI text
  color, including hover/focus gold, with no per-glyph colors.
- `stroke-width="2"` with `stroke-linecap="round"` and
  `stroke-linejoin="round"` — matches the rounded playful lettering.
- One `d` string per piece. Use multiple subpaths (`M … M …`) inside that one
  string rather than multiple `<path>` elements.

Keep roughly 3–4 units of empty margin inside the viewBox; the tile button
provides the border and spacing.

## Drawing conventions

Glyphs are top-down schematics of the lane, not perspective drawings. The
track flows bottom-to-top (entry at the bottom edge, exit toward the top or a
side), mirroring how a piece extends away from the previous one in the editor.

| Piece family   | Convention                                                               |
| -------------- | ------------------------------------------------------------------------ |
| Straights      | A single vertical stroke; length encodes short vs long                   |
| Curves         | Vertical entry, then a quadratic turn (`Q`) exiting left or right        |
| Banked curves  | The curve stroke doubled with a second offset arc                        |
| Ramps          | A diagonal stroke with an arrowhead showing up or down                   |
| Special pieces | Their silhouette: funnel V with a spout, loop circle, chevrons for boost |

## Small-path techniques

- **Arrowheads**: end the diagonal, then add two short relative subpaths from
  the tip — `m0 0 h-4.5 m4.5 0 v4.5` draws both barbs without lifting into a
  second path element.
- **Dots** (e.g. the bumper field): a zero-length stroke like `M10 8 h0.01`
  renders as a dot because of the round line cap.
- **Gaps**: leave literal space between subpaths — the gap-jump glyph is two
  lane strokes with a launch tick and nothing in between.
- **Arcs**: quarter turns are a single `Q` (control point at the corner);
  full circles use the `A` arc command twice or a `A … 1 1` sweep.

## Adding a glyph for a new piece

1. Add the piece type's entry to `PIECE_GLYPH_PATHS` in
   `PiecePreviewIcon.vue`. The record is keyed by `TrackPieceType`, so the
   compiler fails until every piece has a glyph — a new piece cannot ship
   without one.
2. Draft the path mentally on graph paper coordinates (or any SVG scratch
   tool) inside `24 x 24`, entry at the bottom.
3. Check it in the running editor: the palette renders every glyph at once,
   and hovering the tile previews the real piece next to it — the glyph
   should feel like a caricature of that preview.

No registration is needed anywhere else: the palette iterates the piece
catalog and renders `PiecePreviewIcon` for each type automatically.
