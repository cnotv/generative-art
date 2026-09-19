---
sidebar_position: 24
---

# Reproportioning a model

The Model Editor at `/tools/ModelEditor` reshapes a humanoid model and saves the result. The
Config panel holds two groups:

- **Body**: two sliders per part, from the head down to the feet. **Length** stretches the part
  along its own bone, and **Size** thickens it across that bone.
- **Face**: three sliders per feature (eyes, nose, mouth, jaw, ears, cheeks). **Size** enlarges
  the feature, **Height** moves it up or down, and **Depth** pushes it out of or into the face.

**Reset Proportions** puts both back to how the model was authored, and **Download Model** saves
the reshaped model as a `.glb` named after the file it came from.

The default model loads on arrival; the upload button at the top left of the canvas takes an
`.fbx`, `.glb` or `.gltf` of your own.

![The editor at rest: the default character stands in a T-pose with every Length and Size slider at one](/img/model-editor/rest-proportions.webp)

![The same character with a larger head, longer and thicker upper arms, longer thighs and wider shins, each slider reading the value that produced it](/img/model-editor/edited-proportions.webp)

![A character's head before the face sliders move](/img/model-editor/face-rest.webp)
![The same head with larger eyes, a fuller nose pushed slightly forward, and a wider mouth](/img/model-editor/face-edited.webp)

![The Face group of the Config panel, each feature's Size, Height and Depth reading the values that produced the head above](/img/model-editor/face-panel.webp)

## From the editor to an animation

A copy of the default character with every limb at 75%, length and size together, downloaded and
loaded into the Rig Animator, where the bundled Running preset plays on it. The preset only turns
bones, so the shortened limbs keep their proportions through the whole cycle.

<video controls loop muted playsinline width="720" src="/video/model-editor/shorter-limbs.webm">
  The original character runs in the Rig Animator. In the Model Editor, the length and size of the
  upper arms, forearms, hands, thighs, shins and feet glide down to 75%. The downloaded copy then
  runs in the Rig Animator with visibly shorter arms and legs.
</video>

<video controls loop muted playsinline width="720" src="/video/model-editor/shorter-limbs-compare.webm">
  The original and the shortened copy run side by side. The copy's legs and arms are shorter, so its
  head sits proportionally larger on its body.
</video>

The clips were recorded with the `record-demo` procedure; the scene file is in the plan on the
feature's issue.

## What an upload needs

| The upload                             | What the editor does                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------------------- |
| A Mixamo rig                           | Uses it as it is. A prefix renumbered on re-import (`mixamorig1:Hips`) still matches. |
| No skeleton at all                     | Generates one with the Rig Animator's auto-rig, then offers every slider.             |
| A skeleton named by another convention | Shows no Body or Face group: there is nothing it can match the regions to.            |

Auto-rigging fits a template of human proportions to the model's bounding box, so it suits a
figure built like a person. A figure with a head a third of its height, such as the stickman,
lands its head bone in the wrong place and tears at the neck when resized; the
[Avatar Editor](/docs/journey/avatar-editor) resizes that rig by its own named parts instead.

A face is found through the head bone: the vertices bound to it are the head, and each feature
is placed at a set proportion of the way from chin to crown, then snapped forward onto the skin.
It is an estimate, so a face with sunglasses or an unusual shape may have a feature land on the
glasses or a little off its mark.

## Source files

- `src/views/Tools/ModelEditor/ModelEditor.vue`: the view (scene setup, model upload and
  download, auto-rigging an upload with no skeleton, the Config panel schema built from
  whatever the loaded model turned out to have)
- `src/views/Tools/ModelEditor/bodyParts.ts` (+ `.test.ts`): collecting and matching the rig's
  bones, measuring them at load and applying the per-region proportions to them
- `src/views/Tools/ModelEditor/faceFeatures.ts` (+ `.test.ts`): finding the face, placing each
  feature on it and deforming the mesh around it
- `src/views/Tools/ModelEditor/config.ts`: the scene config, the slider ranges, the table of
  body regions and the table of facial features

Loading a model file, auto-rigging it, resolving the bones that carry the hierarchy and
exporting a `.glb` are reused from the Rig Animator's own `rigModel.ts` and `export.ts`, as is
`frameCameraOnModel`.

## Why a region is a bone and a tip, not just a bone

A bone's scale is applied in the bone's own local space, which means length and size are not
two separate quantities at all: they are the same scale on different axes. The axis a limb runs
along is its length, the two across it are its thickness.

Which axis that is has to be measured, not assumed, and the measurement comes from where the
next bone down sits. That next bone is named in the table rather than taken as "the first
child", because several of these bones start more than one chain: a hand starts five fingers,
and the top of the spine starts the neck and both shoulders. Only one of those directions is
the one the region's own length runs along. A bone at the end of its chain, which a generated
rig has at the hands and head, carries on the way it came from its parent.

The hips are deliberately not a region. They are the root every other region hangs off, so
scaling them resizes the whole figure rather than a part of it, which is what the model's own
scale is for.

## Why an edit stops where the next region starts

Scale carries down a bone chain, so a thicker upper arm would arrive as a thicker forearm and a
swollen hand unless something stopped it. A bone that starts a new region therefore takes its
region's scale divided by whatever its parent already carries, which leaves the effect on
exactly the region it was asked for.

The limb still grows longer all the same. A child bone's offset from its parent sits in the
parent's own scaled space, and that offset is what a segment's length is: stretching the parent
along its length axis carries every bone below it further out without stretching any of them.

A bone no region covers is left at its rest scale, which means it simply rides along with the
region above it: the fingers grow with the hand, the toes with the foot, the crown with the head.

## Why the face moves the mesh and not a bone

The bundled Mixamo characters carry no face bones beyond the head itself and no blend shapes, so
the only thing there is to reshape is the geometry. Each feature pulls on the vertices within its
radius, at full strength across a core and easing to nothing at the edge, and the pull is worked
out once at load in each mesh's own geometry space. The geometry is what moves, under the skin,
so a face edit rides along with every bone scale and is written into a downloaded model.

A falloff that eased from the very centre barely changed a feature: the vertices nearest its
point have almost no distance from it to scale. The solid core moves the whole feature and spends
only the outer ring blending it into the face.
