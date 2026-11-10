import { LESSONS, MODULES } from './lessons';
import type { PassResult, PracticeMode } from '../engine/practice';
import type { Hand } from './theory';

// Progresso salvo no navegador (localStorage), com relatório para o check-in com o mentor.

export interface Attempt {
  at: string; // ISO
  kind: 'licao' | 'musica' | 'teste' | 'leitura';
  id: string;
  title: string;
  mode: PracticeMode;
  hands: Hand[];
  bpm: number | null;
  speed: number;
  accuracy: number;
  hits: number;
  total: number;
  wrong: number;
  avgOffsetMs: number;
  loop: [number, number] | null;
  troubleMeasures: number[];
}

export interface LessonProgress {
  completed: boolean;
  completedAt?: string;
  /** Concluída pelo teste do módulo (nivelamento). */
  viaTeste?: boolean;
  bestAccuracy: number;
  bestBpm: number;
  attempts: number;
  /** Revisão espaçada: próxima data e degrau do intervalo. */
  review?: { due: string; step: number };
}

export interface ReadingProgress {
  /** Maior nível liberado. */
  level: number;
  best: Record<number, { accuracy: number; avgMs: number }>;
}

export interface Store {
  version: 1;
  lessons: Record<string, LessonProgress>;
  attempts: Attempt[];
  /** Minutos tocando por dia (AAAA-MM-DD). */
  minutes: Record<string, number>;
  reading: ReadingProgress;
}

const KEY = 'piano-estudio:v1';
/** Dias até a próxima revisão, por degrau. */
export const REVIEW_INTERVALS = [1, 3, 7, 14, 30, 60];

function empty(): Store {
  return { version: 1, lessons: {}, attempts: [], minutes: {}, reading: { level: 1, best: {} } };
}

let cache: Store | null = null;
const listeners = new Set<() => void>();

export function load(): Store {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? { ...empty(), ...JSON.parse(raw) } : empty();
  } catch {
    cache = empty();
  }
  return cache!;
}

