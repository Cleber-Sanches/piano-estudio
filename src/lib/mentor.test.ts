import { describe, expect, it } from 'vitest';
import { emptyMind, mastery, nextRound, phrasesOf, songFor, stepLevel, updateSkill, type Mind } from './mentor';

const DAY = '2026-11-12';
const fixed = () => 0.1; // sem sorteio: encadeamento sempre acontece quando possível

function withSkill(m: Mind, key: string, score: number, times = 4): Mind {
  for (let i = 0; i < times; i++) m = updateSkill(m, key, score, DAY);
  return m;
}

describe('professor adaptativo', () => {
  it('quebra a música em frases com notas e sem buracos', () => {
    for (const id of ['ode', 'brilha', 'mary']) {
      const ph = phrasesOf(songFor(emptyMind(id)));
      expect(ph.length).toBeGreaterThan(2);
      ph.forEach((p, i) => {
        expect(p.i).toBe(i);
        expect(p.notes.length).toBeGreaterThanOrEqual(3);
        expect(p.notes.every((n) => n.hand === 'R')).toBe(true);
      });
    }
  });

  it('aluno novo começa tocando a primeira frase com as teclas acesas', () => {
    const m = emptyMind('ode');
    const r = nextRound(m, songFor(m), [], DAY, fixed);
    expect(r).toMatchObject({ kind: 'frase', phrases: [0], hint: 'tecla' });
  });

  it('tecla fraca vira exercício de eco com o pedaço real da frase', () => {
    let m = emptyMind('ode');
    const song = songFor(m);
    const p0 = phrasesOf(song)[0];
    const weak = p0.notes[2].midi;
    m = withSkill(m, 'frase:ode:0', 0.4, 1);
    p0.notes.forEach((n) => { m = withSkill(m, 'tecla:' + n.midi, n.midi === weak ? 0.2 : 1); m = withSkill(m, 'ler:' + n.midi, 1); });
    const r = nextRound(m, song, ['frase'], DAY, fixed);
    expect(r.kind).toBe('eco');
    if (r.kind === 'eco') expect(r.notes).toContain(weak);
  });

  it('ritmo fraco vira rodada de ritmo numa tecla só', () => {
    let m = emptyMind('ode');
    const song = songFor(m);
    const p0 = phrasesOf(song)[0];
    m = withSkill(m, 'frase:ode:0', 0.4, 1);
    p0.notes.forEach((n) => { m = withSkill(m, 'tecla:' + n.midi, 1); m = withSkill(m, 'ler:' + n.midi, 1); });
    m = withSkill(m, 'ritmo:1', 0.1);
    const r = nextRound(m, song, ['frase'], DAY, fixed);
    expect(r.kind).toBe('ritmo');
  });

  it('com tudo dominado, toca a música inteira', () => {
    let m = emptyMind('ode');
    const song = songFor(m);
    phrasesOf(song).forEach((p) => { m = withSkill(m, `frase:ode:${p.i}`, 1, 6); });
    const r = nextRound(m, song, ['frase', 'eco'], DAY, fixed);
    expect(r.kind).toBe('frase');
    if (r.kind === 'frase') expect(r.phrases.length).toBe(phrasesOf(song).length);
  });

  it('a leitura entra a cada poucas rodadas', () => {
    let m = emptyMind('ode');
    const song = songFor(m);
    m = withSkill(m, 'frase:ode:0', 0.5, 1);
    const r = nextRound(m, song, ['frase', 'frase', 'frase'], DAY, fixed);
    expect(r.kind).toBe('ler');
  });

  it('domínio sobe com acertos e a escada de dificuldade mexe nos dois sentidos', () => {
    let m = emptyMind();
    m = withSkill(m, 'tecla:60', 1, 5);
    expect(mastery(m, 'tecla:60', DAY)).toBeGreaterThan(0.9);
    expect(stepLevel(3, 0.95)).toBe(4);
    expect(stepLevel(3, 0.4)).toBe(2);
    expect(stepLevel(1, 0.1)).toBe(1);
    expect(stepLevel(3, 0.75)).toBe(3);
  });
});
