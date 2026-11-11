import type { Song, SongNote } from '../lib/song';
import type { Hand } from '../lib/theory';

export type PracticeMode = 'espera' | 'tempo';
export type NoteState = 'pendente' | 'acerto' | 'erro' | 'auto';

export interface PracticeOptions {
  mode: PracticeMode;
  /** Mãos que VOCÊ toca. As outras tocam sozinhas. */
  hands: Hand[];
  /** 0.25 a 1.5 */
  speed: number;
  /** Trecho em tempos (beats): [início, fim). */
  loop: [number, number] | null;
  /** Janela de acerto no modo tempo, em ms reais. */
  windowMs: number;
  /** Compensação de latência do teclado, em ms. */
  latencyMs: number;
}

export interface PassResult {
  total: number;
  hits: number;
  missed: number;
  wrong: number;
  accuracy: number;
  /** Desvio médio em ms (negativo = adiantado). */
  avgOffsetMs: number;
  /** Compassos com mais erros (índice 0). */
  troubleMeasures: number[];
  /** Quantas notas certas saíram adiantadas / atrasadas (fora da janela "perfeito"). */
  early: number;
  late: number;
}

export type FeedbackKind = 'perfeito' | 'adiantado' | 'atrasado' | 'errado';

/** Último julgamento de uma tecla, para mostrar na tela por alguns instantes. */
export interface Feedback {
  kind: FeedbackKind;
  /** Desvio em ms (negativo = adiantado). */
  ms: number;
  midi: number;
  /** performance.now() de quando aconteceu. */
  at: number;
}

// Mesmas janelas do guatá-learning (em ms reais).
const PERFECT_EARLY_MS = 25;
const PERFECT_LATE_MS = 30;

export function judgeOffset(ms: number): FeedbackKind {
  if (ms < -PERFECT_EARLY_MS) return 'adiantado';
  if (ms > PERFECT_LATE_MS) return 'atrasado';
  return 'perfeito';
}

export type PracticeEvent =
  | { type: 'auto'; note: SongNote }
  | { type: 'beat'; beat: number; downbeat: boolean }
  | { type: 'pass'; result: PassResult; passIndex: number }
  | { type: 'fim'; result: PassResult };

interface Group {
  start: number;
  notes: SongNote[];
  done: Set<number>;
}

const LEAD_IN_BEATS = 2;

/**
 * Motor de prática: avança o relógio da música, segura o tempo no modo espera,
 * avalia acertos no modo tempo e repete o trecho em loop.
 * Não toca som nem desenha: emite eventos e expõe estado para a interface.
 */
export class Practice {
  readonly song: Song;
  opts: PracticeOptions;
  /** Tempo atual da música em segundos (pode ser negativo na contagem). */
  t = 0;
  playing = false;
  waiting = false;
  finished = false;
  passIndex = 0;
  state = new Map<number, NoteState>();
  offsets = new Map<number, number>();
  private wrongAt: number[] = [];
  private groups: Group[] = [];
  private groupIdx = 0;
  private autoIdx = 0;
  private lastBeat = -Infinity;
  private listeners: Array<(e: PracticeEvent) => void> = [];
  readonly held = new Set<number>();
  /** Feedbacks recentes (um por tecla) para a tela desenhar. */
  feedback: Feedback[] = [];

  private pushFeedback(kind: FeedbackKind, ms: number, midi: number) {
    const now = performance.now();
    this.feedback = this.feedback.filter((f) => f.midi !== midi && now - f.at < 1200);
    this.feedback.push({ kind, ms, midi, at: now });
  }

  constructor(song: Song, opts: PracticeOptions) {
    this.song = song;
    this.opts = opts;
    this.reset();
  }

