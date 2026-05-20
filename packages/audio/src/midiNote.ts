/**
 * Converts a MIDI note number to its frequency in Hz using equal temperament.
 * MIDI note 69 = A4 = 440 Hz. MIDI note 60 = middle C ≈ 261.63 Hz.
 * @param midiNote - MIDI note number (0–127)
 * @returns Frequency in Hz
 */
export const midiNoteToFreq = (midiNote: number): number => 440 * Math.pow(2, (midiNote - 69) / 12)
