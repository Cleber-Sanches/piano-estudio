import { lessonById } from './lessons';
import type { Store } from './progress';

// Trilha do adulto, do zero ao pianista: 4 fases, 12 níveis.
// Cada nível mistura técnica, leitura, ouvido, criação e repertório em missões curtas,
// e termina numa peça. A partir da fase 3 entram obras reais (arquivos MIDI do domínio público).

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
  | { kind: 'jogo'; id: string; title: string; detail: string; pillar: Pillar }
  | { kind: 'obra'; id: string; title: string; composer: string; detail: string; pillar: Pillar };

export interface Phase {
  n: number;
  title: string;
  goal: string;
}

export const PHASES: Phase[] = [
  { n: 1, title: 'Fundamentos', goal: 'Mãos no lugar, primeiras escalas e as primeiras músicas inteiras.' },
  { n: 2, title: 'Base sólida', goal: 'Acordes, tocar por cifra, tonalidade menor e o primeiro clássico.' },
  { n: 3, title: 'Intermediário', goal: 'Todas as tonalidades, harmonia de verdade e técnica de concerto.' },
  { n: 4, title: 'Avançado', goal: 'Expressão, repertório romântico e tocar o que quiser.' },
];

export interface Level {
  n: number;
  phase: number;
  title: string;
  /** O que você vai conseguir fazer ao terminar. */
  goal: string;
  missions: Mission[];
}

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
const LA_MENOR = [57, 59, 60, 62, 64, 65, 68, 69];
const LA_MENOR_PENTA = [57, 60, 62, 64, 67, 69, 72];
const DUAS_OITAVAS = [55, 57, 59, 60, 62, 64, 65, 67, 69, 71, 72, 74, 76];
const CROMATICA = Array.from({ length: 13 }, (_, i) => 60 + i);
const BLUES = [60, 63, 65, 66, 67, 70, 72];

export const GAMES: Record<string, GameDef> = {
  'eco-3': { type: 'eco', title: 'Eco de 3 notas', detail: 'O app toca 3 notas (Dó a Sol). Você repete de ouvido.', pool: DO5, length: 3, rounds: 8 },
  'eco-4': { type: 'eco', title: 'Eco de 4 notas', detail: 'Frases de 4 notas na posição de Dó.', pool: DO5, length: 4, rounds: 8 },
  'eco-escala': { type: 'eco', title: 'Eco na escala de Dó', detail: 'Frases de 4 notas usando a escala inteira.', pool: DO_MAIOR, length: 4, rounds: 8 },
  'eco-5': { type: 'eco', title: 'Eco de 5 notas', detail: 'Frases mais longas, na escala de Dó.', pool: DO_MAIOR, length: 5, rounds: 8 },
  'eco-menor': { type: 'eco', title: 'Eco em Lá menor', detail: 'Frases de 4 notas em Lá menor harmônica. Ouça o Sol♯.', pool: LA_MENOR, length: 4, rounds: 8 },
  'eco-6': { type: 'eco', title: 'Eco de 6 notas', detail: 'Frases de 6 notas em duas oitavas.', pool: DUAS_OITAVAS, length: 6, rounds: 8 },
  'eco-cromatico': { type: 'eco', title: 'Eco cromático', detail: 'Frases de 4 notas com teclas pretas e brancas.', pool: CROMATICA, length: 4, rounds: 8 },
  'eco-longo': { type: 'eco', title: 'Eco de 8 notas', detail: 'Frases inteiras: o treino para tirar músicas de ouvido.', pool: DUAS_OITAVAS, length: 8, rounds: 6 },
  'livre-5': { type: 'livre', title: 'Improviso nas 5 notas', detail: 'Um acompanhamento toca e você inventa com Dó-Ré-Mi-Fá-Sol. Não existe nota errada.', pool: DO5, backing: { roots: [48, 48, 43, 48], bpm: 80 }, seconds: 90 },
  'livre-penta': { type: 'livre', title: 'Improviso na pentatônica', detail: 'Sobre I–IV–V, só as notas que sempre soam bem (Dó Ré Mi Sol Lá).', pool: PENTA, backing: { roots: [48, 41, 43, 48], bpm: 84 }, seconds: 120 },
  'livre-pop': { type: 'livre', title: 'Improviso sobre I–V–vi–IV', detail: 'A progressão do pop no fundo; crie uma melodia com a pentatônica.', pool: PENTA, backing: { roots: [48, 43, 45, 41], minor: [false, false, true, false], bpm: 76 }, seconds: 120 },
  'livre-menor': { type: 'livre', title: 'Improviso em Lá menor', detail: 'Clima triste e bonito: Lá menor e Mi no fundo, pentatônica menor na direita.', pool: LA_MENOR_PENTA, backing: { roots: [45, 45, 40, 45], minor: [true, true, false, true], bpm: 70 }, seconds: 120 },
  'livre-251': { type: 'livre', title: 'Improviso sobre ii–V–I', detail: 'Ré menor, Sol, Dó: a progressão do jazz e da bossa. Use a escala de Dó e mire nas notas do acorde.', pool: DO_MAIOR, backing: { roots: [50, 43, 48, 48], minor: [true, false, false, false], bpm: 88 }, seconds: 150 },
  'livre-blues': { type: 'livre', title: 'Improviso de blues', detail: 'Blues de 12 compassos em Dó com a escala blues (Dó Mi♭ Fá Fá♯ Sol Si♭). Repita ideias curtas.', pool: BLUES, backing: { roots: [48, 48, 48, 48, 53, 53, 48, 48, 43, 53, 48, 43], bpm: 90 }, seconds: 180 },
  'livre-livre': { type: 'livre', title: 'Cinco minutos de música', detail: 'Toque livre sobre I–vi–IV–V. Melodia, acordes, o que vier: é você tocando piano.', pool: DUAS_OITAVAS, backing: { roots: [48, 45, 41, 43], minor: [false, true, false, false], bpm: 80 }, seconds: 300 },
};

