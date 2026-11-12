import { useEffect, useState, useSyncExternalStore } from 'react';
import { allMissions, LEVELS, missionDone, missionHref, missionKey, missionPillar, missionTitle, pillarProgress, PILLARS, ROADMAP, type Mission } from '../lib/curriculum';
import { listSongs, type StoredSong } from '../lib/library';
import { lessonById, LESSONS, MODULES } from '../lib/lessons';
import { attemptedToday, dueReviews, load, moduleDone, report, subscribe, today, type Store } from '../lib/progress';

interface PlanItem {
  key: string;
  title: string;
  detail: string;
  minutes: number;
  done: boolean;
  href: string;
}

const PILLAR_LABEL = Object.fromEntries(PILLARS.map((p) => [p.id, p.title]));

function touchedToday(m: Mission, s: Store) {
  if (m.kind === 'licao') return attemptedToday((a) => a.kind === 'licao' && a.id === m.id, s) || !!s.lessons[m.id]?.completedAt?.startsWith(today());
  if (m.kind === 'leitura') return attemptedToday((a) => a.kind === 'leitura', s);
  return attemptedToday((a) => a.kind === 'jogo' && a.id === m.id, s);
}

function missionDetail(m: Mission, s: Store): string {
  if (m.kind === 'leitura') return `Nível ${s.reading.level} da leitura relâmpago. Uma rodada de 20 notas.`;
  if (m.kind === 'jogo') return m.detail;
  const l = lessonById(m.id);
  if (!l) return '';
  const p = s.lessons[m.id];
  if (!p?.attempts) return `Comece no modo espera; quando sair limpo, modo tempo. Meta: ${l.goalBpm} BPM com ${Math.round(l.goalAccuracy * 100)}%.`;
  return `Continua até ${l.goalBpm} BPM com ${Math.round(l.goalAccuracy * 100)}% no modo tempo (${p.bestBpm ? 'seu melhor: ' + p.bestBpm + ' BPM' : 'ainda sem passada no tempo'}).`;
}

const minutesOf = (m: Mission) => (m.kind === 'licao' ? 12 : 5);

