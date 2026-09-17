---
sidebar_position: 24
---

# Reproportioning a model

The Model Editor at `/tools/ModelEditor` loads a rigged model and gives every humanoid body
part two sliders: **Length**, which stretches the part along its own bone, and **Size**, which
thickens it across that bone. Ten regions are offered, from the head down to the feet, and
**Reset Proportions** puts the figure back to the proportions it was authored in.

The default model loads on arrival; the upload button at the top left of the canvas takes an
`.fbx`, `.glb` or `.gltf` of your own.

![The editor at rest: the default character stands in a T-pose with every Length and Size slider at one](/img/model-editor/rest-proportions.webp)

![The same character with a larger head, longer and thicker upper arms, longer thighs and wider shins, each slider reading the value that produced it](/img/model-editor/edited-proportions.webp)

## Source files

- `src/views/Tools/ModelEditor/ModelEditor.vue`: the view (scene setup, model upload, the
  config panel schema built from whatever the loaded rig turned out to have)
- `src/views/Tools/ModelEditor/bodyParts.ts` (+ `.test.ts`): measuring the rig at load and
  applying the per-region proportions to its bones
- `src/views/Tools/ModelEditor/config.ts`: the scene config, the slider range and the table of
  regions

Loading a model file and resolving the bones that actually carry the hierarchy are reused from
the Rig Animator's own `rigModel.ts`, as is `frameCameraOnModel`.

## Why a region is a bone and a tip, not just a bone

A bone's scale is applied in the bone's own local space, which means length and size are not
two separate quantities at all: they are the same scale on different axes. The axis a limb runs
along is its length, the two across it are its thickness.

Which axis that is has to be measured, not assumed, and the measurement comes from where the
next bone down sits. That next bone is named in the table rather than taken as "the first
child", because several of these bones start more than one chain: a hand starts five fingers,
and the top of the spine starts the neck and both shoulders. Only one of those directions is
the one the region's own length runs along.

The hips are deliberately not a region. They are the root every other region hangs off, so
scaling them resizes the whole figure rather than a part of it, which is what the model's own
scale is for.

## Why an edit stops at the bone it was made on

Scale carries down a bone chain, so a thicker upper arm would arrive as a thicker forearm and a
swollen hand unless something stopped it. Each bone therefore takes its own region's scale
divided by whatever its parent already applies, which leaves the effect on exactly the bone it
was asked for.

The limb still grows longer all the same. A child bone's offset from its parent sits in the
parent's own scaled space, and that offset is what a segment's length is: stretching the parent
along its length axis carries every bone below it further out without stretching any of them.

A rig named by some other convention matches no region and gets no sliders at all, rather than
a panel full of controls that move nothing.
