import type { SoundSlot } from '@/types/soundPanel'
import themeCode from '@/assets/audio/rockrunner/run-theme.strudel?raw'
import rollCode from '@/assets/audio/rockrunner/roll.strudel?raw'
import bumpCode from '@/assets/audio/rockrunner/bump.strudel?raw'
import fallCode from '@/assets/audio/rockrunner/fall.strudel?raw'
import finishCode from '@/assets/audio/rockrunner/finish.strudel?raw'

// The shipped files were rendered from exactly these sources and cycle counts, so Reset and a
// fresh Apply of unchanged code sound the same.
export const ROCK_RUNNER_SOUND_SLOTS: SoundSlot[] = [
  { id: 'theme', label: 'Music', code: themeCode, kind: 'loop', cycles: 32 },
  { id: 'roll', label: 'Rolling', code: rollCode, kind: 'loop', cycles: 1, crossfadeSeam: true },
  { id: 'bump', label: 'Bump', code: bumpCode, kind: 'once' },
  { id: 'fall', label: 'Fall', code: fallCode, kind: 'once' },
  { id: 'finish', label: 'Finish', code: finishCode, kind: 'once', cycles: 2 }
]