/** Obras reais: você toca pelo arquivo MIDI (aba Músicas) e marca quando consegue tocar inteira. */
export interface ObraDef {
  title: string;
  composer: string;
  detail: string;
}

export const OBRAS: Record<string, ObraDef> = {
  'clementi-36-1': { title: 'Sonatina op. 36 nº 1', composer: 'Clementi', detail: 'Primeiro movimento. Escalas e Alberti dentro de uma música de verdade.' },
  'gymnopedie-1': { title: 'Gymnopédie nº 1', composer: 'Satie', detail: 'Lenta e calma: salto da esquerda (baixo e acorde) e pedal limpo a cada compasso.' },
  'chopin-28-4': { title: 'Prelúdio op. 28 nº 4', composer: 'Chopin', detail: 'Acordes repetidos e suaves na esquerda; melodia que chora na direita. Escuta e voz.' },
  'bach-invencao-1': { title: 'Invenção nº 1 em Dó', composer: 'Bach', detail: 'Duas vozes iguais, uma em cada mão: a prova final de independência.' },
  'traumerei': { title: 'Träumerei (Cenas Infantis)', composer: 'Schumann', detail: 'Rubato e voz cantada. Tocar devagar e bonito, não rápido.' },
  'lead-sheet': { title: 'Uma música por cifra', composer: 'Você escolhe', detail: 'Escolha uma música que você ama: melodia na direita, cifra na esquerda (Valsa, Balada ou Alberti).' },
  'de-ouvido': { title: 'Tirar uma música de ouvido', composer: 'Você escolhe', detail: 'Sem partitura: ache a melodia de ouvido, depois os acordes. Grave e compare.' },
  'noturno-9-2': { title: 'Noturno op. 9 nº 2', composer: 'Chopin', detail: 'Esquerda larga em valsa lenta, direita ornamentada. Pedal e cantabile.' },
  'patetica-2': { title: 'Sonata Patética, 2º movimento', composer: 'Beethoven', detail: 'Melodia no meio da mão direita, acompanhamento por baixo dela: tocar em camadas.' },
  'clair-de-lune': { title: 'Clair de Lune', composer: 'Debussy', detail: 'Cores, pedal e silêncio. A peça que mostra que você virou pianista.' },
  'recital': { title: 'Recital', composer: 'Você', detail: 'Três peças da sua escolha, tocadas em seguida, para alguém (ou gravadas). Do começo ao fim, sem parar.' },
};

const lic = (id: string, pillar: Pillar = 'tecnica'): Mission => ({ kind: 'licao', id, pillar });
const pc = (id: string): Mission => lic(id, 'repertorio');
const ler = (level: number, title: string): Mission => ({ kind: 'leitura', level, title });
const jogo = (id: string, pillar: Pillar): Mission => ({ kind: 'jogo', id, title: GAMES[id].title, detail: GAMES[id].detail, pillar });
const obra = (id: string, pillar: Pillar = 'repertorio'): Mission => ({ kind: 'obra', id, ...OBRAS[id], pillar });

