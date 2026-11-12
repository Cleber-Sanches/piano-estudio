import { brilhaBrilha, canon, furElise, jingleBells, minueto, odeAlegria, parabens, preludio } from './pieces';
import { fixedTempoSong, type Song } from './song';
import {
  CHROMATIC_L, CHROMATIC_R, FIVE_FINGER_L, FIVE_FINGER_R, keySignature, scaleFingering, scaleNotes, SEVENTH_DEGREES,
  seventhChord, SCALE, triad, tonicName, type Hand, type Mode, type Seventh,
} from './theory';

// Exercícios técnicos e peças da trilha. Cada nível da trilha é um "módulo" (N1…N12) com teste de nivelamento.

export interface Lesson {
  id: string;
  module: string;
  title: string;
  /** O que fazer e no que prestar atenção. */
  tip: string;
  hands: Hand[];
  /** BPM de partida e BPM para concluir. */
  startBpm: number;
  goalBpm: number;
  /** Precisão mínima (0–1) no modo tempo para concluir. */
  goalAccuracy: number;
  build: (bpm: number) => Song;
  /** Peça (música) em vez de exercício. */
  kind?: 'peca';
}

export interface Module {
  id: string;
  title: string;
  intro: string;
  /** Lição usada no teste do módulo (nivelamento). */
  testId: string;
}

type NoteIn = Parameters<typeof fixedTempoSong>[0]['notes'][number];

const handName = (h: Hand[]) => (h.length === 2 ? 'mãos juntas' : h[0] === 'R' ? 'mão direita' : 'mão esquerda');
const RH_BASE = 60;
const LH_BASE = 48;
const baseFor = (tonic: number, hand: Hand) => (hand === 'R' ? RH_BASE : LH_BASE) + tonic - (tonic > 7 ? 12 : 0);
/** Transposição curta (para cima até o Fá♯, para baixo a partir do Sol). */
const shiftFor = (tonic: number) => (tonic > 6 ? tonic - 12 : tonic);

function fiveFinger(tonic: number, hands: Hand[]) {
  return (bpm: number) => {
    const notes: NoteIn[] = [];
    const steps = [0, 2, 4, 5, 7, 5, 4, 2, 0];
    hands.forEach((h) => {
      const b = baseFor(tonic, h);
      steps.forEach((s, i) => notes.push({ midi: b + s, beat: i, beats: i === steps.length - 1 ? 3 : 1, hand: h, finger: (h === 'R' ? FIVE_FINGER_R : FIVE_FINGER_L)[i] }));
    });
    return fixedTempoSong({ title: `Cinco dedos em ${tonicName(tonic, 'maior')}`, bpm, key: keySignature(tonic, 'maior'), notes });
  };
}

/** Movimento contrário: direita sobe do Dó central, esquerda desce do Dó grave, mesmos dedos. */
function contrary() {
  return (bpm: number) => {
    const notes: NoteIn[] = [];
    const up = [0, 2, 4, 5, 7, 5, 4, 2, 0];
    const down = [0, -1, -3, -5, -7, -5, -3, -1, 0];
    const f = [1, 2, 3, 4, 5, 4, 3, 2, 1];
    up.forEach((s, i) => notes.push({ midi: 60 + s, beat: i, beats: i === 8 ? 3 : 1, hand: 'R', finger: f[i] }));
    down.forEach((s, i) => notes.push({ midi: 48 + s, beat: i, beats: i === 8 ? 3 : 1, hand: 'L', finger: f[i] }));
    return fixedTempoSong({ title: 'Movimento contrário em Dó', bpm, key: 'C', notes });
  };
}

/** Independência: direita em semínimas (melodia de 5 dedos), esquerda em mínimas (tônica e quinta). */
function independence(tonic: number) {
  return (bpm: number) => {
    const notes: NoteIn[] = [];
    const rh = [0, 2, 4, 2, 0, 4, 7, 4, 5, 4, 2, 4, 0, 2, 0, 0];
    const rf = [1, 2, 3, 2, 1, 3, 5, 3, 4, 3, 2, 3, 1, 2, 1, 1];
    const b = baseFor(tonic, 'R');
    rh.forEach((s, i) => { if (i < 15) notes.push({ midi: b + s, beat: i, beats: i === 14 ? 2 : 1, hand: 'R', finger: rf[i] }); });
    const l = baseFor(tonic, 'L');
    [[l, 5], [l + 7, 1], [l, 5], [l + 7, 1], [l + 5, 2], [l + 7, 1], [l + 7, 1], [l, 5]].forEach(([m, f], i) => {
      notes.push({ midi: m, beat: i * 2, beats: 2, hand: 'L', finger: f });
    });
    return fixedTempoSong({ title: `Mãos independentes em ${tonicName(tonic, 'maior')}`, bpm, key: keySignature(tonic, 'maior'), notes });
  };
}

