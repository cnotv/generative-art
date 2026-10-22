---
sidebar_position: 26
---

# Rebuilding the Skills City

The isometric city under the homepage hero is one model, `public/skills-city.glb`, built by a
headless Blender script. Change the script, rerun it, and the page picks up the new model on
reload: nothing in the page code needs to change unless a new kind of motion is added.

![The skills city as the script's preview render shows it](/img/skills-city/blender-preview.webp)

> **Source files:** `scripts/blender/skills-city.py`, `src/views/Experiments/LandingPage/cityStage.ts`,
> `src/views/Experiments/LandingPage/SkillsCity.vue`, `src/views/Experiments/LandingPage/config.ts`

## Running it

From the repository root, with Blender 5 installed (on macOS the binary is
`/Applications/Blender.app/Contents/MacOS/Blender`):

```sh
blender -b --factory-startup --python scripts/blender/skills-city.py -- public/skills-city.glb /tmp/skills-city.png
```

It writes the model and a preview render, and prints the mesh, triangle and moving part counts.
Then check the budgets with `pnpm check:assets` and look at the homepage.

## How the city is laid out

| Part              | Where it is defined                    | Notes                                                                                                      |
| ----------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| District contents | one `build_<district>` function each   | plain primitives in the shared palette, laid out around the district centre                                |
| Positions         | `SLOTS`                                | in screen space (right, depth), so each district gets its own clear spot on screen                         |
| Districts         | `cell`, `inset`                        | each district takes the part of the city limit nearest its site: a road ring, then a raised tile inside it |
| Land              | `ground-island`, `city_limit`          | one continuous piece around the districts; the filler blocks stand on it without streets of their own      |
| Names             | `GROUND_LABELS`, `district_sign`       | each district's name on a bold signboard at its front edge, where the tile is wide enough for it           |
| Containment       | `keep_inside`                          | shrinks a group until every vertex sits inside its area and behind its name; a warning means it never fit  |
| Filler blocks     | `FILLERS` and `FILLER_OF`              | houses, warehouses and tanks: part of the land, not hoverable                                              |
| Harbour           | the pier and boat block after the loop | on the straight western coast, next to the bay                                                             |

Keep tall districts at the back of the view, and keep tall buildings away from a district's back
edge, where they would hide the sign of the district behind it. Hovering a district on the page
shows its title and description on the LCD display in the corner of the city.

## Names and motion the page relies on

- A district is a node named `district-<key>`, where `<key>` matches a `district` entry in
  `SKILL_AREAS` in `config.ts`. Filler blocks are named `block-<key>` and are ignored by hover.
- A moving part is a node with glTF extras: `anim` (one of `spin`, `swing`, `bob`, `slide`, `puff`,
  `grow`, `pulse`, `stretch`, `arc`), `axis` in three.js terms, `speed`, `amount`, `phase` and, for
  `arc`, `lift`. Set them with the script's `anim()` helper on an empty that parents the moving
  meshes. `cityStage.ts` checks each tag before playing it, and a `puff` part fades out as it rises.
- Still meshes are joined per district to keep draw calls low; moving parts stay separate children
  of their district, so they lift with it on hover.
