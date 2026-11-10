import { fixedTempoSong, type Song } from './song';
import {
  FIVE_FINGER_L, FIVE_FINGER_R, keySignature, scaleFingering, scaleNotes, triad, tonicName,
  type Hand, type Mode,
} from './theory';

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
}

export interface Module {
  id: string;
  title: string;
  intro: string;
}

export const MODULES: Module[] = [
  { id: 'A', title: 'Posição de cinco dedos', intro: 'Cada dedo em uma tecla, mão relaxada e curvada. Polegar é o dedo 1, mindinho o 5.' },
  { id: 'B', title: 'Escalas de Dó, Sol e Fá', intro: 'A passagem do polegar por baixo é o movimento que destrava as músicas. Devagar e sem trancos.' },
  { id: 'C', title: 'Acordes e inversões', intro: 'As tríades e suas inversões são a base de quase toda música pop. Aperte as 3 notas juntas.' },
  { id: 'D', title: 'Arpejos', intro: 'O acorde tocado nota por nota. Prepara a mão para os acompanhamentos.' },
  { id: 'E', title: 'Primeira progressão', intro: 'I–V–vi–IV: a sequência de acordes de centenas de músicas. Direita faz os acordes, esquerda o baixo.' },
];

const handName = (h: Hand[]) => (h.length === 2 ? 'mãos juntas' : h[0] === 'R' ? 'mão direita' : 'mão esquerda');
const RH_BASE = 60;
const LH_BASE = 48;
const baseFor = (tonic: number, hand: Hand) => (hand === 'R' ? RH_BASE : LH_BASE) + tonic - (tonic > 7 ? 12 : 0);

function fiveFinger(tonic: number, hands: Hand[]) {
  return (bpm: number) => {
    const notes: Parameters<typeof fixedTempoSong>[0]['notes'] = [];
    const steps = [0, 2, 4, 5, 7, 5, 4, 2, 0];
    hands.forEach((h) => {
      const b = baseFor(tonic, h);
      steps.forEach((s, i) => notes.push({ midi: b + s, beat: i, beats: i === steps.length - 1 ? 3 : 1, hand: h, finger: (h === 'R' ? FIVE_FINGER_R : FIVE_FINGER_L)[i] }));
    });
    return fixedTempoSong({ title: `Cinco dedos em ${tonicName(tonic, 'maior')}`, bpm, key: keySignature(tonic, 'maior'), notes });
  };
}

function scale(tonic: number, mode: Mode, hands: Hand[]) {
  return (bpm: number) => {
    const notes: Parameters<typeof fixedTempoSong>[0]['notes'] = [];
    hands.forEach((h) => {
      const up = scaleNotes(baseFor(tonic, h), mode, 1);
      const seq = [...up, ...up.slice(0, -1).reverse()];
      const fing = scaleFingering(tonic, mode, h);
      seq.forEach((m, i) => notes.push({ midi: m, beat: i, beats: i === seq.length - 1 ? 2 : 1, hand: h, finger: fing[i] }));
    });
    return fixedTempoSong({ title: `Escala de ${tonicName(tonic, mode)}`, bpm, key: keySignature(tonic, mode), notes });
  };
}

function inversions(tonic: number, mode: Mode, hands: Hand[]) {
  return (bpm: number) => {
    const notes: Parameters<typeof fixedTempoSong>[0]['notes'] = [];
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
    const notes: Parameters<typeof fixedTempoSong>[0]['notes'] = [];
    const degrees = [0, 3, 4, 0, 5, 1, 4, 0];
    degrees.forEach((d, i) => {
      if (hands.includes('R')) triad(baseFor(tonic, 'R'), 'maior', d).forEach((m, j) => notes.push({ midi: m, beat: i * 2, beats: 2, hand: 'R', finger: [1, 3, 5][j] }));
      if (hands.includes('L')) notes.push({ midi: triad(baseFor(tonic, 'L') - 12, 'maior', d)[0], beat: i * 2, beats: 2, hand: 'L' });
    });
    return fixedTempoSong({ title: `Acordes de ${tonicName(tonic, 'maior')}`, bpm, key: keySignature(tonic, 'maior'), notes });
  };
}

function arpeggio(tonic: number, mode: Mode, hands: Hand[]) {
  return (bpm: number) => {
    const notes: Parameters<typeof fixedTempoSong>[0]['notes'] = [];
    hands.forEach((h) => {
      const b = baseFor(tonic, h);
      const t = triad(b, mode, 0);
      const up = [...t, b + 12];
      const seq = [...up, ...up.slice(0, -1).reverse()];
      const f = h === 'R' ? [1, 2, 3, 5, 3, 2, 1] : [5, 4, 2, 1, 2, 4, 5];
      seq.forEach((m, i) => notes.push({ midi: m, beat: i, beats: i === seq.length - 1 ? 2 : 1, hand: h, finger: f[i] }));
    });
    return fixedTempoSong({ title: `Arpejo de ${tonicName(tonic, mode)}`, bpm, key: keySignature(tonic, mode), notes });
  };
}

