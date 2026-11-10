import { describe, expect, it } from 'vitest';
import { LESSONS } from './lessons';
import { BUILTIN_PIECES } from './pieces';
import { buildSheet, splitLen } from './sheet';
import { fixedTempoSong } from './song';

describe('partitura', () => {
  it('cada compasso de cada lição soma exatamente o compasso nas duas mãos', () => {
    for (const l of LESSONS) {
      const song = l.build(60);
      const M = song.beatsPerMeasure * 4;
      for (const m of buildSheet(song)) {
        for (const h of ['R', 'L'] as const) {
          const sum = m[h].reduce((a, it) => a + it.len, 0);
          expect(sum, `${l.id} compasso ${m.index} ${h}`).toBe(M);
        }
      }
    }
  });

  it('peças do repertório fecham os compassos', () => {
    for (const pc of BUILTIN_PIECES) {
      const song = pc.build(pc.bpm, ['R', 'L']);
      const M = song.beatsPerMeasure * 4;
      for (const m of buildSheet(song)) for (const h of ['R', 'L'] as const) expect(m[h].reduce((a, it) => a + it.len, 0), `${pc.id} ${m.index} ${h}`).toBe(M);
    }
  });

  it('liga notas que atravessam a barra de compasso', () => {
    const song = fixedTempoSong({ title: 't', bpm: 60, notes: [{ midi: 60, beat: 3, beats: 2, hand: 'R' }] });
    const s = buildSheet(song);
    expect(s[0].R.at(-1)).toMatchObject({ keys: [60], tieNext: true, len: 4 });
    expect(s[1].R[0]).toMatchObject({ keys: [60], len: 4, tieNext: false });
  });

  it('quebra durações em figuras válidas', () => {
    expect(splitLen(0, 16)).toEqual([16]);
    expect(splitLen(4, 12)).toEqual([4, 8]);
    expect(splitLen(0, 5)).toEqual([4, 1]);
  });
});
