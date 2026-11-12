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

/** Parabéns pra Você, em 3/4 com anacruse (o compasso 1 do app começa com pausa). */
export function parabens(bpm: number, hands: Hand[]): Song {
  const B4 = 71, C5 = 72, D5 = 74, E5 = 76, F5 = 77, G5 = 79;
  const h = 0.5;
  const rh: Ev[] = [
    [0, 2], [G4, h, 1], [G4, h, 1],
    [A4, 1, 2], [G4, 1, 1], [C5, 1, 4],
    [B4, 2, 3], [G4, h, 1], [G4, h, 1],
    [A4, 1, 2], [G4, 1, 1], [D5, 1, 5],
    [C5, 2, 4], [G4, h, 1], [G4, h, 1],
    [G5, 1, 5], [E5, 1, 3], [C5, 1, 1],
    [B4, 1, 2], [A4, 1, 1], [F5, h, 4], [F5, h, 4],
    [E5, 1, 3], [C5, 1, 1], [D5, 1, 2],
    [C5, 3, 1],
  ];
  const roots = [C3, G2, G2, C3, C3, F2, G2, C3];
  const lh: Ev[] = [[0, 3], ...roots.map((r) => [r, 3, r === C3 ? 1 : r === F2 ? 4 : 3] as Ev)];
  const notes = [...(hands.includes('R') ? line(rh, 'R') : []), ...(hands.includes('L') ? line(lh, 'L') : [])];
  return fixedTempoSong({ title: 'Parabéns pra Você', bpm, timeSig: [3, 4], key: 'C', notes });
}

/** Cânone em Ré (Pachelbel), arranjo simples: primeiro só acordes, depois a melodia da 1ª entrada. */
export function canon(bpm: number, hands: Hand[]): Song {
  const D2 = 38, A2 = 45, B2 = 47, Fs2 = 42, G2b = 43;
  const Fs4 = 66, B4 = 71, Cs5 = 73, D5 = 74, E5 = 76, Fs5 = 78, A4b = 69, E4b = 64, G4b = 67;
  const bass = [D2 + 12, A2, B2, Fs2, G2b, D2 + 12, G2b, A2];
  const chords = [[Fs4, A4b, D5], [E4b, A4b, Cs5], [Fs4, B4, D5], [Fs4, A4b, Cs5], [G4b, B4, D5], [Fs4, A4b, D5], [G4b, B4, D5], [E4b, A4b, Cs5]];
  const melody = [Fs5, E5, D5, Cs5, B4, A4b, B4, Cs5];
  const notes: Parameters<typeof fixedTempoSong>[0]['notes'] = [];
  for (let rep = 0; rep < 3; rep++) {
    bass.forEach((b, i) => {
      const beat = (rep * 8 + i) * 2;
      if (hands.includes('L')) notes.push({ midi: b, beat, beats: 2, hand: 'L' });
      if (!hands.includes('R')) return;
      if (rep === 0) chords[i].forEach((m) => notes.push({ midi: m, beat, beats: 2, hand: 'R' }));
      else notes.push({ midi: melody[i], beat, beats: 2, hand: 'R', finger: [5, 4, 3, 2, 1, 1, 2, 3][i] });
    });
  }
  return fixedTempoSong({ title: 'Cânone em Ré (Pachelbel)', bpm, key: 'D', notes });
}

const G3 = 55, A3 = 57;
const both = (rh: Ev[], lh: Ev[], hands: Hand[]) => [...(hands.includes('R') ? line(rh, 'R') : []), ...(hands.includes('L') ? line(lh, 'L') : [])];

/** Dó Ré Mi Fá (cantiga): só a direita, dedos 1-2-3-4. */
export function doReMiFa(bpm: number, hands: Hand[]): Song {
  const rh: Ev[] = [
    [C4, 1, 1], [D4, 1, 2], [E4, 1, 3], [F4, 1, 4], [F4, 2, 4], [F4, 2, 4],
    [C4, 1, 1], [D4, 1, 2], [C4, 1, 1], [D4, 1, 2], [D4, 2, 2], [D4, 2, 2],
    [C4, 1, 1], [G4, 1, 5], [F4, 1, 4], [E4, 1, 3], [E4, 2, 3], [E4, 2, 3],
    [C4, 1, 1], [D4, 1, 2], [E4, 1, 3], [F4, 1, 4], [F4, 2, 4], [F4, 2, 4],
  ];
  const lh: Ev[] = [[C3, 4, 1], [F2, 4, 4], [G2, 4, 3], [G2, 4, 3], [C3, 4, 1], [C3, 4, 1], [C3, 4, 1], [F2, 4, 4]];
  return fixedTempoSong({ title: 'Dó Ré Mi Fá', bpm, key: 'C', notes: both(rh, lh, hands) });
}

