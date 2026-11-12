import { lessonById } from './lessons';
import type { Store } from './progress';

// Trilha do adulto: níveis → unidades → missões.
// Inspirada nos métodos que funcionam (Faber, Piano Marvel, Simply Piano): cada unidade gira em torno
// de uma música e mistura técnica, leitura, ouvido e criação, em blocos curtos.

export type Pillar = 'repertorio' | 'tecnica' | 'leitura' | 'ouvido' | 'criar';

export const PILLARS: { id: Pillar; title: string; hint: string }[] = [
  { id: 'repertorio', title: 'Repertório', hint: 'Músicas que você toca inteiras, no tempo real.' },
  { id: 'tecnica', title: 'Técnica', hint: 'Escalas, acordes e arpejos: o que deixa a mão livre.' },
  { id: 'leitura', title: 'Leitura', hint: 'Ler partitura sem contar linhas.' },
  { id: 'ouvido', title: 'Ouvido', hint: 'Ouvir e repetir: a base para tirar música de ouvido.' },
  { id: 'criar', title: 'Criar', hint: 'Improvisar e acompanhar: tocar o que quiser.' },
];

export type Mission =
  | { kind: 'licao'; id: string; pillar: Pillar }
  | { kind: 'leitura'; level: number; title: string }
  | { kind: 'jogo'; id: string; title: string; detail: string; pillar: Pillar };

export interface Unit {
  title: string;
  goal: string;
  missions: Mission[];
}

export interface Level {
  n: number;
  title: string;
  intro: string;
  units: Unit[];
}

const lic = (id: string, pillar: Pillar = 'tecnica'): Mission => ({ kind: 'licao', id, pillar });
const ler = (level: number, title: string): Mission => ({ kind: 'leitura', level, title });
const jogo = (id: string, pillar: Pillar): Mission => ({ kind: 'jogo', id, title: GAMES[id].title, detail: GAMES[id].detail, pillar });

/** Jogos de ouvido e improviso usados na trilha (e alguns também no perfil de criança). */
export interface GameDef {
  title: string;
  detail: string;
  type: 'eco' | 'livre';
  /** eco: notas possíveis, tamanho da frase, rodadas; livre: escala liberada e acompanhamento. */
  pool: number[];
  length?: number;
  rounds?: number;
  /** livre: acordes do acompanhamento (fundamental MIDI de cada compasso) e andamento. */
  backing?: { roots: number[]; minor?: boolean[]; bpm: number };
  /** livre: segundos tocando para concluir. */
  seconds?: number;
}

const DO5 = [60, 62, 64, 65, 67];
const DO_MAIOR = [60, 62, 64, 65, 67, 69, 71, 72];
const PENTA = [60, 62, 64, 67, 69, 72, 74, 76];
const LA_MENOR_PENTA = [57, 60, 62, 64, 67, 69, 72];

export const GAMES: Record<string, GameDef> = {
  'eco-3': { type: 'eco', title: 'Eco de 3 notas', detail: 'O app toca 3 notas (Dó a Sol). Você repete de ouvido.', pool: DO5, length: 3, rounds: 8 },
  'eco-4': { type: 'eco', title: 'Eco de 4 notas', detail: 'Frases de 4 notas na posição de Dó.', pool: DO5, length: 4, rounds: 8 },
  'eco-escala': { type: 'eco', title: 'Eco na escala de Dó', detail: 'Frases de 4 notas usando a escala inteira.', pool: DO_MAIOR, length: 4, rounds: 8 },
  'eco-5': { type: 'eco', title: 'Eco de 5 notas', detail: 'Frases mais longas, na escala de Dó.', pool: DO_MAIOR, length: 5, rounds: 8 },
  'livre-5': { type: 'livre', title: 'Improviso nas 5 notas', detail: 'Um acompanhamento toca e você inventa com Dó-Ré-Mi-Fá-Sol. Não existe nota errada.', pool: DO5, backing: { roots: [48, 48, 43, 48], bpm: 80 }, seconds: 90 },
  'livre-penta': { type: 'livre', title: 'Improviso na pentatônica', detail: 'Sobre I–IV–V, só as notas que sempre soam bem (Dó Ré Mi Sol Lá).', pool: PENTA, backing: { roots: [48, 41, 43, 48], bpm: 84 }, seconds: 120 },
  'livre-pop': { type: 'livre', title: 'Improviso sobre I–V–vi–IV', detail: 'A progressão do pop no fundo; crie uma melodia com a pentatônica.', pool: PENTA, backing: { roots: [48, 43, 45, 41], minor: [false, false, true, false], bpm: 76 }, seconds: 120 },
  'livre-menor': { type: 'livre', title: 'Improviso em Lá menor', detail: 'Clima triste e bonito: Lá menor e Mi no fundo, pentatônica menor na direita.', pool: LA_MENOR_PENTA, backing: { roots: [45, 45, 40, 45], minor: [true, true, false, true], bpm: 70 }, seconds: 120 },
};