export const LEVELS: Level[] = [
  // Fase 1 · Fundamentos
  { n: 1, phase: 1, title: 'Primeiros passos', goal: 'Tocar Brilha, Brilha com as duas mãos.',
    missions: [lic('1a'), lic('1b'), ler(1, 'Dó a Sol na clave de sol'), jogo('eco-3', 'ouvido'), lic('1c'), jogo('livre-5', 'criar'), pc('1p')] },
  { n: 2, phase: 1, title: 'Mãos independentes', goal: 'Cada mão fazendo uma coisa diferente.',
    missions: [lic('2a'), ler(2, 'De Dó a Dó'), lic('2b'), jogo('eco-4', 'ouvido'), lic('2c'), lic('2d'), pc('2p'), jogo('livre-penta', 'criar')] },
  { n: 3, phase: 1, title: 'Escalas e polegar', goal: 'Escalas de Dó, Sol e Fá sem trancos.',
    missions: [lic('3a'), lic('3b'), ler(3, 'Clave de fá'), lic('3c'), jogo('eco-escala', 'ouvido'), lic('3d'), lic('3e'), lic('3f'), pc('3p')] },
  // Fase 2 · Base sólida
  { n: 4, phase: 2, title: 'Acordes', goal: 'Trocar de acorde sem pular a mão.',
    missions: [lic('4a'), lic('4b'), ler(4, 'Sol agudo'), lic('4c'), lic('4d'), jogo('eco-5', 'ouvido'), lic('4e'), pc('4p')] },
  { n: 5, phase: 2, title: 'Tocar por cifra', goal: 'Acompanhar qualquer música pop.',
    missions: [lic('5a'), lic('5b'), lic('5c'), ler(5, 'Fá grave'), lic('5d', 'criar'), jogo('livre-pop', 'criar'), lic('5e', 'criar'), lic('5f', 'criar'), pc('5p')] },
  { n: 6, phase: 2, title: 'Menores e clássico', goal: 'Tocar Für Elise, parte A.',
    missions: [jogo('livre-menor', 'criar'), lic('6a'), ler(6, 'Duas claves'), lic('6b'), lic('6c'), jogo('eco-menor', 'ouvido'), lic('6d'), ler(7, 'Acidentes'), pc('6p')] },
  // Fase 3 · Intermediário
  { n: 7, phase: 3, title: 'Todas as tonalidades', goal: 'Escalas com sustenidos e bemóis e o primeiro barroco.',
    missions: [lic('7a'), lic('7b'), lic('7c'), lic('7g', 'criar'), lic('7d'), lic('7e'), lic('7f'), jogo('eco-6', 'ouvido'), pc('7p')] },
  { n: 8, phase: 3, title: 'Harmonia', goal: 'Sétimas, ii–V–I, blues e o Prelúdio de Bach.',
    missions: [lic('8a'), lic('8b', 'criar'), jogo('livre-251', 'criar'), lic('8c', 'criar'), lic('8d', 'criar'), lic('8e', 'criar'), jogo('livre-blues', 'criar'), pc('8p')] },
  { n: 9, phase: 3, title: 'Técnica de concerto', goal: 'Todas as escalas maiores, cromática, arpejos e oitavas.',
    missions: [lic('9a'), lic('9b'), lic('9c'), lic('9d'), lic('9e'), lic('9f'), lic('9g'), lic('9h'), lic('9i'), obra('clementi-36-1'), obra('gymnopedie-1'), jogo('eco-cromatico', 'ouvido')] },
  // Fase 4 · Avançado
  { n: 10, phase: 4, title: 'Expressão', goal: 'Dinâmica, rubato, pedal e duas vozes.',
    missions: [lic('10a'), lic('10b'), obra('chopin-28-4'), jogo('eco-longo', 'ouvido'), obra('bach-invencao-1'), obra('traumerei')] },
  { n: 11, phase: 4, title: 'Tocar o que quiser', goal: 'Qualquer cifra, qualquer estilo, de ouvido.',
    missions: [lic('11a', 'criar'), lic('11b', 'criar'), lic('11c', 'criar'), obra('lead-sheet', 'criar'), obra('de-ouvido', 'ouvido'), jogo('livre-livre', 'criar')] },
  { n: 12, phase: 4, title: 'Pianista', goal: 'Repertório romântico e um recital seu.',
    missions: [obra('noturno-9-2'), obra('patetica-2'), obra('clair-de-lune'), obra('recital')] },
];

export const missionKey = (m: Mission) =>
  m.kind === 'licao' ? 'l:' + m.id : m.kind === 'leitura' ? 'r:' + m.level : m.kind === 'obra' ? 'o:' + m.id : 'g:' + m.id;

export function missionDone(m: Mission, s: Store): boolean {
  if (m.kind === 'licao') return !!s.lessons[m.id]?.completed;
  if (m.kind === 'leitura') return s.reading.level > m.level || (m.level === 7 && (s.reading.best[7]?.accuracy ?? 0) >= 0.9);
  return !!s.games?.[m.id]?.done;
}

export const missionPillar = (m: Mission): Pillar => (m.kind === 'leitura' ? 'leitura' : m.pillar);

export function missionTitle(m: Mission): string {
  if (m.kind === 'licao') return lessonById(m.id)?.title ?? m.id;
  if (m.kind === 'leitura') return 'Leitura: ' + m.title;
  if (m.kind === 'obra') return `${m.title} — ${m.composer}`;
  return m.title;
}

export function missionHref(m: Mission): string {
  if (m.kind === 'licao') return '#/licao/' + m.id;
  if (m.kind === 'leitura') return '#/leitura';
  if (m.kind === 'obra') return '#/obra/' + m.id;
  return '#/jogo/' + m.id;
}

export const allMissions = () => LEVELS.flatMap((l) => l.missions);
export const levelDone = (l: Level, s: Store) => l.missions.filter((m) => missionDone(m, s)).length;

/** Primeira missão não feita, na ordem da trilha. */
export function currentMission(s: Store): { level: Level; mission: Mission } | null {
  for (const level of LEVELS) for (const mission of level.missions) {
    if (!missionDone(mission, s)) return { level, mission };
  }
  return null;
}

/** Nível atual (o primeiro com missão pendente; o último se tudo feito). */
export const currentLevel = (s: Store) => currentMission(s)?.level ?? LEVELS[LEVELS.length - 1];

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
