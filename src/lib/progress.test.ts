import { beforeEach, describe, expect, it, vi } from 'vitest';

const base = { mode: 'tempo' as const, hands: ['R' as const], speed: 1, hits: 9, total: 10, wrong: 0, avgOffsetMs: 0, loop: null, troubleMeasures: [], early: 0, late: 0 };
const res = (accuracy: number) => ({ total: 10, hits: Math.round(accuracy * 10), missed: 0, wrong: 0, accuracy, avgOffsetMs: 0, troubleMeasures: [], early: 0, late: 0 });

describe('progresso', () => {
  beforeEach(() => { vi.resetModules(); vi.useRealTimers(); });

  it('conclui a lição na meta e agenda revisão para amanhã; revisão aprovada sobe o intervalo', async () => {
    const p = await import('./progress');
    const goal = { bpm: 60, accuracy: 0.9 };
    let r = p.recordAttempt({ ...base, kind: 'licao', id: '1a', title: '1a', bpm: 60, accuracy: 0.95 }, res(0.95), goal);
    expect(r.passed).toBe(true);
    expect(r.lesson.review).toEqual({ due: p.addDays(p.today(), 1), step: 0 });
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.now() + 86400000 * 1.2));
    expect(p.dueReviews()).toContain('1a');
    r = p.recordAttempt({ ...base, kind: 'licao', id: '1a', title: '1a', bpm: 60, accuracy: 0.95 }, res(0.95), goal);
    expect(r.lesson.review?.step).toBe(1);
    expect(p.dueReviews()).not.toContain('1a');
  });

  it('teste de módulo aprovado marca as lições do módulo, mas não as peças', async () => {
    const p = await import('./progress');
    const r = p.recordAttempt({ ...base, kind: 'teste', id: '1c', title: 't', bpm: 60, accuracy: 0.95 }, res(0.95), { bpm: 60, accuracy: 0.9 }, 'N1');
    expect(r.moduleCleared).toBe(true);
    const s = p.load();
    expect(['1a', '1b', '1c'].every((id) => s.lessons[id]?.completed)).toBe(true);
    expect(s.lessons['1p']?.completed).toBeFalsy();
    expect(p.nextLessonId()).toBe('1p');
  });

  it('leitura libera o próximo nível só com 90% e até 2,5 s', async () => {
    const p = await import('./progress');
    expect(p.recordReading(1, 'n1', 0.85, 1500, 17, 20, 3, 7).unlocked).toBe(false);
    expect(p.recordReading(1, 'n1', 0.95, 3000, 19, 20, 1, 7).unlocked).toBe(false);
    expect(p.recordReading(1, 'n1', 0.95, 2000, 19, 20, 1, 7).unlocked).toBe(true);
    expect(p.load().reading.level).toBe(2);
  });
});