function scale(tonic: number, mode: Mode, hands: Hand[], octaves = 1) {
  return (bpm: number) => {
    const notes: NoteIn[] = [];
    // em 2 oitavas, colcheias (2 notas por tempo)
    const step = octaves === 2 ? 0.5 : 1;
    hands.forEach((h) => {
      const base = baseFor(tonic, h) - (octaves === 2 && h === 'L' ? 12 : 0);
      const up = scaleNotes(base, mode, octaves);
      const seq = [...up, ...up.slice(0, -1).reverse()];
      const fing = scaleFingering(tonic, mode, h, octaves);
      seq.forEach((m, i) => notes.push({ midi: m, beat: i * step, beats: i === seq.length - 1 ? 2 : step, hand: h, finger: fing[i] }));
    });
    const title = `Escala de ${tonicName(tonic, mode)}` + (octaves === 2 ? ' em 2 oitavas' : '');
    return fixedTempoSong({ title, bpm, key: keySignature(tonic, mode), notes });
  };
}

function chromatic(hand: Hand) {
  return (bpm: number) => {
    const base = hand === 'R' ? 60 : 48;
    const f = hand === 'R' ? CHROMATIC_R : CHROMATIC_L;
    const up = Array.from({ length: 13 }, (_, i) => base + i);
    const seq = [...up, ...up.slice(0, -1).reverse()];
    const fing = [...f, ...f.slice(0, -1).reverse()];
    const notes: NoteIn[] = seq.map((m, i) => ({ midi: m, beat: i * 0.5, beats: i === seq.length - 1 ? 4 : 0.5, hand, finger: fing[i] }));
    return fixedTempoSong({ title: 'Escala cromática', bpm, key: 'C', notes });
  };
}

/** Oitavas pela escala de Dó: polegar e mindinho firmes, pulso solto. */
function octaves(hands: Hand[]) {
  return (bpm: number) => {
    const notes: NoteIn[] = [];
    hands.forEach((h) => {
      const up = scaleNotes(h === 'R' ? 60 : 36, 'maior', 1);
      const seq = [...up, ...up.slice(0, -1).reverse()];
      seq.forEach((m, i) => [m, m + 12].forEach((k, j) => notes.push({ midi: k, beat: i, beats: i === seq.length - 1 ? 2 : 1, hand: h, finger: h === 'R' ? [1, 5][j] : [5, 1][j] })));
    });
    return fixedTempoSong({ title: 'Oitavas na escala de Dó', bpm, key: 'C', notes });
  };
}

/** Tríades sobre cada grau da escala, subindo e descendo. */
function triadsUp(tonic: number) {
  return (bpm: number) => {
    const notes: NoteIn[] = [];
    const order = [0, 1, 2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 1, 0];
    const b = baseFor(tonic, 'R');
    order.forEach((d, i) => triad(b, 'maior', d).forEach((m, j) => notes.push({ midi: m, beat: i, beats: i === order.length - 1 ? 2 : 1, hand: 'R', finger: [1, 3, 5][j] })));
    return fixedTempoSong({ title: `Tríades da escala de ${tonicName(tonic, 'maior')}`, bpm, key: keySignature(tonic, 'maior'), notes });
  };
}

