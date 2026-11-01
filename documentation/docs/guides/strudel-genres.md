---
sidebar_position: 26
---

# Writing a song in a Strudel style

Every style in the editor has two homes. The first is data the hints read, the second is the
writing the hints cannot check:

- `STRUDEL_MUSIC_STYLES` in `src/views/Tools/StrudelEditor/config.ts` holds the tempo range,
  defining roles, instrument snippets and the visuals the hints expect.
- This page holds the form, groove, harmony, melody and usual failure of each style.

Read both before writing a note. The style entry says what the editor will check; this page says
what the ear will check.

## Search order

1. Find the style in `STRUDEL_MUSIC_STYLES` and note its tempo, roles, instruments and visuals.
2. Read its section below and write the form, then the one-line brief.
3. Check every sound name in the Sounds tab, or in `node_modules/@strudel/soundfonts/gm.mjs`
   for the General MIDI names.
4. Write the song as `$:` blocks, one block per role group, with `stack()` inside a block when
   two parts share a role. Use `.mask` for the arrangement.
5. Check the hints tab finds nothing missing and nothing to review, then render and measure it
   with `strudel-sound`.

A style that is not in the list is not ready to write. Define its tempo, defining roles, form,
groove, harmony, melody, signature and common miss first, then add it to both homes.

## Start with a one-line brief

Before the code, write one line for each:

1. What plays: the role and the instrument for each part.
2. Where it happens: the room, the distance, the era.
3. What it must not sound like: the failure being avoided.

Then write the form as section names and bar counts. One cycle is one bar at
`setcpm(bpm / 4)`, so the bar count is also the number of cycles.

## The four things a loop lacks

A four-bar chord loop with an eight-note scale run is a backing track, not a song. Every song
here needs:

- **A motif.** A short rhythm-and-contour idea, two to four bars, that returns. State it,
  sequence it, change its ending; do not restate it identically every bar.
- **A bass line with its own rhythm.** Roots on the downbeat are a pad, not a bass. The bass
  should answer the kick and outline the harmony.
- **A form.** At least two sections that differ in density, register or harmony, with an
  arrival and a return. `.mask` is the arrangement: add and remove whole roles, not just
  repeats.
- **An ending.** A fill, a cadence, a dropout or a tag. A loop that stops at its last bar is
  unfinished.

## Style notes

### Techno

- **Form.** Intro 16, build 16, main 16, break 8, main 16, outro 8. Sections change by adding
  and removing layers, not by changing chords.
- **Rhythm.** Kick on every beat, offbeat hats, clap on two and four, a short bass between the
  kicks, percussion off the grid. The kick is the song.
- **Harmony.** One minor chord, a drone or a two-chord vamp held for bars. A four-chord pop
  progression is already too much.
- **Melody.** A one- or two-bar motif through a filter, or an acid line with slides. Vary it
  with cutoff, resonance and delay rather than with new notes.
- **Signature.** 909 or 707 drums, offbeat open hat, short saw bass, acid filter, long reverb on
  the percussion.
- **Common miss.** A four-chord loop with a scale-run lead.

### House

- **Form.** Intro 8, groove 16, chorus 16, break 8, chorus 16, outro 8.
- **Rhythm.** Four on the floor, offbeat open hats, clap on two and four, bass between the
  kicks. A light swing on the sixteenths is normal.
- **Harmony.** Seventh chords, a ii-V-I or a two-chord vamp. Put the chords on the offbeats as
  stabs, not on every beat as a pad.
- **Melody.** A piano or Rhodes hook, or a vocal fragment: short, syncopated, repeated with a
  changed last bar.
- **Signature.** 909 drums, offbeat open hat, warm Rhodes or piano, sub bass, a little tape or
  vinyl noise.
- **Common miss.** Block chords on every beat, a bass on the downbeat, and no build.

### Drum and bass

- **Form.** Intro 16, drop 32, break 16, drop 32, outro 16. Phrases are sixteen bars.
- **Rhythm.** A two-step kick on one and the and of three, snare on two and four, fast hats, sub
  bass. At 174 BPM the feel is half-time.
