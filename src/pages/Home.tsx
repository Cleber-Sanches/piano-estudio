import { useState, useSyncExternalStore } from 'react';
import { LESSONS, MODULES } from '../lib/lessons';
import { isUnlocked, load, nextLessonId, report, subscribe, today } from '../lib/progress';

export function Home({ open }: { open: (lessonId: string) => void }) {
  const store = useSyncExternalStore(subscribe, load);
  const [copied, setCopied] = useState<'ok' | 'erro' | null>(null);
  const [showReport, setShowReport] = useState(false);
  const next = nextLessonId(store);
  const nextLesson = LESSONS.find((l) => l.id === next)!;
  const done = LESSONS.filter((l) => store.lessons[l.id]?.completed).length;

  const days: string[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10));
  }
  const maxMin = Math.max(20, ...days.map((d) => store.minutes[d] ?? 0));
  const week = days.slice(7).reduce((a, d) => a + (store.minutes[d] ?? 0), 0);

  const copy = async () => {
    const text = report(7);
    try {
      await navigator.clipboard.writeText(text);
      setCopied('ok');
    } catch {
      setCopied('erro');
      setShowReport(true);
    }
  };

  return (
    <div className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">Fase 1 · Fundamentos · {done}/{LESSONS.length} lições</p>
          <h1>Próxima: {nextLesson.title}</h1>
          <p className="muted">{nextLesson.tip}</p>
        </div>
        <button className="btn big" onClick={() => open(next)}>Começar lição</button>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Sua semana</h2>
          <span className="muted"><b className="mono">{Math.round(week)}</b> min nos últimos 7 dias</span>
        </div>
        <div className="bars" aria-label="Minutos por dia nas últimas duas semanas">
          {days.map((d) => {
            const m = store.minutes[d] ?? 0;
            return <div key={d} className={'bar' + (m ? ' on' : '') + (d === today() ? ' today' : '')} style={{ height: `${m ? Math.max(6, (m / maxMin) * 100) : 3}%` }} title={`${d.slice(8)}/${d.slice(5, 7)}: ${Math.round(m)} min`} />;
          })}
        </div>
        <div className="actions">
          <button className="btn ghost" onClick={copy}>Copiar relatório para o mentor</button>
          <button className="btn ghost" onClick={() => setShowReport((s) => !s)}>{showReport ? 'Esconder relatório' : 'Ver relatório'}</button>
          {copied === 'ok' && <span className="ok">Copiado. Cole no chat com o Claude.</span>}
          {copied === 'erro' && <span className="warn">Não consegui copiar; selecione o texto abaixo.</span>}
        </div>
        {showReport && <textarea className="report" readOnly value={report(7)} rows={12} onFocus={(e) => e.currentTarget.select()} />}
      </section>

      {MODULES.map((mod) => (
        <section key={mod.id} className="module">
          <div className="module-head">
            <h2>{mod.title}</h2>
            <p className="muted">{mod.intro}</p>
          </div>
          <div className="lesson-list">
            {LESSONS.filter((l) => l.module === mod.id).map((l) => {
              const p = store.lessons[l.id];
              const unlocked = isUnlocked(l.id, store);
              const status = p?.completed ? 'feita' : l.id === next ? 'atual' : unlocked ? 'aberta' : 'bloqueada';
              return (
                <button key={l.id} className={'lesson ' + status} onClick={() => open(l.id)}>
                  <span className="lesson-dot" aria-hidden="true" />
                  <span className="lesson-main">
                    <span className="lesson-title">{l.title}</span>
                    <span className="lesson-meta">
                      {p?.completed
                        ? `Concluída · melhor ${Math.round(p.bestAccuracy * 100)}% a ${p.bestBpm} BPM`
                        : status === 'bloqueada'
                          ? 'Conclua a lição anterior primeiro (pode abrir para ver)'
                          : `Meta: ${l.goalBpm} BPM com ${Math.round(l.goalAccuracy * 100)}%` + (p?.attempts ? ` · ${p.attempts} tentativa(s)` : '')}
                    </span>
                  </span>
                  <span className="lesson-tag">{status === 'feita' ? '✓' : status === 'atual' ? 'Agora' : ''}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