function inversions(tonic: number, mode: Mode, hands: Hand[]) {
  return (bpm: number) => {
    const notes: NoteIn[] = [];
    const [a, b, c] = triad(baseFor(tonic, 'R'), mode, 0);
    const inv = [[a, b, c], [b, c, a + 12], [c, a + 12, b + 12], [a + 12, b + 12, c + 12]];
    const fing = [[1, 3, 5], [1, 2, 5], [1, 3, 5], [1, 3, 5]];
    const order = [0, 1, 2, 3, 2, 1, 0];
    order.forEach((k, i) => {
      if (hands.includes('R')) inv[k].forEach((m, j) => notes.push({ midi: m, beat: i * 2, beats: 2, hand: 'R', finger: fing[k][j] }));
      if (hands.includes('L')) notes.push({ midi: baseFor(tonic, 'L'), beat: i * 2, beats: 2, hand: 'L', finger: 5 });
    });
    return fixedTempoSong({ title: `Inversões de ${tonicName(tonic, mode)}`, bpm, key: keySignature(tonic, mode), notes });
  };
}

function chordsOfKey(tonic: number, hands: Hand[]) {
  return (bpm: number) => {
    const notes: NoteIn[] = [];
    const degrees = [0, 3, 4, 0, 5, 1, 4, 0];
    degrees.forEach((d, i) => {
      if (hands.includes('R')) triad(baseFor(tonic, 'R'), 'maior', d).forEach((m, j) => notes.push({ midi: m, beat: i * 2, beats: 2, hand: 'R', finger: [1, 3, 5][j] }));
      if (hands.includes('L')) notes.push({ midi: triad(baseFor(tonic, 'L') - 12, 'maior', d)[0], beat: i * 2, beats: 2, hand: 'L' });
    });
    return fixedTempoSong({ title: `Acordes de ${tonicName(tonic, 'maior')}`, bpm, key: keySignature(tonic, 'maior'), notes });
  };
}

function arpeggio(tonic: number, mode: Mode, hands: Hand[], oct = 1) {
  return (bpm: number) => {
    const notes: NoteIn[] = [];
    const step = oct === 2 ? 0.5 : 1;
    hands.forEach((h) => {
      const b = baseFor(tonic, h) - (oct === 2 && h === 'L' ? 12 : 0);
      const t = triad(b, mode, 0);
      const up = oct === 2 ? [...t, ...t.map((m) => m + 12), b + 24] : [...t, b + 12];
      const seq = [...up, ...up.slice(0, -1).reverse()];
      const fUp = oct === 2 ? (h === 'R' ? [1, 2, 3, 1, 2, 3, 5] : [5, 4, 2, 1, 4, 2, 1]) : (h === 'R' ? [1, 2, 3, 5] : [5, 4, 2, 1]);
      const f = [...fUp, ...fUp.slice(0, -1).reverse()];
      seq.forEach((m, i) => notes.push({ midi: m, beat: i * step, beats: i === seq.length - 1 ? 2 : step, hand: h, finger: f[i] }));
    });
    return fixedTempoSong({ title: `Arpejo de ${tonicName(tonic, mode)}` + (oct === 2 ? ' em 2 oitavas' : ''), bpm, key: keySignature(tonic, mode), notes });
  };
}

/**
 * I–V–vi–IV com condução de vozes, transposta para `tonic`.
 * Esquerda: baixo longo, arpejo 1–5–8–5 ou baixo de Alberti (direita vira melodia em acordes).
 */
function progression(pattern: 'baixo' | 'arpejo' | 'alberti', tonic = 0) {
  return (bpm: number) => {
    const t = shiftFor(tonic);
    const notes: NoteIn[] = [];
    const rh = [[60, 64, 67], [59, 62, 67], [60, 64, 69], [60, 65, 69]];
    const rhF = [[1, 3, 5], [1, 2, 5], [1, 2, 5], [1, 3, 5]];
    const bass = [48, 43, 45, 41];
    // Alberti: tríade da esquerda em posição fechada (baixo-topo-meio-topo)
    const lhTriads = [[48, 52, 55], [47, 50, 55], [48, 52, 57], [48, 53, 57]];
    for (let rep = 0; rep < 2; rep++) {
      rh.forEach((ch, k) => {
        const beat = (rep * 4 + k) * 4;
        ch.forEach((m, j) => notes.push({ midi: m + t + (pattern === 'alberti' ? 12 : 0), beat, beats: 4, hand: 'R', finger: rhF[k][j] }));
        if (pattern === 'baixo') notes.push({ midi: bass[k] + t, beat, beats: 4, hand: 'L', finger: 5 });
        else if (pattern === 'arpejo') [0, 7, 12, 7].forEach((s, i) => notes.push({ midi: bass[k] + s + t, beat: beat + i, beats: 1, hand: 'L', finger: [5, 2, 1, 2][i] }));
        else {
          const [lo, mid, hi] = lhTriads[k];
          [lo, hi, mid, hi, lo, hi, mid, hi].forEach((m, i) => notes.push({ midi: m + t, beat: beat + i * 0.5, beats: 0.5, hand: 'L', finger: [5, 1, 3, 1][i % 4] }));
        }
      });
    }
    const name = { baixo: 'com baixo', arpejo: 'com arpejo', alberti: 'com baixo de Alberti' }[pattern];
    return fixedTempoSong({ title: `I–V–vi–IV em ${tonicName(tonic, 'maior').replace(' maior', '')} ${name}`, bpm, key: keySignature(tonic, 'maior'), notes });
  };
}

