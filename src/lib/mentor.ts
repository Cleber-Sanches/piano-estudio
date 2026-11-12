import { useSyncExternalStore } from 'react';
import { BUILTIN_PIECES, pieceById } from './pieces';
import { activeProfile, subscribeProfiles } from './profiles';
import type { Song, SongNote } from './song';
import { PITCH_PT } from './theory';

// Professor adaptativo: a música que você quer tocar vira o currículo.
// O app quebra a música em frases, descobre o que cada frase exige (teclas, ritmos),
// mede o que você já domina a cada nota tocada e escolhe o próximo exercício de 30 s
// mirando exatamente o que falta. Nada de lição fixa.

// ---------- mapa de habilidades ----------

/** Domínio de uma habilidade: m de 0 a 1, n tentativas, dia da última. */
export interface Skill { m: number; n: number; at: string }

export interface Mind {
  version: 1;
  songId: string;
  /** Chaves: tecla:<midi> (achar a tecla), ler:<midi> (ler na pauta), ritmo:<tempos>, frase:<música>:<i>. */
  skills: Record<string, Skill>;
  /** Trocas de nota: "esperada>tocada" → vezes. */
  confusions: Record<string, number>;
  /** Tendência de tempo nas notas certas. */
  timing: { early: number; late: number; n: number };
  /** Escada de dificuldade por tipo de exercício (1 a 10). */
  levels: { eco: number; ritmo: number; ler: number };
  /** Músicas já dominadas inteiras. */
  learned: string[];
  sessions: Array<{ day: string; rounds: number; sec: number }>;
}

export const SONG_LADDER = ['hotcross', 'mary', 'ode', 'frere', 'brilha', 'jingle', 'lobato', 'doremifa', 'parabens', 'minueto'];

export function emptyMind(songId = 'ode'): Mind {
  return {
    version: 1, songId, skills: {}, confusions: {}, timing: { early: 0, late: 0, n: 0 },
    levels: { eco: 1, ritmo: 1, ler: 1 }, learned: [], sessions: [],
  };
}

const day = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000);

/** Domínio atual, com esquecimento leve: perde até 40% se ficar muito tempo sem praticar. */
export function mastery(mind: Mind, key: string, today = day()): number {
  const s = mind.skills[key];
  if (!s) return 0;
  const idle = Math.max(0, daysBetween(s.at, today));
  return s.m * Math.max(0.6, 1 - 0.015 * idle);
}

/** Aprende rápido no começo (média que pesa mais o recente), estabiliza depois. */
export function updateSkill(mind: Mind, key: string, score: number, today = day()): Mind {
  const s = mind.skills[key];
  const cur = s ? mastery(mind, key, today) : 0;
  const n = s?.n ?? 0;
  const a = n < 2 ? 0.55 : n < 6 ? 0.4 : 0.3;
  const m = Math.max(0, Math.min(1, cur + a * (Math.max(0, Math.min(1, score)) - cur)));
  return { ...mind, skills: { ...mind.skills, [key]: { m, n: n + 1, at: today } } };
}

/** Escada: acertou muito sobe, errou muito desce. Mantém você perto de 80% de acerto. */
export function stepLevel(level: number, score: number): number {
  if (score >= 0.9) return Math.min(10, level + 1);
  if (score < 0.6) return Math.max(1, level - 1);
  return level;
}

export const ecoLength = (level: number) => 2 + Math.floor((level - 1) / 2);
export const ritmoBpm = (level: number) => 60 + (level - 1) * 6;
/** Tempo "bom" para ler uma nota, em ms. */
export const lerTargetMs = (level: number) => Math.max(1200, 4000 - (level - 1) * 300);
/** Janela de acerto do ritmo, em ms. Começa generosa. */
export const ritmoWindowMs = (level: number) => Math.max(70, 170 - (level - 1) * 11);

// ---------- frases da música ----------

export interface Phrase {
  i: number;
  /** Melodia (mão direita), na ordem. */
  notes: SongNote[];
  /** Acompanhamento que o app toca seguindo você. */
  lh: SongNote[];
  start: number;
  end: number;
}