- **Harmony.** One or two minor chords and an atmosphere. The bass owns the low end, so the
  chords stay out of its way.
- **Melody.** The bass is the lead: a Reese or a growl with filter movement. Add a short
  atmospheric motif or a vocal sample, not a tune.
- **Signature.** Amen or Think break, 808 sub, Reese, long reverb, tape delay.
- **Common miss.** A rock beat at 174 with a root-note bass.

### Hip hop

- **Form.** Intro 4, verse 16, hook 8, verse 16, hook 8, outro 4. The loop is two to four bars
  with a variation every four.
- **Rhythm.** Boom-bap kick, snare on two and four, swung eighth or sixteenth hats, a sparse bass
  that follows the kick. Leave space for a vocal.
- **Harmony.** Jazzy seventh chords, often a two-chord loop. Keep them short and filtered so
  they read as sampled.
- **Melody.** A chopped sample or a three- to five-note Rhodes or vibes motif; repeat it and
  change the last bar.
- **Signature.** MPC swing, vinyl noise, Rhodes, sub bass, sample chops.
- **Common miss.** A busy eight-bar melody, straight hats and no space.

### Ambient

- **Form.** No pop sections: thirty-two to sixty-four bars of gradual change with one arrival.
- **Rhythm.** No drums, or a very sparse pulse. Let events breathe and let the tails run.
- **Harmony.** Slow chords every two to four bars, modal or drone-based. Functional cadences
  are rare.
- **Melody.** Fragments, not a tune: three to five notes with long decays and delay.
- **Signature.** Pads, sine drones, field recordings, tape, a large room.
- **Common miss.** A pop chord loop with a lead and a beat.

### Trance

- **Form.** Intro 16, build 16, breakdown 16, drop 32, outro 16. Phrases are sixteen bars.
- **Rhythm.** Four on the floor, offbeat hats, a rolling bass between the kicks, clap on two and
  four.
- **Harmony.** Minor or major, a four-chord loop, supersaw chords. The breakdown supplies the
  lift.
- **Melody.** An arpeggio hook or a long-note lead. State it plainly, then open the filter.
- **Signature.** Supersaw, 909 drums, sidechained bass, a riser and a long breakdown.
- **Common miss.** A short loop with no build and a scale-run lead.

### Dub

- **Form.** Intro 4, riddim 16, dropout 4, riddim 16, outro 4. Space is the arrangement.
- **Rhythm.** One-drop kick on three, rim or snare on three, a bass that carries the melody, a
  skank on the offbeats.
- **Harmony.** Minor, one or two chords. The bass line is the hook.
- **Melody.** A melodica or organ line, or a vocal fragment, drenched in delay.
- **Signature.** Spring reverb, tape delay, sub bass, organ, dropouts.
- **Common miss.** A four-on-the-floor beat and too many layers.

### Breakbeat

- **Form.** Intro 8, verse 16, breakdown 8, verse 16, outro 8. Edit every four to eight bars.
- **Rhythm.** A sampled break such as Amen or Think, a syncopated bass, clap and percussion. No
  four-on-the-floor.
- **Harmony.** One or two chords, often a minor vamp. The break carries the track.
- **Melody.** A chopped vocal or a short acid or big-beat riff; use reverses and filters.
- **Signature.** Amen break, big drums, acid bass, tape stops.
- **Common miss.** A straight drum machine under the break and no edits.

### Synthwave

- **Form.** Intro 8, verse 8, chorus 8, break 4, chorus 8, outro 4.
- **Rhythm.** Four on the floor, gated clap on two and four, offbeat hats, octave bass, a tom
  fill every eight bars.
- **Harmony.** Minor, a four-chord loop, one substitution in the chorus (the song here moves
  Am-F-G-E in the verse to Am-F-C-G in the chorus). Use wide voicings and let the pad ring.
- **Melody.** A two-bar lead motif with long notes and a dotted rhythm, sequenced down in the
  repeat, over a sixteenth-note chord-tone arpeggio.
