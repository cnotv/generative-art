---
paths:
  - 'src/components/**'
  - 'src/views/**'
  - 'src/assets/styles/**'
  - 'packages/threejs/**'
---

# Choosing colours

**Pick pastel.** Every colour chosen for this project — 3D materials, scene backgrounds,
diagrams, new UI surfaces — is a soft, desaturated tone rather than a saturated primary: muted
creams, periwinkles, dusty roses, mints and mauves. A fully saturated red or green looks
arbitrary next to everything else here and reads as placeholder art.

Two things a pastel palette still has to earn:

- **Contrast where it carries meaning.** A pastel ball on a pastel board disappears. Pick the
  light surface first, then push the objects that must be found — the player, the goal — several
  steps darker or warmer than it, and check them against the background rather than in isolation.
- **A ground darker than the surfaces on it**, whenever a hole, gap or cut-out shows what is
  behind. Anything visible through a gap _is_ what that gap looks like, so a light background
  turns every pit into a bright disc.

Light rigs go flatter than the contrasty default: raise ambient and lower the key, or the lit
faces of pastel surfaces blow out to white. Matte finishes suit the palette; a chrome highlight
fights it.

This governs colours you choose. It does not override the established semantic ones — the gold
winner and red danger tokens stay exactly as they are.