/** Quebra a mão direita em frases de `measures` compassos (frase curta demais junta com a anterior). */
export function phrasesOf(song: Song, measures = 2): Phrase[] {
  const span = song.beatsPerMeasure * measures;
  const rh = song.notes.filter((n) => n.hand === 'R');
  const lh = song.notes.filter((n) => n.hand === 'L');
  const out: Phrase[] = [];
  for (let start = 0; start < song.totalBeats; start += span) {
    const notes = rh.filter((n) => n.beat >= start && n.beat < start + span);
    if (!notes.length) continue;
    const prev = out[out.length - 1];
    if (notes.length < 3 && prev) {
      prev.notes.push(...notes);
      prev.lh.push(...lh.filter((n) => n.beat >= start && n.beat < start + span));
      prev.end = start + span;
      continue;
    }
    out.push({ i: out.length, notes, lh: lh.filter((n) => n.beat >= start && n.beat < start + span), start, end: start + span });
  }
  return out;
}

/** Duração de cada nota até a próxima (a última usa a própria duração), arredondada a 1/4 de tempo. */
export function iois(notes: SongNote[]): number[] {
  return notes.map((n, k) => {
    const next = notes[k + 1];
    const d = next ? next.beat - n.beat : n.beats;
    return Math.max(0.25, Math.round(d * 4) / 4);
  });
}

export function phraseNeeds(p: Phrase): { teclas: number[]; ritmos: number[] } {
  return {
    teclas: [...new Set(p.notes.map((n) => n.midi))],
    ritmos: [...new Set(iois(p.notes))],
  };
}

// ---------- planejador ----------

export type Hint = 'tecla' | 'nome' | 'nada';

export type Round =
  | { kind: 'eco'; notes: number[]; why: string }
  | { kind: 'ler'; notes: number[]; why: string }
  | { kind: 'ritmo'; pattern: number[]; bpm: number; why: string }
  | { kind: 'frase'; phrases: number[]; hint: Hint; why: string };

export function songFor(mind: Mind): Song {
  const pc = pieceById(mind.songId) ?? BUILTIN_PIECES[0];
  return pc.build(pc.bpm, ['R', 'L']);
}

export const hintFor = (m: number): Hint => (m < 0.45 ? 'tecla' : m < 0.75 ? 'nome' : 'nada');

export const noteLabel = (midi: number) => PITCH_PT[((midi % 12) + 12) % 12];

const FIGURE: Record<string, string> = { '0.25': 'semicolcheia', '0.5': 'colcheia', '0.75': 'colcheia pontuada', '1': 'semínima (1 tempo)', '1.5': 'semínima pontuada', '2': 'mínima (2 tempos)', '3': 'mínima pontuada (3 tempos)', '4': 'semibreve (4 tempos)' };

export function skillLabel(key: string, songTitle = ''): string {
  const [kind, a, b] = key.split(':');
  if (kind === 'tecla') return `Achar o ${noteLabel(+a)}`;
  if (kind === 'ler') return `Ler o ${noteLabel(+a)} na pauta`;
  if (kind === 'ritmo') return `Ritmo: ${FIGURE[a] ?? a + ' tempos'}`;
  if (kind === 'frase') return `Frase ${+b + 1}${songTitle ? ' de ' + songTitle : ''}`;
  return key;
}

/** Janela da frase (notas reais da música) que contém a nota mais fraca. Treinar o pedaço real transfere melhor. */
function fragmentWith(p: Phrase, target: number, len: number): number[] {
  const mids = p.notes.map((n) => n.midi);
  const at = Math.max(0, mids.indexOf(target));
  const from = Math.max(0, Math.min(mids.length - len, at - Math.floor(len / 2)));
  return mids.slice(from, from + Math.min(len, mids.length));
}

/**
 * Escolhe o próximo exercício.
 * Regra: mira a primeira frase ainda não dominada; se falta uma tecla ou um ritmo
 * que ela exige, treina só isso por 30 s, com pedaços da própria frase; senão toca a frase.
 * A leitura entra em paralelo (1 a cada 4) e o andaime some conforme você domina.
 */