function save(s: Store) {
  cache = s;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* sem espaço ou bloqueado: segue só na memória */
  }
  listeners.forEach((l) => l());
}

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export const today = () => iso(new Date());
export function addDays(day: string, n: number): string {
  const d = new Date(day + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return iso(d);
}

export function addMinutes(sec: number) {
  if (sec <= 0) return;
  const s = load();
  const k = today();
  save({ ...s, minutes: { ...s.minutes, [k]: Math.round(((s.minutes[k] ?? 0) + sec / 60) * 10) / 10 } });
}

export interface Goal { bpm: number; accuracy: number }

export function passedGoal(a: Pick<Attempt, 'mode' | 'loop' | 'bpm'>, accuracy: number, goal?: Goal) {
  return !!goal && a.mode === 'tempo' && !a.loop && (a.bpm ?? 0) >= goal.bpm && accuracy >= goal.accuracy;
}

/**
 * Registra uma tentativa e atualiza conclusão, revisão espaçada e teste de módulo.
 * `moduleTest` = id do módulo quando a tentativa é o teste de nivelamento.
 */
export function recordAttempt(a: Omit<Attempt, 'at'>, result: PassResult, goal?: Goal, moduleTest?: string) {
  const s = load();
  const day = today();
  const attempt: Attempt = { ...a, at: new Date().toISOString() };
  const attempts = [attempt, ...s.attempts].slice(0, 800);
  let lessons = { ...s.lessons };
  const passed = passedGoal(a, result.accuracy, goal);
  const fullTempo = a.mode === 'tempo' && !a.loop;

  if (a.kind === 'licao' || a.kind === 'teste') {
    const prev = lessons[a.id] ?? { completed: false, bestAccuracy: 0, bestBpm: 0, attempts: 0 };
    let review = prev.review;
    if (!prev.completed && passed) review = { due: addDays(day, REVIEW_INTERVALS[0]), step: 0 };
    else if (prev.completed && review && review.due <= day && fullTempo) {
      if (passed) {
        const step = Math.min(REVIEW_INTERVALS.length - 1, review.step + 1);
        review = { due: addDays(day, REVIEW_INTERVALS[step]), step };
      } else if (result.accuracy < 0.8) {
        review = { due: addDays(day, 1), step: 0 };
      }
    }
    lessons[a.id] = {
      ...prev,
      attempts: prev.attempts + 1,
      bestAccuracy: a.mode === 'tempo' ? Math.max(prev.bestAccuracy, result.accuracy) : prev.bestAccuracy,
      bestBpm: a.mode === 'tempo' && result.accuracy >= (goal?.accuracy ?? 0.9) ? Math.max(prev.bestBpm, a.bpm ?? 0) : prev.bestBpm,
      completed: prev.completed || passed,
      completedAt: prev.completedAt ?? (passed ? attempt.at : undefined),
      review,
    };
  }

  if (moduleTest && passed) {
    LESSONS.filter((l) => l.module === moduleTest && l.kind !== 'peca').forEach((l) => {
      const p = lessons[l.id];
      if (p?.completed) return;
      lessons[l.id] = {
        completed: true, completedAt: attempt.at, viaTeste: true, bestAccuracy: p?.bestAccuracy ?? 0,
        bestBpm: p?.bestBpm ?? 0, attempts: p?.attempts ?? 0, review: { due: addDays(day, 3), step: 1 },
      };
    });
  }

  save({ ...s, attempts, lessons });
  return { lesson: lessons[a.id], passed, moduleCleared: !!moduleTest && passed };
}

export function dueReviews(s: Store = load()): string[] {
  const day = today();
  return LESSONS.filter((l) => {
    const p = s.lessons[l.id];
    return p?.completed && p.review && p.review.due <= day;
  }).map((l) => l.id);
}

export function moduleDone(moduleId: string, s: Store = load()) {
  return LESSONS.filter((l) => l.module === moduleId && l.kind !== 'peca').every((l) => s.lessons[l.id]?.completed);
}

export function testLessonId(moduleId: string) {
  return MODULES.find((m) => m.id === moduleId)?.testId;
}

/** Registra uma rodada de leitura e libera o próximo nível com 90% e até 2,5 s por nota. */
export function recordReading(level: number, title: string, accuracy: number, avgMs: number, hits: number, total: number, wrong: number, maxLevel: number) {
  const s = load();
  const attempt: Attempt = {
    at: new Date().toISOString(), kind: 'leitura', id: 'nivel-' + level, title, mode: 'espera', hands: ['R', 'L'], bpm: null,
    speed: 1, accuracy, hits, total, wrong, avgOffsetMs: avgMs, loop: null, troubleMeasures: [],
  };
  const prev = s.reading.best[level];
  const better = !prev || accuracy > prev.accuracy || (accuracy === prev.accuracy && avgMs < prev.avgMs);
  const unlocked = accuracy >= 0.9 && avgMs <= 2500;
  const reading: ReadingProgress = {
    level: unlocked ? Math.max(s.reading.level, Math.min(maxLevel, level + 1)) : s.reading.level,
    best: better ? { ...s.reading.best, [level]: { accuracy, avgMs } } : s.reading.best,
  };
  save({ ...s, attempts: [attempt, ...s.attempts].slice(0, 800), reading });
  return { unlocked: unlocked && level < maxLevel };
}

export function nextLessonId(s: Store = load()): string {
  return LESSONS.find((l) => !s.lessons[l.id]?.completed)?.id ?? LESSONS[LESSONS.length - 1].id;
}

export function isUnlocked(id: string, s: Store = load()): boolean {
  const i = LESSONS.findIndex((l) => l.id === id);
  return i <= 0 || !!s.lessons[LESSONS[i - 1].id]?.completed;
}

export function attemptedToday(pred: (a: Attempt) => boolean, s: Store = load()) {
  const day = today();
  return s.attempts.some((a) => a.at.slice(0, 10) === day && pred(a));
}

const pct = (x: number) => Math.round(x * 100) + '%';

/** Texto para colar no chat com o mentor. */
export function report(days = 7): string {
  const s = load();
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  const sinceIso = new Date(since.getTime() - since.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const dayKeys = Object.keys(s.minutes).filter((d) => d >= sinceIso).sort();
  const total = dayKeys.reduce((a, d) => a + s.minutes[d], 0);
  const atts = s.attempts.filter((a) => a.at.slice(0, 10) >= sinceIso);
  const done = LESSONS.filter((l) => s.lessons[l.id]?.completedAt && s.lessons[l.id]!.completedAt!.slice(0, 10) >= sinceIso);
  const lines: string[] = [];
  lines.push(`CHECK-IN DE PIANO — últimos ${days} dias (até ${today()})`);
  lines.push(`Tempo tocando: ${Math.round(total)} min em ${dayKeys.length} dia(s)`);
  dayKeys.forEach((d) => lines.push(`  ${d}: ${Math.round(s.minutes[d])} min`));
  lines.push(`Lições concluídas no período: ${done.length ? done.map((l) => l.title).join('; ') : 'nenhuma'}`);
  const proxima = LESSONS.find((l) => l.id === nextLessonId(s));
  if (proxima) lines.push(`Próxima lição: ${proxima.title}`);
  const byItem = new Map<string, Attempt[]>();
  atts.filter((a) => a.kind !== 'leitura').forEach((a) => byItem.set(a.kind + ':' + a.id, [...(byItem.get(a.kind + ':' + a.id) ?? []), a]));
  const reads = atts.filter((a) => a.kind === 'leitura');
  lines.push(`Leitura relâmpago: nível liberado ${s.reading.level}; ${reads.length} rodada(s) no período`);
  if (reads.length) {
    const r = reads[0];
    lines.push(`  última: ${r.title} — ${pct(r.accuracy)} de acerto, ${(r.avgOffsetMs / 1000).toFixed(1)} s por nota`);
  }
  const due = dueReviews(s);
  if (due.length) lines.push(`Revisões pendentes: ${due.map((id) => LESSONS.find((l) => l.id === id)!.title).join('; ')}`);
  const viaTeste = LESSONS.filter((l) => s.lessons[l.id]?.viaTeste);
  if (viaTeste.length) lines.push(`Pulei por nivelamento: ${viaTeste.map((l) => l.title).join('; ')}`);
  lines.push('');
  lines.push('O que pratiquei:');
  if (!byItem.size) lines.push('  (nenhuma tentativa registrada)');
  byItem.forEach((list) => {
    const a0 = list[0];
    const tempo = list.filter((a) => a.mode === 'tempo');
    const best = tempo.reduce((m, a) => (a.accuracy > m.accuracy ? a : m), tempo[0] ?? a0);
    const hands = a0.hands.length === 2 ? 'mãos juntas' : a0.hands[0] === 'R' ? 'direita' : 'esquerda';
    lines.push(`  • ${a0.title} (${a0.kind === 'licao' ? 'lição' : a0.kind === 'teste' ? 'teste de módulo' : 'música'}, ${hands}) — ${list.length} tentativa(s), ${tempo.length} no modo tempo`);
    if (tempo.length) {
      lines.push(`    melhor: ${pct(best.accuracy)} de precisão${best.bpm ? ` a ${best.bpm} BPM` : ` a ${Math.round(best.speed * 100)}% da velocidade`}; desvio médio ${Math.round(best.avgOffsetMs)} ms`);
    }
    const trouble = new Map<number, number>();
    list.forEach((a) => a.troubleMeasures.forEach((m) => trouble.set(m, (trouble.get(m) ?? 0) + 1)));
    const top = [...trouble.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([m]) => m + 1);
    if (top.length) lines.push(`    compassos onde mais errei: ${top.join(', ')}`);
  });
  return lines.join('\n');
}

export function exportJson(): string {
  return JSON.stringify(load(), null, 2);
}

export function importJson(text: string) {
  const data = JSON.parse(text);
  if (data?.version !== 1) throw new Error('Arquivo de progresso inválido.');
  save({ ...empty(), ...data });
}
