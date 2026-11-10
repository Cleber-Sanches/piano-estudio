import { describe, expect, it } from 'vitest';
import { fixedTempoSong } from '../lib/song';
import { Practice } from './practice';

const song = fixedTempoSong({
  title: 'teste',
  bpm: 60,
  notes: [
    { midi: 60, beat: 0, beats: 1, hand: 'R' },
    { midi: 62, beat: 1, beats: 1, hand: 'R' },
    { midi: 48, beat: 1, beats: 1, hand: 'L' },
    { midi: 64, beat: 2, beats: 1, hand: 'R' },
    { midi: 65, beat: 3, beats: 1, hand: 'R' },
  ],
});

const base = { speed: 1, loop: null, windowMs: 150, latencyMs: 0 } as const;

function run(p: Practice, seconds: number, step = 0.01) {
  for (let s = 0; s < seconds; s += step) p.tick(step);
}

describe('modo espera', () => {
  it('segura o relógio até a nota certa e conta notas erradas', () => {
    const p = new Practice(song, { ...base, mode: 'espera', hands: ['R'] });
    p.playing = true;
    run(p, 5);
    expect(p.waiting).toBe(true);
    expect(p.t).toBeCloseTo(0, 5);
    p.noteOn(61); // errada
    p.noteOn(60);
    expect(p.waiting).toBe(false);
    run(p, 3);
    expect(p.t).toBeCloseTo(1, 5);
    p.noteOn(62);
    run(p, 3);
    p.noteOn(64);
    run(p, 3);
    p.noteOn(65);
    run(p, 3);
    expect(p.finished).toBe(true);
    const r = p.result();
    expect(r.hits).toBe(4);
    expect(r.wrong).toBe(1);
  });

  it('toca sozinha a mão que você não pratica', () => {
    const p = new Practice(song, { ...base, mode: 'espera', hands: ['R'] });
    const autos: number[] = [];
    p.on((e) => e.type === 'auto' && autos.push(e.note.midi));
    p.playing = true;
    run(p, 3);
    p.noteOn(60);
    run(p, 2);
    expect(autos).toEqual([48]);
  });
});

describe('modo tempo', () => {
  it('avalia acertos dentro da janela e perdas fora dela', () => {
    const p = new Practice(song, { ...base, mode: 'tempo', hands: ['R'] });
    p.playing = true;
    run(p, 2.0); // chega no tempo 0 (contagem de 2 tempos)
    p.noteOn(60);
    run(p, 1.05);
    p.noteOn(62); // 50 ms atrasado
    run(p, 3.5); // 64 e 65 passam sem tocar
    expect(p.finished).toBe(true);
    const r = p.result();
    expect(r.hits).toBe(2);
    expect(r.missed).toBe(2);
    expect(r.avgOffsetMs).toBeGreaterThan(0);
  });
});

describe('loop', () => {
  it('repete o trecho e emite o resultado de cada passada', () => {
    const p = new Practice(song, { ...base, mode: 'espera', hands: ['R'], loop: [2, 4] });
    const passes: number[] = [];
    p.on((e) => e.type === 'pass' && passes.push(e.result.hits));
    p.playing = true;
    for (let i = 0; i < 2; i++) {
      run(p, 3);
      p.noteOn(64);
      run(p, 2);
      p.noteOn(65);
      run(p, 2);
    }
    expect(passes).toEqual([2, 2]);
    expect(p.finished).toBe(false);
  });
});

describe('modo espera, tecla cedo demais', () => {
  it('não aceita a nota antes de ela chegar perto', () => {
    const p = new Practice(song, { ...base, mode: 'espera', hands: ['R'] });
    p.playing = true;
    run(p, 0.2); // ainda na contagem, 1,8 s antes da primeira nota
    p.noteOn(60);
    expect(p.state.get(0)).toBe('pendente');
    expect(p.wrongCount).toBe(1);
    run(p, 3);
    p.noteOn(60);
    expect(p.state.get(0)).toBe('acerto');
  });
});