- **Signature.** Juno-style pad, gated snare or clap, octave bass, arpeggio, dotted delay.
- **Common miss.** A scale-run lead, no arpeggio and a dry snare.

### Stoner rock

- **Form.** Intro 8 on the riff, verse 8, chorus 8, breakdown 8, chorus 8, outro 8.
- **Rhythm.** Heavy syncopated kick, snare on two and four, eighth hats, toms. Play slightly
  behind the beat.
- **Harmony.** A riff, not a chord loop. Drop D; D minor pentatonic or the blues scale with an
  Ab blue note; power chords voiced root, fifth and octave.
- **Melody.** Sparse pentatonic phrases with bends and long notes. Answer the riff; do not run
  the scale.
- **Signature.** Fuzz guitar and bass in unison, wah, ride, a big room.
- **Common miss.** Full triads or sevenths, a straight rock beat and a scale-run lead.

### Grunge

- **Form.** Quiet verse 8, loud chorus 8, quiet verse 8, loud chorus 8, bridge 4, outro 4.
- **Rhythm.** Verse: kick on one and three, snare on two and four, tight hats. Chorus: crashes,
  busy toms and a sloppy swing.
- **Harmony.** Minor with chromatic turns and power chords. The quiet verse riff and the open
  chorus chords are the contrast.
- **Melody.** A three- to five-note shouted hook, repeated with a variation, doubled by guitar.
- **Signature.** Distorted guitar, drop tuning, feedback, dry drums, room.
- **Common miss.** A pop-punk progression with no dynamic contrast and a scale-run lead.

### Classical

- **Form.** A 8, B 8, A' 8, coda 8. Phrases are four bars, in antecedent and consequent pairs.
- **Rhythm.** No drum kit. The phrase rhythm carries the motion; timpani marks the cadences.
- **Harmony.** Functional and voice-led. Dm-Gm-A7-Dm, a modulation to the relative major,
  suspensions, a Picardy third.
- **Melody.** A singable theme with a dotted rhythm and a stepwise descent, sequenced, with a
  counter-line. State it, develop it, bring it back changed.
- **Signature.** Violin melody, viola or ensemble inner voices, cello bass, timpani.
- **Common miss.** A string pad plus a scale run; block chords with no voice leading; a drum kit.

### Funk

- **Form.** Intro 8, verse 16, chorus 8, break 8, chorus 8. A twelve-bar blues or a one-chord
  vamp both work.
- **Rhythm.** Syncopated kick, ghost-note snare, tight sixteenth hats, open hat on the and of
  four, congas or shaker.
- **Harmony.** One chord or a blues vamp, with sevenths and ninths. Short stabs, not pads.
- **Melody.** The bass is the lead: a syncopated line with octaves, ghost notes and a slide into
  the fifth. Horns answer it.
- **Signature.** Slap bass, clavinet, wah guitar, brass, congas.
- **Common miss.** A straight rock beat, root-note bass and chords on every beat.

### Jazz

- **Form.** Intro 4, a 32-bar AABA head, tag 4. A longer version is head, solo, head.
- **Rhythm.** Swung ride, brushed snare, feathered kick, a walking bass in quarter notes.
- **Harmony.** Standards forms: a twelve-bar blues or rhythm changes. ii-V-I, guide tones,
  sparse and syncopated comping.
- **Melody.** A bebop head built from chord tones and guide tones, with rests. State it, then
  solo over the same form.
- **Signature.** Ride, upright bass, Rhodes or piano, vibes or a horn.
- **Common miss.** A straight beat, a scale-run head, block chords on every beat and no swing.

## Before committing

- The form has at least two sections and the masks add and remove whole roles.
- The motif returns, and its second statement differs.
- The bass has a rhythm of its own and outlines the harmony.
- The melody is a motif, not a scale played in order.
- The style's defining roles, instruments and visuals are all present, so the hints tab finds
  nothing missing and nothing to review.
- The file renders, measures at or below -1 dBFS true peak and around -16 to -21 LUFS, and the
  spectrogram shows the sections changing.
