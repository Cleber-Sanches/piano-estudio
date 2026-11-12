// Teoria básica: nomes de notas, escalas, tríades e dedilhados.

export type Hand = 'R' | 'L';

export const PITCH_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const PITCH_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
export const PITCH_PT = ['Dó', 'Dó♯', 'Ré', 'Mi♭', 'Mi', 'Fá', 'Fá♯', 'Sol', 'Lá♭', 'Lá', 'Si♭', 'Si'];

export type Mode = 'maior' | 'menor';
export const SCALE: Record<Mode, number[]> = {
  maior: [0, 2, 4, 5, 7, 9, 11],
  menor: [0, 2, 3, 5, 7, 8, 11], // menor harmônica
};

/** Tônicas que se escrevem com bemóis. */
const FLAT_TONICS_MAJOR = new Set([5, 10, 3, 8, 1, 6]);
const FLAT_TONICS_MINOR = new Set([2, 7, 0, 5, 10, 3]);

export function usesFlats(tonic: number, mode: Mode): boolean {
  return mode === 'maior' ? FLAT_TONICS_MAJOR.has(tonic) : FLAT_TONICS_MINOR.has(tonic);
}

/** Armadura no formato do VexFlow ("G", "F", "Am", "Bb"...). */
export function keySignature(tonic: number, mode: Mode): string {
  const names = usesFlats(tonic, mode) ? PITCH_FLAT : PITCH_SHARP;
  return names[tonic] + (mode === 'menor' ? 'm' : '');
}

export function tonicName(tonic: number, mode: Mode): string {
  return PITCH_PT[tonic] + (mode === 'menor' ? ' menor' : ' maior');
}

export function noteName(midi: number, flats = false): string {
  const names = flats ? PITCH_FLAT : PITCH_SHARP;
  return names[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
}

export function isBlack(midi: number): boolean {
  return [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12);
}

/** Notas da escala a partir de `base` (MIDI da tônica), subindo `octaves` oitavas, incluindo a tônica do topo. */
export function scaleNotes(base: number, mode: Mode, octaves = 1): number[] {
  const out: number[] = [];
  for (let o = 0; o < octaves; o++) SCALE[mode].forEach((i) => out.push(base + i + 12 * o));
  out.push(base + 12 * octaves);
  return out;
}

/** Tríade diatônica do grau `degree` (0 = I) em posição fundamental. */
export function triad(base: number, mode: Mode, degree: number): number[] {
  const s = SCALE[mode];
  const at = (i: number) => base + s[(degree + i) % 7] + 12 * Math.floor((degree + i) / 7);
  return [at(0), at(2), at(4)];
}

/** Dedilhado de subida (1 oitava, 8 notas) das escalas maiores, por tônica. Menores harmônicas usadas aqui seguem o mesmo padrão. */
const RH_UP: Record<number, number[]> = {
  0: [1, 2, 3, 1, 2, 3, 4, 5], 7: [1, 2, 3, 1, 2, 3, 4, 5], 2: [1, 2, 3, 1, 2, 3, 4, 5], 9: [1, 2, 3, 1, 2, 3, 4, 5],
  4: [1, 2, 3, 1, 2, 3, 4, 5], 11: [1, 2, 3, 1, 2, 3, 4, 5], 5: [1, 2, 3, 4, 1, 2, 3, 4], 10: [4, 1, 2, 3, 1, 2, 3, 4],
  3: [3, 1, 2, 3, 4, 1, 2, 3], 8: [3, 4, 1, 2, 3, 1, 2, 3], 1: [2, 3, 1, 2, 3, 4, 1, 2], 6: [2, 3, 4, 1, 2, 3, 1, 2],
};
const LH_UP: Record<number, number[]> = {
  0: [5, 4, 3, 2, 1, 3, 2, 1], 7: [5, 4, 3, 2, 1, 3, 2, 1], 2: [5, 4, 3, 2, 1, 3, 2, 1], 9: [5, 4, 3, 2, 1, 3, 2, 1],
  4: [5, 4, 3, 2, 1, 3, 2, 1], 5: [5, 4, 3, 2, 1, 3, 2, 1], 11: [4, 3, 2, 1, 4, 3, 2, 1], 10: [3, 2, 1, 4, 3, 2, 1, 3],
  3: [3, 2, 1, 4, 3, 2, 1, 3], 8: [3, 2, 1, 4, 3, 2, 1, 3], 1: [3, 2, 1, 4, 3, 2, 1, 3], 6: [4, 3, 2, 1, 3, 2, 1, 4],
};

/**
 * Dedilhado padrão de escala (subida + descida) em 1 ou 2 oitavas.
 * Na 2ª oitava, a tônica do meio usa o dedo que começa a escala (direita) ou o que a termina (esquerda).
 */
export function scaleFingering(tonic: number, _mode: Mode, hand: Hand, octaves = 1): number[] {
  const up = (hand === 'R' ? RH_UP : LH_UP)[tonic] ?? (hand === 'R' ? RH_UP[0] : LH_UP[0]);
  let seq = up;
  if (octaves === 2) seq = [...up.slice(0, 7), hand === 'R' ? up[0] : up[7], ...up.slice(1)];
  return [...seq, ...seq.slice(0, -1).reverse()];
}

/** Escala cromática de 1 oitava a partir do Dó: 3 nas pretas, 1 nas brancas, 2 onde há duas brancas seguidas. */
export const CHROMATIC_R = [1, 3, 1, 3, 1, 2, 3, 1, 3, 1, 3, 1, 2];
export const CHROMATIC_L = [1, 3, 1, 3, 2, 1, 3, 1, 3, 1, 3, 2, 1];

export type Seventh = 'maj7' | 'm7' | '7' | 'm7b5';
const SEVENTH: Record<Seventh, number[]> = { maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], '7': [0, 4, 7, 10], m7b5: [0, 3, 6, 10] };
export const seventhChord = (root: number, q: Seventh) => SEVENTH[q].map((i) => root + i);
/** Qualidade da tétrade em cada grau da escala maior. */
export const SEVENTH_DEGREES: Seventh[] = ['maj7', 'm7', 'm7', 'maj7', '7', 'm7', 'm7b5'];

export const FIVE_FINGER_R = [1, 2, 3, 4, 5, 4, 3, 2, 1];
export const FIVE_FINGER_L = [5, 4, 3, 2, 1, 2, 3, 4, 5];