/** I–V–vi–IV em Dó com condução de vozes; esquerda em baixo longo ou arpejo 1–5–8–5. */
function progression(pattern: 'baixo' | 'arpejo', hands: Hand[]) {
  return (bpm: number) => {
    const notes: Parameters<typeof fixedTempoSong>[0]['notes'] = [];
    // Vozes próximas: C(C E G) G(B D G) Am(C E A) F(C F A)
    const rh = [[60, 64, 67], [59, 62, 67], [60, 64, 69], [60, 65, 69]];
    const rhF = [[1, 3, 5], [1, 2, 5], [1, 2, 5], [1, 3, 5]];
    const bass = [48, 43, 45, 41];
    for (let rep = 0; rep < 2; rep++) {
      rh.forEach((ch, k) => {
        const beat = (rep * 4 + k) * 4;
        if (hands.includes('R')) ch.forEach((m, j) => notes.push({ midi: m, beat, beats: 4, hand: 'R', finger: rhF[k][j] }));
        if (hands.includes('L')) {
          if (pattern === 'baixo') notes.push({ midi: bass[k], beat, beats: 4, hand: 'L', finger: 5 });
          else [0, 7, 12, 7].forEach((s, i) => notes.push({ midi: bass[k] + s, beat: beat + i, beats: 1, hand: 'L', finger: [5, 2, 1, 2][i] }));
        }
      });
    }
    return fixedTempoSong({ title: 'Progressão I–V–vi–IV em Dó', bpm, key: 'C', notes });
  };
}

const L = (
  id: string, module: string, title: string, tip: string, hands: Hand[],
  build: (bpm: number) => Song, startBpm = 50, goalBpm = 60, goalAccuracy = 0.9,
): Lesson => ({ id, module, title, tip, hands, build, startBpm, goalBpm, goalAccuracy });

const R: Hand[] = ['R'];
const E: Hand[] = ['L'];
const J: Hand[] = ['R', 'L'];

export const LESSONS: Lesson[] = [
  L('a1', 'A', 'Cinco dedos em Dó — ' + handName(R), 'Polegar no Dó central. Cada dedo fica sobre a sua tecla o tempo todo.', R, fiveFinger(0, R)),
  L('a2', 'A', 'Cinco dedos em Dó — ' + handName(E), 'Mindinho no Dó uma oitava abaixo do central. Pulso solto, sem levantar o cotovelo.', E, fiveFinger(0, E)),
  L('a3', 'A', 'Cinco dedos em Dó — ' + handName(J), 'As duas mãos andam juntas, em espelho de dedos. Escute se as notas saem ao mesmo tempo.', J, fiveFinger(0, J)),
  L('a4', 'A', 'Cinco dedos em Sol — ' + handName(J), 'Mesma forma de mão, começando no Sol.', J, fiveFinger(7, J)),

  L('b1', 'B', 'Escala de Dó — ' + handName(R), 'Depois do dedo 3 no Mi, o polegar passa por baixo para o Fá. Na descida, o 3 passa por cima.', R, scale(0, 'maior', R)),
  L('b2', 'B', 'Escala de Dó — ' + handName(E), 'Subindo: 5-4-3-2-1 e o dedo 3 passa por cima para o Lá.', E, scale(0, 'maior', E)),
  L('b3', 'B', 'Escala de Sol — ' + handName(R), 'Igual à de Dó, mas o Fá vira Fá♯ (tecla preta).', R, scale(7, 'maior', R)),
  L('b4', 'B', 'Escala de Sol — ' + handName(E), 'Atenção ao Fá♯ perto do fim da subida.', E, scale(7, 'maior', E)),
  L('b5', 'B', 'Escala de Fá — ' + handName(R), 'Dedilhado diferente: 1-2-3-4 e o polegar passa depois do Si♭.', R, scale(5, 'maior', R)),
  L('b6', 'B', 'Escala de Fá — ' + handName(E), 'Mesmo dedilhado da esquerda em Dó; o Si♭ cai no dedo 4.', E, scale(5, 'maior', E)),
  L('b7', 'B', 'Escala de Dó — ' + handName(J), 'As passagens de polegar das duas mãos não acontecem ao mesmo tempo. Vá bem devagar.', J, scale(0, 'maior', J), 40, 60),

  L('c1', 'C', 'Inversões de Dó maior', 'Fundamental, 1ª e 2ª inversão. A mão muda de forma, não de lugar: deslize.', R, inversions(0, 'maior', R)),
  L('c2', 'C', 'Inversões de Lá menor', 'O mesmo movimento num acorde menor.', R, inversions(9, 'menor', R)),
  L('c3', 'C', 'Inversões de Sol maior', 'Acorde de Sol: Sol, Si, Ré.', R, inversions(7, 'maior', R)),
  L('c4', 'C', 'Acordes de Dó com baixo', 'I–IV–V–I–vi–ii–V–I: os acordes do tom de Dó, com o baixo na esquerda.', J, chordsOfKey(0, J), 50, 70),

  L('d1', 'D', 'Arpejo de Dó — ' + handName(R), 'Dedos 1-2-3-5. Abra a mão sem esticar demais.', R, arpeggio(0, 'maior', R), 50, 70),
  L('d2', 'D', 'Arpejo de Dó — ' + handName(E), 'Dedos 5-4-2-1.', E, arpeggio(0, 'maior', E), 50, 70),
  L('d3', 'D', 'Arpejo de Sol — ' + handName(J), 'As duas mãos juntas, oitava de distância.', J, arpeggio(7, 'maior', J), 50, 70),

  L('e1', 'E', 'Progressão com baixo', 'Direita: acordes. Esquerda: uma nota longa por compasso. Troque de acorde sem parar o tempo.', J, progression('baixo', J), 60, 72),
  L('e2', 'E', 'Progressão com arpejo na esquerda', 'Esquerda faz 1–5–8–5 enquanto a direita segura o acorde. É o acompanhamento de muitas baladas.', J, progression('arpejo', J), 50, 66),
];

export const lessonById = (id: string) => LESSONS.find((l) => l.id === id);