export function nextRound(mind: Mind, song: Song, history: Round['kind'][], today = day(), rnd = Math.random): Round {
  const phrases = phrasesOf(song);
  const fm = (i: number) => mastery(mind, `frase:${mind.songId}:${i}`, today);
  const targetIdx = phrases.findIndex((p) => fm(p.i) < 0.8);
  const last = history[history.length - 1];
  const twice = (k: Round['kind']) => history.length >= 2 && history.slice(-2).every((h) => h === k);

  // Música inteira dominada: tocar tudo de cor é a consagração.
  if (targetIdx < 0) {
    const all = phrases.map((p) => p.i);
    const m = Math.min(...all.map(fm));
    return { kind: 'frase', phrases: all, hint: hintFor(m - 0.2), why: 'Você já domina todas as frases. Agora a música inteira, do começo ao fim.' };
  }
  const target = phrases[targetIdx];
  const need = phraseNeeds(target);

  // Aquecimento: começar ganhando.
  if (history.length === 0) {
    const strong = Object.keys(mind.skills).filter((k) => k.startsWith('tecla:') && mastery(mind, k, today) >= 0.7).map((k) => +k.split(':')[1]);
    if (strong.length >= 2) {
      const notes = Array.from({ length: Math.min(3, ecoLength(mind.levels.eco)) }, () => strong[Math.floor(rnd() * strong.length)]);
      return { kind: 'eco', notes, why: 'Aquecimento com notas que você já domina.' };
    }
    if (fm(targetIdx) === 0 && targetIdx === 0) {
      return { kind: 'frase', phrases: [target.i], hint: 'tecla', why: 'Primeiro contato: o app mostra a tecla, você só segue. Em 1 minuto você já está tocando a música.' };
    }
  }

  // Encadear: acabou de dominar uma frase nova → junta com a anterior.
  if (last === 'frase' && targetIdx > 0 && fm(targetIdx - 1) >= 0.8 && !twice('frase') && rnd() < 0.5) {
    const upTo = phrases.slice(0, targetIdx).map((p) => p.i).slice(-3);
    return { kind: 'frase', phrases: upTo, hint: hintFor(Math.min(...upTo.map(fm)) - 0.1), why: 'Juntar as frases que você já sabe, sem parar entre elas.' };
  }

  // Leitura em paralelo: 1 a cada 4 rodadas, nas notas da frase que você ainda lê mal.
  const lerWeak = need.teclas.filter((m) => mastery(mind, 'ler:' + m, today) < 0.75).sort((a, b) => mastery(mind, 'ler:' + a, today) - mastery(mind, 'ler:' + b, today));
  const sinceLer = history.length - 1 - history.lastIndexOf('ler');
  if (lerWeak.length && history.length >= 2 && sinceLer >= 3) {
    const pool = [...lerWeak.slice(0, 3), ...need.teclas].slice(0, Math.max(2, Math.min(5, 1 + mind.levels.ler)));
    const notes = Array.from({ length: 5 }, (_, k) => pool[k % pool.length]).sort(() => rnd() - 0.5);
    return { kind: 'ler', notes, why: `Ler na pauta as notas desta frase. Seu ponto mais fraco: ${noteLabel(lerWeak[0])}.` };
  }

  // Ponto fraco da frase: tecla ou ritmo abaixo de 70%.
  const weakT = need.teclas.map((m) => ({ m, v: mastery(mind, 'tecla:' + m, today) })).filter((x) => x.v < 0.7 && (mind.skills['tecla:' + x.m]?.n ?? 0) > 0).sort((a, b) => a.v - b.v);
  const weakR = need.ritmos.map((d) => ({ d, v: mastery(mind, 'ritmo:' + d, today) })).filter((x) => x.v < 0.7).sort((a, b) => a.v - b.v);
  const fraseSeen = (mind.skills[`frase:${mind.songId}:${target.i}`]?.n ?? 0) > 0;

  if (last !== 'eco' && weakT.length && fraseSeen) {
    const conf = Object.entries(mind.confusions).filter(([k]) => k.startsWith(weakT[0].m + '>')).sort((a, b) => b[1] - a[1])[0];
    const extra = conf ? ` Você costuma tocar ${noteLabel(+conf[0].split('>')[1])} no lugar.` : '';
    return { kind: 'eco', notes: fragmentWith(target, weakT[0].m, ecoLength(mind.levels.eco)), why: `Seu ponto fraco na frase ${target.i + 1} é achar o ${noteLabel(weakT[0].m)}.${extra} Ouça e repita o pedaço.` };
  }
  if (last !== 'ritmo' && weakR.length && fraseSeen && !twice('frase')) {
    const notes = target.notes;
    const pattern = iois(notes).slice(0, 8);
    const label = FIGURE[String(weakR[0].d)] ?? weakR[0].d + ' tempos';
    return { kind: 'ritmo', pattern, bpm: ritmoBpm(mind.levels.ritmo), why: `O ritmo da frase ${target.i + 1}, numa tecla só, para você pensar só no tempo. Foco: ${label}.` };
  }
  if (twice('frase') && weakT.length) {
    return { kind: 'eco', notes: fragmentWith(target, weakT[0].m, ecoLength(mind.levels.eco)), why: `Pausa da frase: treinar o ${noteLabel(weakT[0].m)} isolado.` };
  }

  return { kind: 'frase', phrases: [target.i], hint: hintFor(fm(target.i)), why: fm(target.i) < 0.45
    ? `Frase ${target.i + 1}: siga as teclas acesas. O app toca a outra mão seguindo o seu tempo.`
    : fm(target.i) < 0.75
      ? `Frase ${target.i + 1}: agora só os nomes. As teclas acesas sumiram.`
      : `Frase ${target.i + 1} de cor. Quase lá.` };
}