/** Valsa: I–IV–V7–I em 3/4, baixo no tempo 1 e acorde nos tempos 2 e 3. */
function waltz(tonic: number) {
  return (bpm: number) => {
    const t = shiftFor(tonic);
    const notes: NoteIn[] = [];
    const bars: Array<[number, number[], number[]]> = [
      [48, [64, 67, 72], [55, 60, 64]], [41, [65, 69, 72], [57, 60, 65]], [43, [62, 67, 71], [55, 59, 65]], [48, [64, 67, 72], [55, 60, 64]],
      [45, [64, 69, 72], [57, 60, 64]], [41, [65, 69, 72], [57, 60, 65]], [43, [62, 65, 71], [55, 59, 65]], [48, [60, 64, 72], [55, 60, 64]],
    ];
    bars.forEach(([b, mel, ch], i) => {
      const beat = i * 3;
      notes.push({ midi: b + t, beat, beats: 1, hand: 'L', finger: 5 });
      [1, 2].forEach((k) => ch.forEach((m, j) => notes.push({ midi: m + t, beat: beat + k, beats: 1, hand: 'L', finger: [3, 2, 1][j] })));
      notes.push({ midi: mel[2] + t, beat, beats: 2, hand: 'R', finger: 5 }, { midi: mel[1] + t, beat: beat + 2, beats: 1, hand: 'R', finger: 3 });
    });
    return fixedTempoSong({ title: `Valsa em ${tonicName(tonic, 'maior')}`, bpm, timeSig: [3, 4], key: keySignature(tonic, 'maior'), notes });
  };
}

/** Tétrades (acordes de sétima) sobre cada grau da escala maior. */
function seventhsOfKey(tonic: number) {
  return (bpm: number) => {
    const notes: NoteIn[] = [];
    const b = baseFor(tonic, 'R');
    const sc = SCALE.maior;
    const order = [0, 1, 2, 3, 4, 5, 6, 7];
    order.forEach((d, i) => {
      const root = b + sc[d % 7] + (d >= 7 ? 12 : 0);
      seventhChord(root, SEVENTH_DEGREES[d % 7]).forEach((m, j) => notes.push({ midi: m, beat: i * 2, beats: 2, hand: 'R', finger: [1, 2, 3, 5][j] }));
      notes.push({ midi: root - 12 - (root - 12 > 55 ? 12 : 0), beat: i * 2, beats: 2, hand: 'L', finger: 5 });
    });
    return fixedTempoSong({ title: `Acordes com sétima em ${tonicName(tonic, 'maior')}`, bpm, key: keySignature(tonic, 'maior'), notes });
  };
}

/** ii–V–I com condução de vozes (3 vozes na direita), duas vezes, terminando no I com 7ª maior. */
function twoFiveOne(tonic: number) {
  return (bpm: number) => {
    const t = shiftFor(tonic);
    const notes: NoteIn[] = [];
    // Dm7 (F A C) → G7 (F G B) → Cmaj7 (E G B): só uma ou duas vozes mexem
    const rh = [[65, 69, 72], [65, 67, 71], [64, 67, 71], [64, 67, 71]];
    const rf = [[1, 3, 5], [1, 2, 4], [1, 2, 4], [1, 2, 4]];
    const bass = [50, 43, 48, 48];
    for (let rep = 0; rep < 2; rep++) {
      rh.forEach((ch, k) => {
        const beat = (rep * 4 + k) * 4;
        ch.forEach((m, j) => notes.push({ midi: m + t, beat, beats: 4, hand: 'R', finger: rf[k][j] }));
        notes.push({ midi: bass[k] + t, beat, beats: 4, hand: 'L', finger: 5 });
      });
    }
    return fixedTempoSong({ title: `ii–V–I em ${tonicName(tonic, 'maior')}`, bpm, key: keySignature(tonic, 'maior'), notes });
  };
}

