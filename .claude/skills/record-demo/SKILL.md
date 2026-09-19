---
name: record-demo
description: >-
  Use when a feature with a visible outcome is ready to show, when opening a pull request for
  one, and when asked for a demo, a video, a walkthrough, a recording, a before and after, or to
  "show it in action". Records the feature the plan's Demo section defines by driving the real
  UI (Config panel sliders, buttons, uploads, downloads) in the running app, then cuts it into
  very short sped-up clips, a summary and an optional side-by-side comparison.
---

# Recording a feature demo

A demo proves the feature does what the plan said it would, through the UI a person would use,
in a few seconds of video. It is defined before it is recorded, in the plan, so what gets filmed
is a claim someone agreed to rather than whatever happened to look good.

## 1. Find the Demo section in the plan

The issue's implementation plan (see `start-issue`) carries a `### Demo` section: one scene per
claim, each naming the route, what changes in the UI, and what the clip must show. If the plan
has none, write it there first and post it, then record.

A good scene list is short: a **before**, the **change** being made in the UI, and the **after**.
Anything the before and after need to be compared on side by side, because a tool frames its
camera on the model and hides a change in size, is named as the comparison.

## 2. Turn it into a scene file

Write the scenes as a scene file in a temporary directory, never in the repo. Paths inside it
are read relative to the file, so outputs and any file a scene downloads or uploads land beside
it. The format and every step it accepts are in
`documentation/docs/guides/capturing-documentation-media.md`, under _A feature demo from a
scene file_. Put the scene file itself in the plan, in a collapsed block under the Demo section,
so the demo can be recorded again after the feature changes.

## 3. Record

```sh
pnpm dev --port 5317 --strictPort
node scripts/record-demo.mjs <tmp>/<feature>.scenes.json
```

Each scene records in its own browser context, so no scene inherits another's local storage or
autosave. The output is one `.mp4` per scene, the joined `<summary>.mp4` and `.webm`, and
`<summary>-compare.mp4` when the file names a comparison.

## 4. Watch what was recorded

Pull a frame from the middle of every clip and look at it before shipping anything:

```sh
ffmpeg -ss 1.2 -i <clip>.mp4 -frames:v 1 <tmp>/check.png
```

A scene that clicked the wrong thing still produces a valid video. Check that each clip shows
its claim: the slider moved, the model changed, the animation plays on the right model.

## 5. Ship it

- The summary `.webm` goes into `documentation/static/video/<feature>/` and the guide for the
  feature embeds it, per `.claude/rules/docs.md`.
- The summary `.mp4` and the comparison go into the pull request with
  `node scripts/gh-video.mjs <files...> --pr <number> --append`; GitHub only plays an uploaded
  `.mp4` inline (`documentation/docs/guides/videos-in-pull-requests.md`).

## Keeping clips short

- Each clip lands between two and three seconds once sped up.
- Speed 2 for motion that has to stay readable, such as an animation playing; 4 or more for
  slider work, where the point is the change rather than the dragging.
- Glide config values (`over`) rather than jumping them: a slider that jumps shows nothing in
  a video but a cut.
- Caption every scene with the claim it proves, in a few words.
