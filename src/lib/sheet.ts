import type { Song } from './song';
import type { Hand } from './theory';

// Quantiza as notas em compassos para desenhar a partitura (grade de semicolcheia).

export interface SheetItem {
  /** Posição dentro do compasso, em semicolcheias. */
  pos: number;
  /** Duração em semicolcheias (uma figura simples ou pontuada). */
  len: number;
  /** Teclas MIDI; vazio = pausa. */
  keys: number[];
  noteIds: number[];
  /** Ligada à próxima figura (mesmas notas). */
  tieNext: boolean;
}

export interface SheetMeasure {
  index: number;
  R: SheetItem[];
  L: SheetItem[];
}

const FIGURES = [16, 12, 8, 6, 4, 3, 2, 1];

/** Quebra uma duração em figuras, respeitando os tempos do compasso quando possível. */
export function splitLen(pos: number, len: number): number[] {
  const out: number[] = [];
  let p = pos;
  let left = len;
  while (left > 0) {
    // não atravessa o meio do compasso nem o tempo quando começa fora dele
    let limit = left;
    if (p % 4 !== 0) limit = Math.min(limit, 4 - (p % 4));
    else if (p % 8 !== 0) limit = Math.min(limit, 8 - (p % 8));
    let pick = 1;
    for (const f of FIGURES) {
      if (f > limit) continue;
      pick = f;
      break;
    }
    out.push(pick);
    p += pick;
    left -= pick;
  }
  return out;
}

export function buildSheet(song: Song): SheetMeasure[] {
  const M = Math.round(song.beatsPerMeasure * 4);
  const count = Math.max(1, Math.round(song.totalBeats / song.beatsPerMeasure));
  const measures: SheetMeasure[] = Array.from({ length: count }, (_, i) => ({ index: i, R: [], L: [] }));

  (['R', 'L'] as Hand[]).forEach((hand) => {
    type G = { start: number; len: number; keys: number[]; ids: number[] };
    const groups: G[] = [];
    song.notes
      .filter((n) => n.hand === hand)
      .forEach((n) => {
        const s = Math.round(n.beat * 4);
        const e = Math.max(s + 1, Math.round((n.beat + n.beats) * 4));
        const g = groups.find((x) => x.start === s);
        if (g) {
          if (!g.keys.includes(n.midi)) g.keys.push(n.midi);
          g.ids.push(n.id);
          g.len = Math.min(g.len, e - s);
        } else groups.push({ start: s, len: e - s, keys: [n.midi], ids: [n.id] });
      });
    groups.sort((a, b) => a.start - b.start);
    groups.forEach((g, i) => {
      const next = groups[i + 1];
      if (next) g.len = Math.max(1, Math.min(g.len, next.start - g.start));
      g.keys.sort((a, b) => a - b);
    });

    let gi = 0;
    for (let m = 0; m < count; m++) {
      const items: SheetItem[] = [];
      const m0 = m * M, m1 = m0 + M;
      let pos = m0;
      // nota ligada vinda do compasso anterior
      const prev = measures[m - 1]?.[hand];
      const carry = prev && prev.length ? prev[prev.length - 1] : null;
      if (carry && carry.tieNext) {
        const g = groups[gi - 1];
        const end = g.start + g.len;
        const segEnd = Math.min(end, m1);
        const parts = splitLen(0, segEnd - pos);
        let p = pos - m0;
        parts.forEach((len, k) => {
          items.push({ pos: p, len, keys: g.keys, noteIds: [], tieNext: k < parts.length - 1 || end > m1 });
          p += len;
        });
        pos = segEnd;
      }
      while (pos < m1) {
        const g = groups[gi];
        if (g && g.start < pos) { gi++; continue; }
        if (g && g.start === pos) {
          const end = g.start + g.len;
          const segEnd = Math.min(end, m1);
          const parts = splitLen(pos - m0, segEnd - pos);
          let p = pos - m0;
          parts.forEach((len, k) => {
            items.push({ pos: p, len, keys: g.keys, noteIds: k === 0 ? g.ids : [], tieNext: k < parts.length - 1 || end > m1 });
            p += len;
          });
          pos = segEnd;
          gi++;
        } else {
          const restEnd = Math.min(m1, g ? g.start : m1);
          splitLen(pos - m0, restEnd - pos).reduce((p, len) => {
            items.push({ pos: p, len, keys: [], noteIds: [], tieNext: false });
            return p + len;
          }, pos - m0);
          pos = restEnd;
        }
      }
      measures[m][hand] = items;
    }
  });
  return measures;
}

const DUR: Record<number, string> = { 16: 'w', 12: 'h', 8: 'h', 6: 'q', 4: 'q', 3: '8', 2: '8', 1: '16' };
export const vexDuration = (len: number) => DUR[len] ?? '16';
export const isDotted = (len: number) => len === 12 || len === 6 || len === 3;

const FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm', 'Abm']);
const SHARP = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
const FLAT = ['c', 'db', 'd', 'eb', 'e', 'f', 'gb', 'g', 'ab', 'a', 'bb', 'b'];

export function vexKey(midi: number, key: string): string {
  const names = FLAT_KEYS.has(key) ? FLAT : SHARP;
  return `${names[((midi % 12) + 12) % 12]}/${Math.floor(midi / 12) - 1}`;
}