/** Blues de 12 compassos em Dó: esquerda em boogie (1–5–6–5), direita com as notas-guia (3ª e 7ª). */
function blues() {
  return (bpm: number) => {
    const notes: NoteIn[] = [];
    const roots = [48, 48, 48, 48, 53, 53, 48, 48, 43, 53, 48, 43];
    const guide: Record<number, number[]> = { 48: [64, 70], 53: [63, 69], 43: [65, 71] };
    roots.forEach((r, i) => {
      const beat = i * 4;
      [0, 7, 9, 7].forEach((s, k) => notes.push({ midi: r + s, beat: beat + k, beats: 1, hand: 'L', finger: [5, 2, 1, 2][k] }));
      guide[r].forEach((m, j) => notes.push({ midi: m, beat, beats: 4, hand: 'R', finger: [1, 4][j] }));
    });
    return fixedTempoSong({ title: 'Blues de 12 compassos em Dó', bpm, key: 'C', notes });
  };
}

const L = (
  id: string, module: string, title: string, tip: string, hands: Hand[],
  build: (bpm: number) => Song, startBpm = 50, goalBpm = 60, goalAccuracy = 0.9,
): Lesson => ({ id, module, title, tip, hands, build, startBpm, goalBpm, goalAccuracy });

const R: Hand[] = ['R'];
const E: Hand[] = ['L'];
const J: Hand[] = ['R', 'L'];
const P = (id: string, module: string, title: string, tip: string, build: (bpm: number, h: Hand[]) => Song, startBpm: number, goalBpm: number): Lesson =>
  ({ id, module, title, tip, hands: J, build: (bpm) => build(bpm, J), startBpm, goalBpm, goalAccuracy: 0.9, kind: 'peca' });

const sc = (id: string, mod: string, tonic: number, mode: Mode, hands: Hand[], tip: string, oct = 1, start = 50, goal = 66) =>
  L(id, mod, `Escala de ${tonicName(tonic, mode)}${oct === 2 ? ' em 2 oitavas' : ''} — ${handName(hands)}`, tip, hands, scale(tonic, mode, hands, oct), start, goal);

