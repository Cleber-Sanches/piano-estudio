import { beforeEach, describe, expect, it, vi } from 'vitest';

// localStorage simples para o ambiente de teste (node)
const mem = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => { mem.set(k, String(v)); },
  removeItem: (k: string) => { mem.delete(k); },
  clear: () => mem.clear(),
});
import { allMissions, GAMES, LEVELS } from './curriculum';
import { LESSONS } from './lessons';
import { BUILTIN_PIECES } from './pieces';

describe('trilha', () => {
  it('toda lição existente aparece uma vez na trilha, e todo jogo da trilha existe', () => {
    const ids = allMissions().filter((m) => m.kind === 'licao').map((m) => (m as { id: string }).id);
    expect([...ids].sort()).toEqual(LESSONS.map((l) => l.id).sort());
    for (const m of allMissions()) if (m.kind === 'jogo') expect(GAMES[m.id]).toBeTruthy();
    expect(LEVELS.map((l) => l.n)).toEqual([1, 2, 3, 4, 5]);
  });

  it('peças embutidas montam sem erro e as duas mãos terminam no mesmo compasso', () => {
    for (const pc of BUILTIN_PIECES) {
      const s = pc.build(pc.bpm, ['R', 'L']);
      expect(s.notes.length).toBeGreaterThan(0);
      const end = (h: 'R' | 'L') => Math.max(0, ...s.notes.filter((n) => n.hand === h).map((n) => n.beat + n.beats));
      if (s.notes.some((n) => n.hand === 'L')) expect(Math.abs(end('L') - end('R'))).toBeLessThan(s.beatsPerMeasure);
    }
  });
});

describe('perfis', () => {
  beforeEach(() => { localStorage.clear(); vi.resetModules(); });

  it('cada perfil tem progresso separado; o primeiro usa a chave antiga', async () => {
    const prof = await import('./profiles');
    const p = await import('./progress');
    p.recordGame('eco-3', 'Eco', 1, true);
    expect(JSON.parse(localStorage.getItem('piano-estudio:v1')!).games['eco-3'].done).toBe(true);

    const kid = prof.addProfile({ name: 'Ana', kind: 'crianca', birth: '2027-05-01' });
    expect(prof.activeProfile().id).toBe(kid.id);
    expect(p.load().games['eco-3']).toBeUndefined();
    p.recordGame('kid-ritmo', 'Ritmo', 0.5, true);
    expect(localStorage.getItem('piano-estudio:v1:' + kid.id)).toContain('kid-ritmo');

    prof.switchProfile(prof.FIRST_ID);
    expect(p.load().games['eco-3'].done).toBe(true);
    expect(p.load().games['kid-ritmo']).toBeUndefined();

    prof.removeProfile(kid.id);
    expect(localStorage.getItem('piano-estudio:v1:' + kid.id)).toBeNull();
    expect(prof.profiles()).toHaveLength(1);
  });

  it('jogo não aprovado conta tentativa mas não conclui; melhor nota fica guardada', async () => {
    const p = await import('./progress');
    p.recordGame('eco-4', 'Eco 4', 0.5, false);
    p.recordGame('eco-4', 'Eco 4', 0.25, false);
    const g = p.load().games['eco-4'];
    expect(g.done).toBe(false);
    expect(g.best).toBe(0.5);
    expect(g.plays).toBe(2);
  });

  it('idade em meses, inclusive antes de nascer', async () => {
    const { ageMonths, ageLabel } = await import('./profiles');
    const now = new Date('2026-11-11T12:00:00');
    expect(ageMonths('2027-05-01', now)).toBeLessThan(0);
    expect(ageMonths('2024-11-11', now)).toBe(24);
    expect(ageLabel(24)).toBe('2 anos');
    expect(ageLabel(-3)).toBe('ainda vai nascer');
  });
});