  on(fn: (e: PracticeEvent) => void) {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter((l) => l !== fn); };
  }
  private emit(e: PracticeEvent) {
    this.listeners.forEach((l) => l(e));
  }

  get range(): [number, number] {
    const [a, b] = this.opts.loop ?? [0, this.song.totalBeats];
    return [this.song.beatToSec(a), this.song.beatToSec(b)];
  }

  get beat(): number {
    return this.t >= 0 ? this.song.secToBeat(this.t) : this.t / this.song.beatToSec(1);
  }

  isMine(n: SongNote) {
    return this.opts.hands.includes(n.hand);
  }

  /** Notas que este passe avalia (suas mãos, dentro do trecho). */
  get judged(): SongNote[] {
    const [a, b] = this.range;
    return this.song.notes.filter((n) => this.isMine(n) && n.start >= a - 1e-6 && n.start < b - 1e-6);
  }

  /** Volta ao início do trecho com contagem de 2 tempos. */
  reset() {
    const [a] = this.range;
    const spb = this.song.beatToSec(1) || 0.5;
    this.t = a - LEAD_IN_BEATS * spb;
    this.waiting = false;
    this.finished = false;
    this.state.clear();
    this.offsets.clear();
    this.wrongAt = [];
    this.feedback = [];
    this.held.clear();
    const mine = this.judged;
    mine.forEach((n) => this.state.set(n.id, 'pendente'));
    this.groups = [];
    for (const n of mine) {
      const g = this.groups[this.groups.length - 1];
      if (g && Math.abs(g.start - n.start) < 0.03) g.notes.push(n);
      else this.groups.push({ start: n.start, notes: [n], done: new Set() });
    }
    this.groupIdx = 0;
    const [ra] = this.range;
    this.autoIdx = this.song.notes.findIndex((n) => n.start >= ra - 1e-6);
    if (this.autoIdx < 0) this.autoIdx = this.song.notes.length;
    this.lastBeat = Math.floor(this.beat) - 1;
  }

  setOptions(patch: Partial<PracticeOptions>) {
    const needsReset = patch.loop !== undefined || patch.hands !== undefined || patch.mode !== undefined;
    this.opts = { ...this.opts, ...patch };
    if (needsReset) {
      this.passIndex = 0;
      this.reset();
    }
  }

  get wrongCount() {
    return this.wrongAt.length;
  }

  /** Precisão até agora (notas já avaliadas). */
  liveAccuracy(): number | null {
    let hits = 0, judged = 0;
    for (const n of this.judged) {
      const s = this.state.get(n.id);
      if (s === 'acerto') { hits++; judged++; } else if (s === 'erro') judged++;
    }
    const d = judged + this.wrongAt.length;
    return d ? hits / d : null;
  }

  get currentGroup(): Group | undefined {
    return this.groups[this.groupIdx];
  }

  /** Teclas que a interface deve sugerir agora. */
  hintKeys(): number[] {
    const g = this.currentGroup;
    if (!g) return [];
    if (this.opts.mode === 'espera' || g.start - this.t < 0.35) return g.notes.filter((n) => !g.done.has(n.id)).map((n) => n.midi);
    return [];
  }

  /** Avança `dtReal` segundos de relógio real. */
  tick(dtReal: number) {
    if (!this.playing || this.finished) return;
    const prevT = this.t;
    let next = this.t + dtReal * this.opts.speed;

    if (this.opts.mode === 'espera') {
      const g = this.currentGroup;
      if (g && next >= g.start) {
        next = g.start;
        this.waiting = true;
      } else {
        this.waiting = false;
      }
    } else {
      const win = this.windowSec();
      for (const n of this.judged) {
        if (this.state.get(n.id) === 'pendente' && n.start < next - win) this.state.set(n.id, 'erro');
      }
      while (this.currentGroup && this.currentGroup.notes.every((n) => this.state.get(n.id) !== 'pendente')) this.groupIdx++;
    }

    this.t = next;
    this.emitAuto(prevT, next);
    this.emitBeats();

    const [, end] = this.range;
    if (this.t >= end && !this.currentGroupPendingBefore(end)) this.endPass();
  }

  private currentGroupPendingBefore(end: number) {
    const g = this.currentGroup;
    return !!g && g.start < end && this.opts.mode === 'espera';
  }

  private windowSec() {
    return (this.opts.windowMs / 1000) * this.opts.speed;
  }

  private emitAuto(from: number, to: number) {
    const [, end] = this.range;
    while (this.autoIdx < this.song.notes.length) {
      const n = this.song.notes[this.autoIdx];
      if (n.start > to || n.start >= end) break;
      if (n.start >= from - 1e-6 && !this.isMine(n)) {
        this.state.set(n.id, 'auto');
        this.emit({ type: 'auto', note: n });
      }
      this.autoIdx++;
    }
  }

  private emitBeats() {
    const b = Math.floor(this.beat + 1e-6);
    if (b > this.lastBeat) {
      this.lastBeat = b;
      const bpm = this.song.beatsPerMeasure;
      this.emit({ type: 'beat', beat: b, downbeat: ((b % bpm) + bpm) % bpm === 0 });
    }
  }

  /** Você apertou uma tecla. `atReal` = performance.now() em ms (para compensar latência). */
  noteOn(midi: number) {
    this.held.add(midi);
    if (!this.playing || this.finished) return;
    if (this.opts.mode === 'espera') {
      const g = this.currentGroup;
      if (!g) return;
      // só aceita quando a nota já está chegando (até ~meio tempo antes)
      const early = Math.max(0.3, this.song.beatToSec(0.5));
      if (g.start - this.t > early) {
        this.wrongAt.push(this.t);
        this.pushFeedback('adiantado', ((this.t - g.start) / this.opts.speed) * 1000, midi);
        return;
      }
      const hit = g.notes.find((n) => n.midi === midi && !g.done.has(n.id));
      if (hit) {
        g.done.add(hit.id);
        this.state.set(hit.id, 'acerto');
        this.pushFeedback('perfeito', 0, midi);
        if (g.done.size === g.notes.length) {
          this.groupIdx++;
          this.waiting = false;
        }
      } else if (!g.notes.some((n) => n.midi === midi)) {
        this.wrongAt.push(this.t);
        this.pushFeedback('errado', 0, midi);
      }
      return;
    }
    const tNow = this.t - (this.opts.latencyMs / 1000) * this.opts.speed;
    const win = this.windowSec();
    let best: SongNote | null = null;
    for (const n of this.judged) {
      if (n.midi !== midi || this.state.get(n.id) !== 'pendente') continue;
      const d = Math.abs(n.start - tNow);
      if (d <= win && (!best || d < Math.abs(best.start - tNow))) best = n;
    }
    if (best) {
      this.state.set(best.id, 'acerto');
      const off = ((tNow - best.start) / this.opts.speed) * 1000;
      this.offsets.set(best.id, off);
      this.pushFeedback(judgeOffset(off), off, midi);
    } else {
      this.wrongAt.push(this.t);
      this.pushFeedback('errado', 0, midi);
    }
  }

  noteOff(midi: number) {
    this.held.delete(midi);
  }

  result(): PassResult {
    const mine = this.judged;
    const hits = mine.filter((n) => this.state.get(n.id) === 'acerto').length;
    const missed = mine.length - hits;
    const wrong = this.wrongAt.length;
    const denom = mine.length + wrong;
    const offs = [...this.offsets.values()];
    const perMeasure = new Map<number, number>();
    const add = (beat: number) => {
      const m = Math.floor(beat / this.song.beatsPerMeasure + 1e-6);
      perMeasure.set(m, (perMeasure.get(m) ?? 0) + 1);
    };
    mine.filter((n) => this.state.get(n.id) !== 'acerto').forEach((n) => add(n.beat));
    this.wrongAt.forEach((t) => add(this.song.secToBeat(Math.max(0, t))));
    const troubleMeasures = [...perMeasure.entries()]
      .filter(([, c]) => c > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([m]) => m);
    return {
      total: mine.length,
      hits,
      missed,
      wrong,
      accuracy: denom ? hits / denom : 1,
      avgOffsetMs: offs.length ? offs.reduce((a, b) => a + b, 0) / offs.length : 0,
      troubleMeasures,
      early: offs.filter((o) => judgeOffset(o) === 'adiantado').length,
      late: offs.filter((o) => judgeOffset(o) === 'atrasado').length,
    };
  }

  private endPass() {
    const result = this.result();
    if (this.opts.loop) {
      this.emit({ type: 'pass', result, passIndex: this.passIndex });
      this.passIndex++;
      this.reset();
    } else {
      this.finished = true;
      this.playing = false;
      this.emit({ type: 'fim', result });
    }
  }
}
