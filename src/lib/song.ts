import { Midi } from '@tonejs/midi';
import type { Hand, Mode } from './theory';

export interface SongNote {
  id: number;
  midi: number;
  /** Início em segundos (velocidade 100%). */
  start: number;
  dur: number;
  /** Início e duração em tempos (semínima = 1). */
  beat: number;
  beats: number;
  hand: Hand;
  velocity: number;
  finger?: number;
}

export interface Song {
  title: string;
  notes: SongNote[];
  /** Compasso: [numerador, denominador]. */
  timeSig: [number, number];
  /** Tempos (semínimas) por compasso. */
  beatsPerMeasure: number;
  /** Armadura para a partitura (ex.: "G", "Am"). */
  key: string;
  bpm: number;
  /** Converte tempo (beats) em segundos. */
  beatToSec: (beat: number) => number;
  secToBeat: (sec: number) => number;
  totalBeats: number;
  duration: number;
}

/** Monta uma música de andamento fixo a partir de notas em tempos. */
export function fixedTempoSong(opts: {
  title: string;
  bpm: number;
  timeSig?: [number, number];
  key?: string;
  notes: Array<{ midi: number; beat: number; beats: number; hand: Hand; finger?: number; velocity?: number }>;
}): Song {
  const timeSig = opts.timeSig ?? [4, 4];
  const spb = 60 / opts.bpm;
  const notes: SongNote[] = opts.notes
    .map((n, i) => ({
      id: i,
      midi: n.midi,
      beat: n.beat,
      beats: n.beats,
      start: n.beat * spb,
      dur: n.beats * spb,
      hand: n.hand,
      finger: n.finger,
      velocity: n.velocity ?? 0.75,
    }))
    .sort((a, b) => a.start - b.start || a.midi - b.midi)
    .map((n, i) => ({ ...n, id: i }));
  const bpm = timeSig[0] * (4 / timeSig[1]);
  const last = notes.reduce((m, n) => Math.max(m, n.beat + n.beats), 0);
  const totalBeats = Math.ceil(last / bpm) * bpm;
  return {
    title: opts.title,
    notes,
    timeSig,
    beatsPerMeasure: bpm,
    key: opts.key ?? 'C',
    bpm: opts.bpm,
    beatToSec: (b) => b * spb,
    secToBeat: (s) => s / spb,
    totalBeats,
    duration: totalBeats * spb,
  };
}

export interface TrackInfo {
  index: number;
  name: string;
  noteCount: number;
  avgPitch: number;
}

export type TrackHands = Record<number, Hand | 'ignorar'>;

export function midiTracks(midi: Midi): TrackInfo[] {
  return midi.tracks
    .map((t, index) => ({
      index,
      name: t.name || t.instrument?.name || `Faixa ${index + 1}`,
      noteCount: t.notes.length,
      avgPitch: t.notes.length ? t.notes.reduce((s, n) => s + n.midi, 0) / t.notes.length : 0,
    }))
    .filter((t) => t.noteCount > 0);
}

/** Sugere mãos: a faixa mais aguda é a direita; com uma faixa só, divide no Dó central. */
export function guessHands(tracks: TrackInfo[]): TrackHands | 'split' {
  if (tracks.length <= 1) return 'split';
  const sorted = [...tracks].sort((a, b) => b.noteCount - a.noteCount).slice(0, 2);
  const [a, b] = sorted;
  const out: TrackHands = {};
  tracks.forEach((t) => (out[t.index] = 'ignorar'));
  out[a.index] = a.avgPitch >= b.avgPitch ? 'R' : 'L';
  out[b.index] = a.avgPitch >= b.avgPitch ? 'L' : 'R';
  return out;
}

/** Converte um arquivo MIDI em música. `hands` = mão por faixa, ou 'split' para dividir no Dó central. */
export function songFromMidi(midi: Midi, title: string, hands: TrackHands | 'split'): Song {
  const ppq = midi.header.ppq || 480;
  const ts = midi.header.timeSignatures[0]?.timeSignature as [number, number] | undefined;
  const timeSig: [number, number] = ts && ts[0] > 0 && ts[1] > 0 ? [ts[0], ts[1]] : [4, 4];
  const ks = midi.header.keySignatures[0];
  let key = 'C';
  if (ks) {
    const k = ks.key.replace(/^([a-g])/, (m) => m.toUpperCase());
    key = ks.scale === 'minor' ? k + 'm' : k;
    if (!/^[A-G](#|b)?m?$/.test(key)) key = 'C';
  }
  const raw: Array<Omit<SongNote, 'id'>> = [];
  midi.tracks.forEach((t, ti) => {
    const h = hands === 'split' ? null : hands[ti];
    if (h === 'ignorar' || (hands !== 'split' && h === undefined)) return;
    t.notes.forEach((n) => {
      raw.push({
        midi: n.midi,
        start: n.time,
        dur: Math.max(0.05, n.duration),
        beat: n.ticks / ppq,
        beats: Math.max(0.05, n.durationTicks / ppq),
        hand: h ?? (n.midi >= 60 ? 'R' : 'L'),
        velocity: n.velocity || 0.7,
      });
    });
  });
  raw.sort((a, b) => a.start - b.start || a.midi - b.midi);
  // Remove notas duplicadas (mesma tecla, mesmo início).
  const notes: SongNote[] = [];
  for (const n of raw) {
    const prev = notes[notes.length - 1];
    if (prev && prev.midi === n.midi && Math.abs(prev.start - n.start) < 0.01) continue;
    notes.push({ ...n, id: notes.length });
  }
  const bpm = midi.header.tempos[0]?.bpm ?? 120;
  const beatsPerMeasure = timeSig[0] * (4 / timeSig[1]);
  const lastBeat = notes.reduce((m, n) => Math.max(m, n.beat + n.beats), 0);
  const totalBeats = Math.max(beatsPerMeasure, Math.ceil(lastBeat / beatsPerMeasure - 1e-6) * beatsPerMeasure);
  const beatToSec = (b: number) => midi.header.ticksToSeconds(b * ppq);
  const secToBeat = (s: number) => midi.header.secondsToTicks(s) / ppq;
  return {
    title,
    notes,
    timeSig,
    beatsPerMeasure,
    key,
    bpm: Math.round(bpm),
    beatToSec,
    secToBeat,
    totalBeats,
    duration: beatToSec(totalBeats),
  };
}

/** Recorta um trecho [fromBeat, toBeat) mantendo os tempos originais. */
export function measureRange(song: Song, measure: number): [number, number] {
  const a = measure * song.beatsPerMeasure;
  return [a, a + song.beatsPerMeasure];
}

export function measureAt(song: Song, beat: number): number {
  return Math.max(0, Math.floor(beat / song.beatsPerMeasure + 1e-6));
}

export function measureCount(song: Song): number {
  return Math.max(1, Math.round(song.totalBeats / song.beatsPerMeasure));
}

export type { Mode };
