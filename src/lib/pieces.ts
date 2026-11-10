import { fixedTempoSong, type Song } from './song';
import type { Hand } from './theory';

// Peças de domínio público, arranjos simples para a Fase 1.
// Notação compacta: [nota MIDI, duração em tempos, dedo?]; 0 = pausa.

type Ev = [number, number, number?];

function line(evs: Ev[], hand: Hand, startBeat = 0) {
  const out: Array<{ midi: number; beat: number; beats: number; hand: Hand; finger?: number }> = [];
  let b = startBeat;
  for (const [m, d, f] of evs) {
    if (m > 0) out.push({ midi: m, beat: b, beats: d, hand, finger: f });
    b += d;
  }
  return out;
}

const C4 = 60, D4 = 62, E4 = 64, F4 = 65, G4 = 67, A4 = 69;
const C3 = 48, F2 = 41, G2 = 43;

export function brilhaBrilha(bpm: number, hands: Hand[]): Song {
  // Mão na posição de Ré depois do Sol: 1 1 4 4 5 5 4 | 3 3 2 2 1 1 1
  const a: Ev[] = [[C4, 1, 1], [C4, 1, 1], [G4, 1, 4], [G4, 1, 4], [A4, 1, 5], [A4, 1, 5], [G4, 2, 4], [F4, 1, 3], [F4, 1, 3], [E4, 1, 2], [E4, 1, 2], [D4, 1, 1], [D4, 1, 1], [C4, 2, 1]];
  const b: Ev[] = [[G4, 1, 4], [G4, 1, 4], [F4, 1, 3], [F4, 1, 3], [E4, 1, 2], [E4, 1, 2], [D4, 2, 1]];
  const rh = [...a, ...b, ...b, ...a];
  // baixo de mínimas acompanhando a harmonia
  const la: Ev[] = [[C3, 2, 1], [C3, 2, 1], [F2, 2, 4], [C3, 2, 1], [F2, 2, 4], [C3, 2, 1], [G2, 2, 3], [C3, 2, 1]];
  const lb: Ev[] = [[C3, 2, 1], [F2, 2, 4], [C3, 2, 1], [G2, 2, 3]];
  const lh = [...la, ...lb, ...lb, ...la];
  const notes = [...(hands.includes('R') ? line(rh, 'R') : []), ...(hands.includes('L') ? line(lh, 'L') : [])];
  return fixedTempoSong({ title: 'Brilha, Brilha, Estrelinha', bpm, key: 'C', notes });
}

export function odeAlegria(bpm: number, hands: Hand[]): Song {
  const p1: Ev[] = [[E4, 1, 3], [E4, 1, 3], [F4, 1, 4], [G4, 1, 5], [G4, 1, 5], [F4, 1, 4], [E4, 1, 3], [D4, 1, 2], [C4, 1, 1], [C4, 1, 1], [D4, 1, 2], [E4, 1, 3]];
  const rh: Ev[] = [...p1, [E4, 1.5, 3], [D4, 0.5, 2], [D4, 2, 2], ...p1, [D4, 1.5, 2], [C4, 0.5, 1], [C4, 2, 1]];
  const lh: Ev[] = [[C3, 4, 1], [G2, 4, 5], [C3, 4, 1], [G2, 4, 5], [C3, 4, 1], [G2, 4, 5], [C3, 4, 1], [G2, 2, 5], [C3, 2, 1]];
  const notes = [...(hands.includes('R') ? line(rh, 'R') : []), ...(hands.includes('L') ? line(lh, 'L') : [])];
  return fixedTempoSong({ title: 'Ode à Alegria (Beethoven)', bpm, key: 'C', notes });
}

export function jingleBells(bpm: number, hands: Hand[]): Song {
  const e3: Ev[] = [[E4, 1, 3], [E4, 1, 3], [E4, 2, 3]];
  const m3: Ev[] = [[E4, 1, 3], [G4, 1, 5], [C4, 1.5, 1], [D4, 0.5, 2]];
  const m5: Ev[] = [[F4, 1, 4], [F4, 1, 4], [F4, 1.5, 4], [F4, 0.5, 4]];
  const m6: Ev[] = [[F4, 1, 4], [E4, 1, 3], [E4, 1, 3], [E4, 0.5, 3], [E4, 0.5, 3]];
  const rh: Ev[] = [
    ...e3, ...e3, ...m3, [E4, 4, 3], ...m5, ...m6, [E4, 1, 3], [D4, 1, 2], [D4, 1, 2], [E4, 1, 3], [D4, 2, 2], [G4, 2, 5],
    ...e3, ...e3, ...m3, [E4, 4, 3], ...m5, ...m6, [G4, 1, 5], [G4, 1, 5], [F4, 1, 4], [D4, 1, 2], [C4, 4, 1],
  ];
  const roots = [C3, C3, C3, C3, F2, C3, G2, G2, C3, C3, C3, C3, F2, C3, G2, C3];
  const lh: Ev[] = roots.map((r) => [r, 4, r === C3 ? 1 : r === F2 ? 4 : 3] as Ev);
  const notes = [...(hands.includes('R') ? line(rh, 'R') : []), ...(hands.includes('L') ? line(lh, 'L') : [])];
  return fixedTempoSong({ title: 'Jingle Bells (refrão)', bpm, key: 'C', notes });
}

/** Für Elise, parte A (Beethoven), em 3/8. Começa com anacruse: o compasso 1 do app tem uma pausa antes. */
export function furElise(bpm: number, hands: Hand[]): Song {
  const s = 0.25, e = 0.5;
  const E5 = 76, Ds5 = 75, B4 = 71, D5 = 74, C5 = 72, Gs4 = 68;
  const A2 = 45, E2 = 40, E3 = 52, A3 = 57, Gs3 = 56;
  const motif: Ev[] = [[E5, s, 5], [Ds5, s, 4], [E5, s, 5], [B4, s, 2], [D5, s, 4], [C5, s, 3]];
  const rh: Ev[] = [
    [0, 1], [E5, s, 5], [Ds5, s, 4],
    ...motif,
    [A4, e], [0, s], [C4, s], [E4, s], [A4, s],
    [B4, e], [0, s], [E4, s], [Gs4, s], [B4, s],
    [C5, e], [0, s], [E4, s], [E5, s], [Ds5, s],
    ...motif,
    [A4, e], [0, s], [C4, s], [E4, s], [A4, s],
    [B4, e], [0, s], [E4, s], [C5, s], [B4, s],
    [A4, 1.5],
  ];
  const arp = (a: number, b: number, c: number): Ev[] => [[a, s, 5], [b, s, 2], [c, s, 1], [0, 0.75]];
  const lh: Ev[] = [
    [0, 1.5], [0, 1.5],
    ...arp(A2, E3, A3), ...arp(E2, E3, Gs3), ...arp(A2, E3, A3), [0, 1.5],
    ...arp(A2, E3, A3), ...arp(E2, E3, Gs3), ...arp(A2, E3, A3),
  ];
  const notes = [...(hands.includes('R') ? line(rh, 'R') : []), ...(hands.includes('L') ? line(lh, 'L') : [])];
  return fixedTempoSong({ title: 'Für Elise, parte A (Beethoven)', bpm, timeSig: [3, 8], key: 'Am', notes });
}
