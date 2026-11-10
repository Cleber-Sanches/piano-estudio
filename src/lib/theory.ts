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

/**
 * Dedilhado padrão de escala de 1 oitava (subida + descida, 15 notas).
 * Cobre as escalas da Fase 1: Dó, Sol, Ré, Lá, Mi (padrão de Dó) e Fá (polegar no Si♭).
 */
export function scaleFingering(tonic: number, mode: Mode, hand: Hand): number[] {
  let up: number[];
  if (hand === 'R') {
    up = tonic === 5 && mode === 'maior' ? [1, 2, 3, 4, 1, 2, 3, 4] : [1, 2, 3, 1, 2, 3, 4, 5];
  } else {
    up = [5, 4, 3, 2, 1, 3, 2, 1];
  }
  const down = up.slice(0, -1).reverse();
  return [...up, ...down];
}

export const FIVE_FINGER_R = [1, 2, 3, 4, 5, 4, 3, 2, 1];
export const FIVE_FINGER_L = [5, 4, 3, 2, 1, 2, 3, 4, 5];