/** Mary Had a Little Lamb: três notas (Mi, Ré, Dó) e o Sol. */
export function maryLamb(bpm: number, hands: Hand[]): Song {
  const rh: Ev[] = [
    [E4, 1, 3], [D4, 1, 2], [C4, 1, 1], [D4, 1, 2], [E4, 1, 3], [E4, 1, 3], [E4, 2, 3],
    [D4, 1, 2], [D4, 1, 2], [D4, 2, 2], [E4, 1, 3], [G4, 1, 5], [G4, 2, 5],
    [E4, 1, 3], [D4, 1, 2], [C4, 1, 1], [D4, 1, 2], [E4, 1, 3], [E4, 1, 3], [E4, 1, 3], [E4, 1, 3],
    [D4, 1, 2], [D4, 1, 2], [E4, 1, 3], [D4, 1, 2], [C4, 4, 1],
  ];
  const lh: Ev[] = [[C3, 4, 1], [C3, 4, 1], [G2, 4, 3], [C3, 4, 1], [C3, 4, 1], [C3, 4, 1], [G2, 4, 3], [C3, 4, 1]];
  return fixedTempoSong({ title: 'Mary Had a Little Lamb', bpm, key: 'C', notes: both(rh, lh, hands) });
}

/** Frère Jacques (Frei Martinho): frases que se repetem duas vezes. */
export function frereJacques(bpm: number, hands: Hand[]): Song {
  const h = 0.5;
  const a: Ev[] = [[C4, 1, 1], [D4, 1, 2], [E4, 1, 3], [C4, 1, 1]];
  const b: Ev[] = [[E4, 1, 3], [F4, 1, 4], [G4, 2, 5]];
  const c: Ev[] = [[G4, h, 5], [A4, h, 5], [G4, h, 5], [F4, h, 4], [E4, 1, 3], [C4, 1, 1]];
  const d: Ev[] = [[C4, 1, 1], [G3, 1], [C4, 2, 1]];
  const rh: Ev[] = [...a, ...a, ...b, ...b, ...c, ...c, ...d, ...d];
  const lh: Ev[] = Array.from({ length: 8 }, () => [C3, 4, 1] as Ev);
  return fixedTempoSong({ title: 'Frère Jacques (Frei Martinho)', bpm, key: 'C', notes: both(rh, lh, hands) });
}

/** Old MacDonald (Seu Lobato tinha um sítio), em Dó. */
export function seuLobato(bpm: number, hands: Hand[]): Song {
  // A mão sai da posição: sem números de dedo, escolha o que ficar confortável.
  const a: Ev[] = [[C4, 1], [C4, 1], [C4, 1], [G3, 1], [A3, 1], [A3, 1], [G3, 2]];
  const b: Ev[] = [[E4, 1], [E4, 1], [D4, 1], [D4, 1]];
  const rh: Ev[] = [...a, ...b, [C4, 3], [G3, 1], ...a, ...b, [C4, 4]];
  const l: Ev[] = [[C3, 4, 1], [F2, 2, 4], [C3, 2, 1], [C3, 2, 1], [G2, 2, 3], [C3, 4, 1]];
  const lh: Ev[] = [...l, ...l];
  return fixedTempoSong({ title: 'Seu Lobato (Old MacDonald)', bpm, key: 'C', notes: both(rh, lh, hands) });
}