export const LEVELS: Level[] = [
  {
    n: 1, title: 'Primeiros passos', intro: 'Posição de Dó, primeiras músicas e ouvir antes de ler.',
    units: [
      { title: 'A mão no lugar', goal: 'Cinco dedos em Dó com cada mão.', missions: [lic('a1'), lic('a2'), ler(1, 'Ler Dó a Sol na clave de sol'), jogo('eco-3', 'ouvido')] },
      { title: 'Duas mãos, primeiro improviso', goal: 'Juntar as mãos e inventar sem medo.', missions: [lic('a3'), jogo('livre-5', 'criar'), lic('a4'), ler(2, 'Ler de Dó a Dó')] },
      { title: 'Primeira música inteira', goal: 'Brilha, Brilha com as duas mãos, no tempo.', missions: [lic('pa', 'repertorio'), jogo('eco-4', 'ouvido')] },
    ],
  },
  {
    n: 2, title: 'Escalas e passagem do polegar', intro: 'O movimento que libera a mão para andar pelo teclado.',
    units: [
      { title: 'Escala de Dó', goal: 'Passar o polegar sem trancos.', missions: [lic('b1'), lic('b2'), ler(3, 'Clave de fá')] },
      { title: 'Sol e Fá maior', goal: 'Primeiras teclas pretas na escala.', missions: [lic('b3'), lic('b4'), lic('b5'), lic('b6'), jogo('eco-escala', 'ouvido')] },
      { title: 'Mãos juntas e Beethoven', goal: 'Escala com as duas mãos e Ode à Alegria.', missions: [lic('b7'), lic('pb', 'repertorio'), jogo('livre-penta', 'criar')] },
    ],
  },
  {
    n: 3, title: 'Acordes e harmonia', intro: 'Tríades, inversões e o campo harmônico: o que permite tocar por cifra.',
    units: [
      { title: 'Inversões', goal: 'Trocar de acorde sem pular a mão.', missions: [lic('c1'), lic('c2'), lic('c3'), ler(4, 'Sol agudo')] },
      { title: 'Acordes do tom', goal: 'I–IV–V com baixo e uma música com acompanhamento.', missions: [lic('c4'), lic('pc', 'repertorio'), jogo('eco-5', 'ouvido')] },
    ],
  },
  {
    n: 4, title: 'Tocar por cifra', intro: 'Arpejos e a progressão I–V–vi–IV: o acompanhamento de centenas de músicas.',
    units: [
      { title: 'Arpejos', goal: 'A mão abre e o acorde vira melodia.', missions: [lic('d1'), lic('d2'), lic('d3'), ler(5, 'Fá grave')] },
      { title: 'A progressão do pop', goal: 'Acompanhar com baixo e com arpejo.', missions: [lic('e1', 'criar'), lic('e2', 'criar'), jogo('livre-pop', 'criar')] },
    ],
  },
  {
    n: 5, title: 'Menores e o primeiro clássico', intro: 'Tonalidade menor, acidentes e Für Elise.',
    units: [
      { title: 'Lá menor', goal: 'Ouvir e tocar o clima menor.', missions: [jogo('livre-menor', 'criar'), ler(6, 'Duas claves'), ler(7, 'Acidentes')] },
      { title: 'Für Elise', goal: 'A parte A inteira, mãos alternadas.', missions: [lic('pe', 'repertorio')] },
    ],
  },
];

/** Próximos níveis (conteúdo em preparação). Mostrados para dar a visão do caminho inteiro. */
export const ROADMAP: { n: number; title: string; items: string }[] = [
  { n: 6, title: 'Barroco e independência das mãos', items: 'Minueto em Sol (Petzold), escalas de Ré e Lá, pedal.' },
  { n: 7, title: 'Romântico e expressão', items: 'Prelúdio em Dó (Bach), Gymnopédie nº 1 (Satie), dinâmica e rubato.' },
  { n: 8, title: 'Tocar o que quiser', items: 'Lead sheet: melodia na direita, cifra na esquerda; tirar músicas de ouvido.' },
];

export const missionKey = (m: Mission) => (m.kind === 'licao' ? 'l:' + m.id : m.kind === 'leitura' ? 'r:' + m.level : 'g:' + m.id);

export function missionDone(m: Mission, s: Store): boolean {
  if (m.kind === 'licao') return !!s.lessons[m.id]?.completed;
  if (m.kind === 'leitura') return s.reading.level > m.level || (m.level === 7 && (s.reading.best[7]?.accuracy ?? 0) >= 0.9);
  return !!s.games?.[m.id]?.done;
}

export const missionPillar = (m: Mission): Pillar => (m.kind === 'leitura' ? 'leitura' : m.pillar);

export function missionTitle(m: Mission): string {
  if (m.kind === 'licao') return lessonById(m.id)?.title ?? m.id;
  if (m.kind === 'leitura') return 'Leitura: ' + m.title;
  return m.title;
}

export function missionHref(m: Mission): string {
  if (m.kind === 'licao') return '#/licao/' + m.id;
  if (m.kind === 'leitura') return '#/leitura';
  return '#/jogo/' + m.id;
}

export const allMissions = () => LEVELS.flatMap((l) => l.units.flatMap((u) => u.missions));

/** Primeira missão não feita, na ordem da trilha. */
export function currentMission(s: Store): { level: Level; unit: Unit; mission: Mission } | null {
  for (const level of LEVELS) for (const unit of level.units) for (const mission of unit.missions) {
    if (!missionDone(mission, s)) return { level, unit, mission };
  }
  return null;
}

/** Progresso por pilar (feitas / total). */
export function pillarProgress(s: Store): Record<Pillar, { done: number; total: number }> {
  const out = Object.fromEntries(PILLARS.map((p) => [p.id, { done: 0, total: 0 }])) as Record<Pillar, { done: number; total: number }>;
  for (const m of allMissions()) {
    const p = out[missionPillar(m)];
    p.total++;
    if (missionDone(m, s)) p.done++;
  }
  return out;
}