export const LESSONS: Lesson[] = [
  // ---------- Fase 1 · Fundamentos ----------
  L('1a', 'N1', 'Cinco dedos em Dó — ' + handName(R), 'Polegar no Dó central. Cada dedo fica sobre a sua tecla o tempo todo.', R, fiveFinger(0, R)),
  L('1b', 'N1', 'Cinco dedos em Dó — ' + handName(E), 'Mindinho no Dó uma oitava abaixo do central. Pulso solto, sem levantar o cotovelo.', E, fiveFinger(0, E)),
  L('1c', 'N1', 'Cinco dedos em Dó — ' + handName(J), 'As duas mãos andam juntas, em espelho de dedos. Escute se as notas saem ao mesmo tempo.', J, fiveFinger(0, J)),
  P('1p', 'N1', 'Peça: Brilha, Brilha, Estrelinha', 'Sua primeira peça com as duas mãos. Treine a direita sozinha, depois a esquerda, e só então junte.', brilhaBrilha, 60, 84),

  L('2a', 'N2', 'Movimento contrário', 'As mãos se afastam e voltam, com os mesmos dedos ao mesmo tempo. O cérebro gosta de espelho.', J, contrary()),
  L('2b', 'N2', 'Cinco dedos em Sol — ' + handName(J), 'Mesma forma de mão, começando no Sol.', J, fiveFinger(7, J)),
  L('2c', 'N2', 'Cinco dedos em Ré — ' + handName(J), 'Primeira tecla preta: o Fá♯ cai no dedo 3. A mão avança um pouco para dentro do teclado.', J, fiveFinger(2, J)),
  L('2d', 'N2', 'Mãos independentes', 'Direita anda em semínimas, esquerda segura mínimas. Conte “1-2” em voz alta: é a primeira vez que as mãos fazem coisas diferentes.', J, independence(0), 50, 66),
  P('2p', 'N2', 'Peça: Ode à Alegria', 'Melodia de Beethoven na posição de Dó. Atenção à semínima pontuada no fim das frases: segure o Mi um pouco mais.', odeAlegria, 60, 84),

  sc('3a', 'N3', 0, 'maior', R, 'Depois do dedo 3 no Mi, o polegar passa por baixo para o Fá. Na descida, o 3 passa por cima.'),
  sc('3b', 'N3', 0, 'maior', E, 'Subindo: 5-4-3-2-1 e o dedo 3 passa por cima para o Lá.'),
  sc('3c', 'N3', 0, 'maior', J, 'As passagens de polegar das duas mãos não acontecem ao mesmo tempo. Vá bem devagar.', 1, 40, 60),
  sc('3d', 'N3', 7, 'maior', J, 'Igual à de Dó, mas o Fá vira Fá♯ (tecla preta).', 1, 40, 60),
  sc('3e', 'N3', 5, 'maior', R, 'Dedilhado diferente: 1-2-3-4 e o polegar passa depois do Si♭.'),
  sc('3f', 'N3', 5, 'maior', E, 'Mesmo dedilhado da esquerda em Dó; o Si♭ cai no dedo 4.'),
  P('3p', 'N3', 'Peça: Jingle Bells', 'A esquerda faz o baixo de cada acorde (Dó, Fá, Sol) enquanto a direita canta a melodia. Repare no ritmo pontuado do “Dó. Ré”.', jingleBells, 60, 96),

  // ---------- Fase 2 · Base sólida ----------
  L('4a', 'N4', 'Tríades da escala de Dó', 'Uma tríade em cada grau: Dó, Ré menor, Mi menor, Fá, Sol, Lá menor, Si diminuto. Ouça a cor de cada uma.', R, triadsUp(0), 50, 72),
  L('4b', 'N4', 'Inversões de Dó maior', 'Fundamental, 1ª e 2ª inversão. A mão muda de forma, não de lugar: deslize.', R, inversions(0, 'maior', R)),
  L('4c', 'N4', 'Inversões de Lá menor', 'O mesmo movimento num acorde menor.', R, inversions(9, 'menor', R)),
  L('4d', 'N4', 'Inversões de Sol maior', 'Acorde de Sol: Sol, Si, Ré.', R, inversions(7, 'maior', R)),
  L('4e', 'N4', 'Acordes de Dó com baixo', 'I–IV–V–I–vi–ii–V–I: os acordes do tom de Dó, com o baixo na esquerda.', J, chordsOfKey(0, J), 50, 70),
  P('4p', 'N4', 'Peça: Parabéns pra Você', 'Compasso de 3 tempos e a anacruse (a música começa antes do “1”). Útil de verdade: você vai tocar em aniversários.', parabens, 60, 100),

  L('5a', 'N5', 'Arpejo de Dó — ' + handName(R), 'Dedos 1-2-3-5. Abra a mão sem esticar demais.', R, arpeggio(0, 'maior', R), 50, 70),
  L('5b', 'N5', 'Arpejo de Dó — ' + handName(E), 'Dedos 5-4-2-1.', E, arpeggio(0, 'maior', E), 50, 70),
  L('5c', 'N5', 'Arpejo de Sol — ' + handName(J), 'As duas mãos juntas, oitava de distância.', J, arpeggio(7, 'maior', J), 50, 70),
  L('5d', 'N5', 'Progressão do pop com baixo', 'Direita: acordes. Esquerda: uma nota longa por compasso. Troque de acorde sem parar o tempo.', J, progression('baixo'), 60, 72),
  L('5e', 'N5', 'Progressão do pop com arpejo', 'Esquerda faz 1–5–8–5 enquanto a direita segura o acorde. É o acompanhamento de muitas baladas.', J, progression('arpejo'), 50, 66),
  L('5f', 'N5', 'Progressão do pop em Sol', 'O mesmo desenho, em outro tom. Tocar por cifra é isso: a forma da mão viaja.', J, progression('arpejo', 7), 50, 66),
  P('5p', 'N5', 'Peça: Cânone em Ré', 'Primeiro só os acordes, depois a melodia por cima do mesmo baixo. Ré maior tem Fá♯ e Dó♯.', canon, 50, 70),

  sc('6a', 'N6', 9, 'menor', J, 'Lá menor harmônica: igual a Dó, mas com Sol♯. É o Sol♯ que dá o clima “oriental”.', 1, 40, 60),
  sc('6b', 'N6', 4, 'menor', J, 'Mi menor harmônica: Fá♯ e Ré♯.', 1, 40, 60),
  sc('6c', 'N6', 2, 'menor', J, 'Ré menor harmônica: Si♭ e Dó♯.', 1, 40, 60),
  L('6d', 'N6', 'Arpejo de Lá menor — ' + handName(J), 'Lá, Dó, Mi. O mesmo desenho do arpejo maior, outra cor.', J, arpeggio(9, 'menor', J), 50, 72),
  P('6p', 'N6', 'Peça: Für Elise, parte A', 'Semicolcheias em 3/8: comece bem devagar no modo espera. As duas mãos se revezam, quase nunca tocam juntas.', furElise, 30, 50),

  // ---------- Fase 3 · Intermediário ----------
  sc('7a', 'N7', 2, 'maior', J, 'Ré maior: Fá♯ e Dó♯. Mesmo dedilhado de Dó.', 1, 50, 72),
  sc('7b', 'N7', 9, 'maior', J, 'Lá maior: três sustenidos. Mesmo dedilhado de Dó.', 1, 50, 72),
  sc('7c', 'N7', 4, 'maior', J, 'Mi maior: quatro sustenidos. A mão fica mais para dentro das pretas.', 1, 50, 72),
  L('7g', 'N7', 'Baixo de Alberti', 'Esquerda: baixo–topo–meio–topo em colcheias, como em Mozart e Clementi. A direita segura os acordes; depois troque por uma melodia sua.', J, progression('alberti'), 50, 72),
  sc('7d', 'N7', 10, 'maior', J, 'Si♭ maior: a direita começa com o dedo 4; a esquerda com o 3. Polegar sempre nas brancas.', 1, 50, 72),
  sc('7e', 'N7', 3, 'maior', J, 'Mi♭ maior: direita começa com 3, esquerda com 3. Pense em grupos de dedos, não em notas.', 1, 50, 72),
  sc('7f', 'N7', 0, 'maior', J, 'Duas oitavas em colcheias. O polegar passa de novo no meio: mantenha o cotovelo leve, sem pular.', 2, 50, 72),
  P('7p', 'N7', 'Peça: Minueto em Sol (Petzold)', 'Barroco: notas destacadas e leves, sem pedal. A direita sai da posição; siga os dedos marcados.', minueto, 60, 100),

  L('8a', 'N8', 'Acordes com sétima em Dó', 'Cmaj7, Dm7, Em7, Fmaj7, G7, Am7, Bm7♭5: as cores do jazz, do samba e da bossa.', J, seventhsOfKey(0), 50, 66),
  L('8b', 'N8', 'ii–V–I em Dó', 'Dm7 → G7 → Cmaj7. Repare: quase nenhuma nota da direita se mexe. É assim que pianista troca de acorde.', J, twoFiveOne(0), 50, 72),
  L('8c', 'N8', 'ii–V–I em Fá', 'Gm7 → C7 → Fmaj7. O mesmo desenho, transposto.', J, twoFiveOne(5), 50, 72),
  L('8d', 'N8', 'ii–V–I em Sol', 'Am7 → D7 → Gmaj7.', J, twoFiveOne(7), 50, 72),
  L('8e', 'N8', 'Blues de 12 compassos', 'Esquerda em boogie (1–5–6–5), direita com 3ª e 7ª de cada acorde. Depois, troque a direita por improviso.', J, blues(), 60, 92),
  P('8p', 'N8', 'Peça: Prelúdio em Dó (Bach)', 'Cada compasso é um acorde quebrado. Antes de tocar, aperte o acorde inteiro para sentir a forma. Use o pedal a cada meio compasso.', preludio, 40, 66),

  L('9a', 'N9', 'Escala cromática — ' + handName(R), 'Todas as 12 notas. Dedo 3 nas pretas, 1 nas brancas, 2 no Fá e no Dó.', R, chromatic('R'), 50, 72),
  L('9b', 'N9', 'Escala cromática — ' + handName(E), 'Dedo 3 nas pretas, 1 nas brancas, 2 no Mi e no Si.', E, chromatic('L'), 50, 72),
  sc('9c', 'N9', 7, 'maior', J, 'Sol maior em 2 oitavas. Meta de velocidade: colcheias a 80.', 2, 50, 80),
  sc('9d', 'N9', 8, 'maior', J, 'Lá♭ maior: direita começa com 3-4, esquerda com 3. Polegares nas brancas (Dó e Fá).', 1, 50, 80),
  sc('9e', 'N9', 1, 'maior', J, 'Ré♭ maior: polegar só no Fá e no Dó. A mão quase não sai das pretas.', 1, 50, 80),
  sc('9f', 'N9', 11, 'maior', J, 'Si maior: direita igual a Dó; esquerda começa com o dedo 4.', 1, 50, 80),
  sc('9g', 'N9', 6, 'maior', J, 'Fá♯ maior: seis sustenidos. Polegares no Si e no Mi♯ (Fá).', 1, 50, 80),
  L('9h', 'N9', 'Arpejo de Dó em 2 oitavas — ' + handName(J), 'O polegar passa por baixo depois do dedo 3. Movimento de braço, não de dedo esticado.', J, arpeggio(0, 'maior', J, 2), 50, 80),
  L('9i', 'N9', 'Oitavas — ' + handName(J), 'Polegar e mindinho firmes, a mão “congela” na forma e o pulso faz o trabalho.', J, octaves(J), 50, 80),

  // ---------- Fase 4 · Avançado ----------
  L('10a', 'N10', 'Arpejo de Lá menor em 2 oitavas — ' + handName(J), 'Base para o Noturno e para Chopin: arpejo largo, mão solta, som redondo.', J, arpeggio(9, 'menor', J, 2), 50, 84),
  sc('10b', 'N10', 9, 'menor', J, 'Lá menor em 2 oitavas, colcheias. Faça crescendo na subida e diminuendo na descida.', 2, 60, 92),

  L('11a', 'N11', 'Valsa em Fá', 'Baixo no 1, acorde no 2 e no 3: “um-pá-pá”. O acompanhamento de valsas, serestas e muita MPB.', J, waltz(5), 60, 108),
  L('11b', 'N11', 'Balada em Ré', 'I–V–vi–IV com arpejo, em Ré. Toque cantando a melodia de qualquer música pop por cima.', J, progression('arpejo', 2), 60, 80),
  L('11c', 'N11', 'Alberti em Sol', 'Baixo de Alberti em outro tom. A partir daqui, qualquer cifra vira acompanhamento.', J, progression('alberti', 7), 60, 88),
];

