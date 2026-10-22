// Note math helpers. Notes are stored as MIDI numbers (E2 = 40, A4 = 69).
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const Notes = {
  NAMES: NOTE_NAMES,
  A4: 440,

  midiToFreq(midi) {
    return Notes.A4 * Math.pow(2, (midi - 69) / 12);
  },

  freqToMidi(freq) {
    return 69 + 12 * Math.log2(freq / Notes.A4);
  },

  name(midi) {
    return NOTE_NAMES[((midi % 12) + 12) % 12];
  },

  octave(midi) {
    return Math.floor(midi / 12) - 1;
  },

  label(midi) {
    return Notes.name(midi) + Notes.octave(midi);
  },

  // Cents from target note to the given frequency (+ = sharp, - = flat).
  centsOff(freq, targetMidi) {
    return 1200 * Math.log2(freq / Notes.midiToFreq(targetMidi));
  },
};

// Strings listed low (6th) to high (1st).
const PRESET_TUNINGS = [
  { name: 'Standard (E A D G B E)', notes: [40, 45, 50, 55, 59, 64] },
  { name: 'Drop D', notes: [38, 45, 50, 55, 59, 64] },
  { name: 'Half step down (Eb)', notes: [39, 44, 49, 54, 58, 63] },
  { name: 'Whole step down (D)', notes: [38, 43, 48, 53, 57, 62] },
  { name: 'Drop C', notes: [36, 43, 48, 53, 57, 62] },
  { name: 'DADGAD', notes: [38, 45, 50, 55, 57, 62] },
  { name: 'Open G', notes: [38, 43, 50, 55, 59, 62] },
  { name: 'Open D', notes: [38, 45, 50, 54, 57, 62] },
  { name: 'Open E', notes: [40, 47, 52, 56, 59, 64] },
  { name: 'Open C', notes: [36, 43, 48, 55, 60, 64] },
];