/** Hot Cross Buns: a primeira música de muitos métodos, só três notas. */
export function hotCrossBuns(bpm: number, hands: Hand[]): Song {
  const h = 0.5;
  const a: Ev[] = [[E4, 1, 3], [D4, 1, 2], [C4, 2, 1]];
  const rh: Ev[] = [...a, ...a, [C4, h, 1], [C4, h, 1], [C4, h, 1], [C4, h, 1], [D4, h, 2], [D4, h, 2], [D4, h, 2], [D4, h, 2], ...a];
  const lh: Ev[] = [[C3, 4, 1], [C3, 4, 1], [G2, 4, 3], [C3, 4, 1]];
  return fixedTempoSong({ title: 'Hot Cross Buns', bpm, key: 'C', notes: both(rh, lh, hands) });
}

export type Collection = 'cantigas' | 'classicos' | 'datas';

export const COLLECTIONS: { id: Collection; title: string; intro: string }[] = [
  { id: 'cantigas', title: 'Cantigas e infantis', intro: 'Melodias curtas e famosas. Boas para começar e para tocar e cantar junto com criança.' },
  { id: 'classicos', title: 'Clássicos', intro: 'Peças de compositores, em arranjo simples. Domínio público.' },
  { id: 'datas', title: 'Datas e festas', intro: 'Para tocar em aniversário e no Natal.' },
];

export interface BuiltinPiece {
  id: string;
  title: string;
  level: 1 | 2 | 3;
  bpm: number;
  why: string;
  collection: Collection;
  /** Serve para o perfil de criança (siga as cores). */
  kids?: boolean;
  build: (bpm: number, hands: Hand[]) => Song;
}

export const BUILTIN_PIECES: BuiltinPiece[] = [
  { id: 'hotcross', title: 'Hot Cross Buns', level: 1, bpm: 90, collection: 'cantigas', kids: true, why: 'Só três notas: Mi, Ré, Dó. A primeira música de muitos métodos.', build: hotCrossBuns },
  { id: 'mary', title: 'Mary Had a Little Lamb', level: 1, bpm: 100, collection: 'cantigas', kids: true, why: 'Quatro notas e frases que se repetem. Ótima para cantar junto.', build: maryLamb },
  { id: 'doremifa', title: 'Dó Ré Mi Fá', level: 1, bpm: 100, collection: 'cantigas', kids: true, why: 'Cantiga que ensina os nomes das notas enquanto toca.', build: doReMiFa },
  { id: 'frere', title: 'Frère Jacques (Frei Martinho)', level: 1, bpm: 100, collection: 'cantigas', kids: true, why: 'Cada frase vem duas vezes: fácil de decorar. Também dá para cantar em cânone.', build: frereJacques },
  { id: 'lobato', title: 'Seu Lobato (Old MacDonald)', level: 1, bpm: 110, collection: 'cantigas', kids: true, why: 'A mão desce até o Sol grave: primeiro movimento fora da posição.', build: seuLobato },
  { id: 'brilha', title: 'Brilha, Brilha, Estrelinha', level: 1, bpm: 100, collection: 'cantigas', kids: true, why: 'Melodia em notas iguais e baixo simples. A primeira peça com as duas mãos.', build: brilhaBrilha },
  { id: 'parabens', title: 'Parabéns pra Você', level: 1, bpm: 100, collection: 'datas', why: 'Compasso 3/4 e anacruse. Útil de verdade: você vai tocar em aniversários.', build: parabens },
  { id: 'ode', title: 'Ode à Alegria (Beethoven)', level: 1, bpm: 100, collection: 'classicos', kids: true, why: 'Posição fixa de cinco dedos e o primeiro ritmo pontuado.', build: odeAlegria },
  { id: 'jingle', title: 'Jingle Bells (refrão)', level: 2, bpm: 110, collection: 'datas', why: 'Melodia com baixo de Dó, Fá e Sol: o campo harmônico na prática.', build: jingleBells },
  { id: 'canon', title: 'Cânone em Ré (Pachelbel)', level: 2, bpm: 70, collection: 'classicos', why: 'A progressão mais famosa da música, em Ré maior com Fá♯ e Dó♯. Primeiro os acordes, depois a melodia.', build: canon },
  { id: 'elise', title: 'Für Elise, parte A (Beethoven)', level: 3, bpm: 70, collection: 'classicos', why: 'Semicolcheias, mãos alternadas e acidentes. O desafio clássico do iniciante.', build: furElise },
];

export const pieceById = (id: string) => BUILTIN_PIECES.find((p) => p.id === id);
