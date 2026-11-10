import { LESSONS } from './lessons';
import type { PassResult, PracticeMode } from '../engine/practice';
import type { Hand } from './theory';

// Progresso salvo no navegador (localStorage), com relatório para o check-in com o mentor.

export interface Attempt {
  at: string; // ISO
  kind: 'licao' | 'musica';
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
  bestAccuracy: number;
  bestBpm: number;
  attempts: number;
}

export interface Store {
  version: 1;
  lessons: Record<string, LessonProgress>;
  attempts: Attempt[];
  /** Minutos tocando por dia (AAAA-MM-DD). */
  minutes: Record<string, number>;
}

const KEY = 'piano-estudio:v1';

function empty(): Store {
  return { version: 1, lessons: {}, attempts: [], minutes: {} };
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

export const today = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export function addMinutes(sec: number) {
  if (sec <= 0) return;
  const s = load();
  const k = today();
  save({ ...s, minutes: { ...s.minutes, [k]: Math.round(((s.minutes[k] ?? 0) + sec / 60) * 10) / 10 } });
}

export function recordAttempt(a: Omit<Attempt, 'at'>, result: PassResult, goal?: { bpm: number; accuracy: number }) {
  const s = load();
  const attempt: Attempt = { ...a, at: new Date().toISOString() };
  const attempts = [attempt, ...s.attempts].slice(0, 500);
  let lessons = s.lessons;
  if (a.kind === 'licao') {
    const prev = s.lessons[a.id] ?? { completed: false, bestAccuracy: 0, bestBpm: 0, attempts: 0 };
    const effBpm = a.bpm ?? 0;
    const passed =
      !!goal && a.mode === 'tempo' && !a.loop && effBpm >= goal.bpm && result.accuracy >= goal.accuracy;
    const next: LessonProgress = {
      attempts: prev.attempts + 1,
      bestAccuracy: a.mode === 'tempo' ? Math.max(prev.bestAccuracy, result.accuracy) : prev.bestAccuracy,
      bestBpm: a.mode === 'tempo' && result.accuracy >= (goal?.accuracy ?? 0.9) ? Math.max(prev.bestBpm, effBpm) : prev.bestBpm,
      completed: prev.completed || passed,
      completedAt: prev.completedAt ?? (passed ? attempt.at : undefined),
    };
    lessons = { ...s.lessons, [a.id]: next };
  }
  save({ ...s, attempts, lessons });
  return lessons[a.id];
}

export function nextLessonId(s: Store = load()): string {
  return LESSONS.find((l) => !s.lessons[l.id]?.completed)?.id ?? LESSONS[LESSONS.length - 1].id;
}

export function isUnlocked(id: string, s: Store = load()): boolean {
  const i = LESSONS.findIndex((l) => l.id === id);
  return i <= 0 || !!s.lessons[LESSONS[i - 1].id]?.completed;
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
  atts.forEach((a) => byItem.set(a.kind + ':' + a.id, [...(byItem.get(a.kind + ':' + a.id) ?? []), a]));
  lines.push('');
  lines.push('O que pratiquei:');
  if (!byItem.size) lines.push('  (nenhuma tentativa registrada)');
  byItem.forEach((list) => {
    const a0 = list[0];
    const tempo = list.filter((a) => a.mode === 'tempo');
    const best = tempo.reduce((m, a) => (a.accuracy > m.accuracy ? a : m), tempo[0] ?? a0);
    const hands = a0.hands.length === 2 ? 'mãos juntas' : a0.hands[0] === 'R' ? 'direita' : 'esquerda';
    lines.push(`  • ${a0.title} (${a0.kind === 'licao' ? 'lição' : 'música'}, ${hands}) — ${list.length} tentativa(s), ${tempo.length} no modo tempo`);
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