export function Home() {
  const store = useSyncExternalStore(subscribe, load);
  const [songs, setSongs] = useState<StoredSong[]>([]);
  const [copied, setCopied] = useState<'ok' | 'erro' | null>(null);
  const [showReport, setShowReport] = useState(false);
  useEffect(() => { listSongs().then(setSongs).catch(() => setSongs([])); }, []);

  const missions = allMissions();
  const doneCount = missions.filter((m) => missionDone(m, store)).length;
  const reviews = dueReviews(store);

  // plano de hoje: aquecimento (revisão) + próximas 2 missões + sua música
  const plan: PlanItem[] = [];
  const rev = reviews[0];
  if (rev) {
    const l = lessonById(rev)!;
    plan.push({
      key: 'rev', title: 'Aquecimento: ' + l.title, minutes: 5,
      detail: 'Revisão espaçada. Uma passada no modo tempo, na meta.',
      done: attemptedToday((a) => a.id === rev && a.mode === 'tempo', store),
      href: '#/licao/' + rev,
    });
  }
  // missões tocadas hoje continuam no plano (para marcar como feitas); depois as próximas não feitas
  const finishedToday = (m: Mission) => (m.kind === 'licao' ? !!store.lessons[m.id]?.completedAt?.startsWith(today()) : m.kind === 'jogo');
  const todayMissions = missions.filter((m) => touchedToday(m, store) && (!missionDone(m, store) || finishedToday(m)));
  const pending = missions.filter((m) => !missionDone(m, store) && !todayMissions.includes(m));
  for (const m of [...todayMissions, ...pending].slice(0, 2)) {
    plan.push({
      key: missionKey(m),
      title: missionTitle(m), minutes: minutesOf(m),
      detail: `${PILLAR_LABEL[missionPillar(m)]} · ${missionDetail(m, store)}`,
      done: touchedToday(m, store),
      href: missionHref(m),
    });
  }
  if (songs.length) {
    const lastMusic = store.attempts.find((a) => a.kind === 'musica');
    const song = songs.find((s) => s.id === lastMusic?.id) ?? songs[0];
    plan.push({
      key: 'musica', title: 'Sua música: ' + song.name, minutes: 10,
      detail: 'Escolha 2 compassos difíceis, “Repetir compassos”, até 3 passadas limpas.',
      done: attemptedToday((a) => a.kind === 'musica', store),
      href: '#/musica/' + song.id,
    });
  } else {
    plan.push({
      key: 'musica', title: 'Sua música', minutes: 10,
      detail: 'Escolha uma do repertório ou adicione um .mid da música que você quer tocar. Ela entra no plano todo dia.',
      done: attemptedToday((a) => a.kind === 'musica', store),
      href: '#/musicas',
    });
  }
  const planMin = plan.reduce((a, p) => a + p.minutes, 0);
  const planDone = plan.filter((p) => p.done).length;
  const pillars = pillarProgress(store);

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

  let currentFound = false;
  const currentLevel = LEVELS.find((l) => l.units.some((u) => u.missions.some((m) => !missionDone(m, store)))) ?? LEVELS[LEVELS.length - 1];

  return (
    <div className="page">
      <section className="plan">
        <div className="plan-head">
          <div>
            <p className="eyebrow">Nível {currentLevel.n} · {currentLevel.title} · {doneCount}/{missions.length} missões</p>
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
          <h2>O que faz um pianista</h2>
          <span className="muted small">cinco frentes, um pouco de cada por semana</span>
        </div>
        <div className="pillars">
          {PILLARS.map((p) => {
            const v = pillars[p.id];
            return (
              <div key={p.id} className="pillar" title={p.hint}>
                <span className="pillar-name">{p.title}</span>
                <span className="meter"><i style={{ width: (v.total ? (v.done / v.total) * 100 : 0) + '%' }} /></span>
                <span className="muted small mono">{v.done}/{v.total}</span>
              </div>
            );
          })}
        </div>
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

      <h2 className="section-title">Trilha</h2>
      {LEVELS.map((level) => {
        const all = level.units.flatMap((u) => u.missions);
        const lvDone = all.filter((m) => missionDone(m, store)).length;
        return (
          <section key={level.n} className="module">
            <div className="module-head">
              <div>
                <p className="eyebrow">Nível {level.n} · {lvDone}/{all.length}</p>
                <h2>{level.title}</h2>
                <p className="muted">{level.intro}</p>
              </div>
            </div>
            {level.units.map((unit) => (
              <div key={unit.title} className="unit">
                <h3>{unit.title} <span className="muted small">· {unit.goal}</span></h3>
                <div className="lesson-list">
                  {unit.missions.map((m) => {
                    const done = missionDone(m, store);
                    const isCurrent = !done && !currentFound;
                    if (isCurrent) currentFound = true;
                    const p = m.kind === 'licao' ? store.lessons[m.id] : undefined;
                    const due = m.kind === 'licao' && reviews.includes(m.id);
                    const lesson = m.kind === 'licao' ? lessonById(m.id) : undefined;
                    const meta = done
                      ? (p ? (p.viaTeste ? 'Dominada no nivelamento' : `Feita · melhor ${Math.round(p.bestAccuracy * 100)}% a ${p.bestBpm} BPM`) : 'Feita')
                      : lesson ? `Meta: ${lesson.goalBpm} BPM com ${Math.round(lesson.goalAccuracy * 100)}%` + (p?.attempts ? ` · ${p.attempts} tentativa(s)` : '')
                        : m.kind === 'leitura' ? `Passe do nível ${m.level} na leitura relâmpago` : m.kind === 'jogo' ? m.detail : '';
                    return (
                      <a key={missionKey(m)} className={'lesson ' + (done ? 'feita' : isCurrent ? 'atual' : 'aberta') + (lesson?.kind === 'peca' ? ' peca' : '') + ' p-' + missionPillar(m)} href={missionHref(m)}>
                        <span className="lesson-dot" aria-hidden="true" />
                        <span className="lesson-main">
                          <span className="lesson-title">{missionTitle(m)}</span>
                          <span className="lesson-meta">{PILLAR_LABEL[missionPillar(m)]} · {meta}</span>
                        </span>
                        <span className="lesson-tag">{due ? 'Revisar' : done ? '✓' : isCurrent ? 'Agora' : ''}</span>
                      </a>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>
        );
      })}

      {ROADMAP.map((r) => (
        <section key={r.n} className="module roadmap">
          <p className="eyebrow">Nível {r.n} · em preparação</p>
          <h2>{r.title}</h2>
          <p className="muted">{r.items}</p>
        </section>
      ))}

      <section className="card">
        <h2>Já sabe alguma parte?</h2>
        <p className="muted">Faça o teste do bloco: uma passada na meta marca as lições técnicas dele como dominadas.</p>
        <div className="actions">
          {MODULES.filter((m) => !moduleDone(m.id, store)).map((m) => <a key={m.id} className="btn ghost small" href={'#/teste/' + m.id}>Teste: {m.title}</a>)}
          {MODULES.every((m) => moduleDone(m.id, store)) && <span className="ok">Todos os blocos dominados.</span>}
        </div>
        <p className="muted small">{LESSONS.filter((l) => store.lessons[l.id]?.completed).length} de {LESSONS.length} lições técnicas concluídas.</p>
      </section>
    </div>
  );
}