// ---------- diagnóstico ----------

export interface Diagnosis { weak: Array<{ key: string; label: string; m: number }>; swaps: string[]; tempo: string | null }

export function diagnose(mind: Mind, songTitle: string, today = day()): Diagnosis {
  const weak = Object.entries(mind.skills)
    .filter(([k, s]) => s.n >= 2 && !k.startsWith('frase:'))
    .map(([k]) => ({ key: k, label: skillLabel(k, songTitle), m: mastery(mind, k, today) }))
    .filter((x) => x.m < 0.7)
    .sort((a, b) => a.m - b.m)
    .slice(0, 3);
  const swaps = Object.entries(mind.confusions)
    .filter(([, v]) => v >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([k, v]) => { const [a, b] = k.split('>').map(Number); return `Troca ${noteLabel(a)} por ${noteLabel(b)} (${v}×)`; });
  const t = mind.timing;
  const tempo = t.n >= 12 && t.early / t.n > 0.45 ? 'Tende a adiantar: segure um pouco antes de tocar.' : t.n >= 12 && t.late / t.n > 0.45 ? 'Tende a atrasar: prepare o dedo da próxima nota antes.' : null;
  return { weak, swaps, tempo };
}

export function recordConfusion(mind: Mind, want: number, got: number): Mind {
  if (want % 12 === got % 12) return mind;
  const k = `${want}>${got}`;
  return { ...mind, confusions: { ...mind.confusions, [k]: (mind.confusions[k] ?? 0) + 1 } };
}

// ---------- armazenamento por perfil ----------

const mindKey = () => 'piano-estudio:mente:' + activeProfile().id;
let cache: Mind | null = null;
let cacheKey = '';
const listeners = new Set<() => void>();
subscribeProfiles(() => { if (mindKey() !== cacheKey) { cache = null; listeners.forEach((l) => l()); } });

export function loadMind(): Mind {
  if (cache && cacheKey === mindKey()) return cache;
  cacheKey = mindKey();
  try {
    const raw = localStorage.getItem(cacheKey);
    cache = raw ? { ...emptyMind(), ...JSON.parse(raw) } : emptyMind();
  } catch {
    cache = emptyMind();
  }
  return cache!;
}

export function saveMind(m: Mind) {
  cache = m;
  cacheKey = mindKey();
  try { localStorage.setItem(cacheKey, JSON.stringify(m)); } catch { /* só memória */ }
  listeners.forEach((l) => l());
}

export function subscribeMind(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export const useMind = () => useSyncExternalStore(subscribeMind, loadMind);
export const todayStr = day;