export const lessonById = (id: string) => LESSONS.find((l) => l.id === id);

/** Um módulo por nível; o teste usa a lição técnica mais difícil do nível. */
export const MODULES: Module[] = [
  { id: 'N1', title: 'Primeiros passos', intro: 'Posição de cinco dedos em Dó.', testId: '1c' },
  { id: 'N2', title: 'Mãos independentes', intro: 'Movimento contrário, Sol, Ré e mãos com ritmos diferentes.', testId: '2d' },
  { id: 'N3', title: 'Escalas e polegar', intro: 'Escalas de Dó, Sol e Fá.', testId: '3c' },
  { id: 'N4', title: 'Acordes', intro: 'Tríades, inversões e acordes do tom.', testId: '4e' },
  { id: 'N5', title: 'Tocar por cifra', intro: 'Arpejos e a progressão do pop.', testId: '5e' },
  { id: 'N6', title: 'Menores', intro: 'Escalas menores harmônicas e arpejo menor.', testId: '6c' },
  { id: 'N7', title: 'Todas as tonalidades', intro: 'Escalas com sustenidos e bemóis e o baixo de Alberti.', testId: '7f' },
  { id: 'N8', title: 'Harmonia', intro: 'Sétimas, ii–V–I e blues.', testId: '8d' },
  { id: 'N9', title: 'Técnica de concerto', intro: 'Cromática, 2 oitavas, arpejos largos e oitavas.', testId: '9h' },
  { id: 'N10', title: 'Expressão', intro: 'Arpejos e escalas menores em 2 oitavas.', testId: '10b' },
  { id: 'N11', title: 'Tocar o que quiser', intro: 'Estilos de acompanhamento em vários tons.', testId: '11c' },
];

export type { Seventh };
