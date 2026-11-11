import { useEffect, useState, useSyncExternalStore } from 'react';
import { listSongs, type StoredSong } from '../lib/library';
import { LESSONS, MODULES } from '../lib/lessons';
import { attemptedToday, dueReviews, isUnlocked, load, moduleDone, nextLessonId, report, subscribe, today } from '../lib/progress';

interface PlanItem {
  key: string;
  title: string;
  detail: string;
  minutes: number;
  done: boolean;
  href: string;
}

export function Home() {
  const store = useSyncExternalStore(subscribe, load);
  const [songs, setSongs] = useState<StoredSong[]>([]);
  const [copied, setCopied] = useState<'ok' | 'erro' | null>(null);
  const [showReport, setShowReport] = useState(false);
  useEffect(() => { listSongs().then(setSongs).catch(() => setSongs([])); }, []);

  const next = nextLessonId(store);
  const nextLesson = LESSONS.find((l) => l.id === next)!;
  const reviews = dueReviews(store);
  const done = LESSONS.filter((l) => store.lessons[l.id]?.completed).length;

  // plano de hoje
  const plan: PlanItem[] = [];
  const reviewToday = reviews.slice(0, 2);
  if (reviewToday.length) {
    plan.push({
      key: 'rev', title: 'Aquecimento: revisão', minutes: 5 * reviewToday.length,
      detail: reviewToday.map((id) => LESSONS.find((l) => l.id === id)!.title).join(' · ') + '. Uma passada no modo tempo, na meta.',
      done: reviewToday.every((id) => attemptedToday((a) => a.id === id && a.mode === 'tempo', store)),
      href: '#/licao/' + (reviewToday.find((id) => !attemptedToday((a) => a.id === id && a.mode === 'tempo', store)) ?? reviewToday[0]),
    });
  }
  plan.push({
    key: 'leitura', title: 'Leitura relâmpago', minutes: 5,
    detail: `Nível ${store.reading.level}. Uma rodada de 20 notas.`,
    done: attemptedToday((a) => a.kind === 'leitura', store),
    href: '#/leitura',
  });
  const nextDoneToday = attemptedToday((a) => a.kind === 'licao' && a.id === next, store) || !!store.lessons[next]?.completedAt?.startsWith(today());
  plan.push({
    key: 'licao', title: nextLesson.kind === 'peca' ? 'Peça nova' : 'Lição nova', minutes: 12,
    detail: (() => {
      const p = store.lessons[next];
      if (!p?.attempts || p.completed) return `${nextLesson.title}. Comece no modo espera; quando sair limpo, modo tempo.`;
      const meta = `${nextLesson.goalBpm} BPM no modo tempo com ${Math.round(nextLesson.goalAccuracy * 100)}% de acerto`;
      const melhor = p.bestBpm ? `seu melhor: ${p.bestBpm} BPM` : 'ainda sem passada no modo tempo';
      return `${nextLesson.title}. Continua aqui até chegar a ${meta} (${melhor}).`;
    })(),
    done: nextDoneToday,
    href: '#/licao/' + next,
  });
  if (songs.length) {
    const lastMusic = store.attempts.find((a) => a.kind === 'musica');
    const song = songs.find((s) => s.id === lastMusic?.id) ?? songs[0];
    plan.push({
      key: 'musica', title: 'Sua música', minutes: 10,
      detail: `${song.name}. Escolha 2 compassos difíceis, “Repetir compassos”, até 3 passadas limpas.`,
      done: attemptedToday((a) => a.kind === 'musica', store),
      href: '#/musica/' + song.id,
    });
  } else {
    plan.push({
      key: 'musica', title: 'Sua música', minutes: 10,
      detail: 'Adicione a música do Synthesia que você quer terminar. Ela entra no plano todo dia.',
      done: false, href: '#/musicas',
    });
  }
  const planMin = plan.reduce((a, p) => a + p.minutes, 0);
  const planDone = plan.filter((p) => p.done).length;

  const days: string[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10));
  }
  const maxMin = Math.max(20, ...days.map((d) => store.minutes[d] ?? 0));
  const week = days.slice(7).reduce((a, d) => a + (store.minutes[d] ?? 0), 0);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report(7));
      setCopied('ok');
    } catch {
      setCopied('erro');
      setShowReport(true);
    }
  };

  return (
    <div className="page">
      <section className="plan">
        <div className="plan-head">
          <div>
            <p className="eyebrow">Fase 1 · Fundamentos · {done}/{LESSONS.length} concluídas</p>
            <h1>Plano de hoje</h1>
            <p className="muted">Cerca de {planMin} minutos, nesta ordem. {planDone === plan.length ? 'Tudo feito hoje. Bom trabalho.' : `${planDone} de ${plan.length} feitos.`}</p>
          </div>
        </div>
        <ol className="plan-list">
          {plan.map((p) => (
            <li key={p.key} className={p.done ? 'done' : ''}>
              <a href={p.href}>
                <span className="plan-check" aria-hidden="true">{p.done ? '✓' : ''}</span>
                <span className="plan-main">
                  <span className="plan-title">{p.title} <span className="muted small">· {p.minutes} min</span></span>
                  <span className="plan-detail">{p.detail}</span>
                </span>
                <span className="plan-go" aria-hidden="true">→</span>
              </a>
            </li>
          ))}
        </ol>
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
        {showReport && <textarea className="report" readOnly value={report(7)} rows={14} onFocus={(e) => e.currentTarget.select()} />}
      </section>

      <h2 className="section-title">Trilha completa</h2>
      {MODULES.map((mod) => {
        const finished = moduleDone(mod.id, store);
        return (
          <section key={mod.id} className="module">
            <div className="module-head">
              <div>
                <h2>{mod.title}</h2>
                <p className="muted">{mod.intro}</p>
              </div>
              {!finished && (
                <a className="btn ghost small" href={'#/teste/' + mod.id} title="Uma passada na meta libera o módulo inteiro">Já sei isso: fazer o teste</a>
              )}
            </div>
            <div className="lesson-list">
              {LESSONS.filter((l) => l.module === mod.id).map((l) => {
                const p = store.lessons[l.id];
                const unlocked = isUnlocked(l.id, store);
                const due = reviews.includes(l.id);
                const status = p?.completed ? 'feita' : l.id === next ? 'atual' : unlocked ? 'aberta' : 'bloqueada';
                return (
                  <a key={l.id} className={'lesson ' + status + (l.kind === 'peca' ? ' peca' : '')} href={'#/licao/' + l.id}>
                    <span className="lesson-dot" aria-hidden="true" />
                    <span className="lesson-main">
                      <span className="lesson-title">{l.title}</span>
                      <span className="lesson-meta">
                        {p?.completed
                          ? (p.viaTeste ? 'Dominada no nivelamento' : `Concluída · melhor ${Math.round(p.bestAccuracy * 100)}% a ${p.bestBpm} BPM`) + (p.review ? ` · revisão ${due ? 'hoje' : 'em ' + p.review.due.slice(8) + '/' + p.review.due.slice(5, 7)}` : '')
                          : status === 'bloqueada'
                            ? 'Conclua a anterior primeiro (pode abrir para ver)'
                            : `Meta: ${l.goalBpm} BPM com ${Math.round(l.goalAccuracy * 100)}%` + (p?.attempts ? ` · ${p.attempts} tentativa(s)` : '')}
                      </span>
                    </span>
                    <span className="lesson-tag">{due ? 'Revisar' : status === 'feita' ? '✓' : status === 'atual' ? 'Agora' : ''}</span>
                  </a>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
