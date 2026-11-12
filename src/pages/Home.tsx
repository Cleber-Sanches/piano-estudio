import { useEffect, useState, useSyncExternalStore } from 'react';
import { ArrowRight, CalendarDays, Check, ChevronRight, Clock, Copy, FileText, Flame, Heart, Play, RotateCcw, Sparkles, Target, type LucideIcon } from 'lucide-react';
import { allMissions, currentLevel, levelDone, missionDone, missionHref, missionKey, missionPillar, missionTitle, PHASES, pillarProgress, PILLARS, type Mission } from '../lib/curriculum';
import { listSongs, type StoredSong } from '../lib/library';
import { PILLAR_ICON } from '../lib/icons';
import { lessonById } from '../lib/lessons';
import { addDays, attemptedToday, dueReviews, load, report, subscribe, today, type Store } from '../lib/progress';

interface PlanItem {
  key: string;
  title: string;
  detail: string;
  minutes: number;
  done: boolean;
  href: string;
  tag: string;
  pillar: string;
  Icon: LucideIcon;
}

const PILLAR_LABEL = Object.fromEntries(PILLARS.map((p) => [p.id, p.title]));

function touchedToday(m: Mission, s: Store) {
  if (m.kind === 'licao') return attemptedToday((a) => a.kind === 'licao' && a.id === m.id, s) || !!s.lessons[m.id]?.completedAt?.startsWith(today());
  if (m.kind === 'leitura') return attemptedToday((a) => a.kind === 'leitura', s);
  return attemptedToday((a) => a.kind === 'jogo' && a.id === m.id, s) || (m.kind === 'obra' && !!s.games?.[m.id]?.done && attemptedToday((a) => a.id === m.id, s));
}

export function missionDetail(m: Mission, s: Store): string {
  if (m.kind === 'leitura') return `Leitura relâmpago, nível ${m.level}. Uma rodada de 20 notas.`;
  if (m.kind === 'jogo' || m.kind === 'obra') return m.detail;
  const l = lessonById(m.id);
  if (!l) return '';
  const p = s.lessons[m.id];
  if (!p?.attempts) return `Comece no modo espera; quando sair limpo, modo tempo. Meta: ${l.goalBpm} BPM com ${Math.round(l.goalAccuracy * 100)}%.`;
  return `Meta: ${l.goalBpm} BPM com ${Math.round(l.goalAccuracy * 100)}% no modo tempo${p.bestBpm ? ' · seu melhor: ' + p.bestBpm + ' BPM' : ''}.`;
}

const minutesOf = (m: Mission) => (m.kind === 'licao' ? 12 : m.kind === 'obra' ? 15 : 5);

/** Dias seguidos com prática, contando hoje (ou ontem, se hoje ainda não tocou). */
function streak(s: Store) {
  let d = today();
  if (!(s.minutes[d] > 0)) d = addDays(d, -1);
  let n = 0;
  while (s.minutes[d] > 0) { n++; d = addDays(d, -1); }
  return n;
}

function Ring({ value, total }: { value: number; total: number }) {
  const r = 26, c = 2 * Math.PI * r, f = total ? value / total : 0;
  return (
    <svg className="ring" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r={r} className="ring-bg" />
      <circle cx="32" cy="32" r={r} className="ring-fg" strokeDasharray={`${c * f} ${c}`} transform="rotate(-90 32 32)" />
    </svg>
  );
}

export function Home() {
  const store = useSyncExternalStore(subscribe, load);
  const [songs, setSongs] = useState<StoredSong[]>([]);
  const [copied, setCopied] = useState<'ok' | 'erro' | null>(null);
  const [showReport, setShowReport] = useState(false);
  useEffect(() => { listSongs().then(setSongs).catch(() => setSongs([])); }, []);

  const missions = allMissions();
  const doneCount = missions.filter((m) => missionDone(m, store)).length;
  const reviews = dueReviews(store);
  const level = currentLevel(store);
  const phase = PHASES.find((p) => p.n === level.phase)!;
  const lvDone = levelDone(level, store);

  // plano de hoje: aquecimento (revisão) + próximas 2 missões + sua música
  const plan: PlanItem[] = [];
  const rev = reviews[0];
  if (rev) {
    const l = lessonById(rev)!;
    plan.push({
      key: 'rev', title: l.title, minutes: 5, tag: 'Aquecimento', pillar: 'tecnica', Icon: RotateCcw,
      detail: 'Revisão espaçada: uma passada no modo tempo, na meta.',
      done: attemptedToday((a) => a.id === rev && a.mode === 'tempo', store),
      href: '#/licao/' + rev,
    });
  }
  const finishedToday = (m: Mission) => (m.kind === 'licao' ? !!store.lessons[m.id]?.completedAt?.startsWith(today()) : m.kind !== 'leitura');
  const todayMissions = missions.filter((m) => touchedToday(m, store) && (!missionDone(m, store) || finishedToday(m)));
  const pending = missions.filter((m) => !missionDone(m, store) && !todayMissions.includes(m));
  for (const m of [...todayMissions, ...pending].slice(0, 2)) {
    plan.push({
      key: missionKey(m), title: missionTitle(m), minutes: minutesOf(m), tag: PILLAR_LABEL[missionPillar(m)], pillar: missionPillar(m), Icon: PILLAR_ICON[missionPillar(m)],
      detail: missionDetail(m, store),
      done: touchedToday(m, store),
      href: missionHref(m),
    });
  }
  if (songs.length) {
    const lastMusic = store.attempts.find((a) => a.kind === 'musica');
    const song = songs.find((s) => s.id === lastMusic?.id) ?? songs[0];
    plan.push({
      key: 'musica', title: song.name, minutes: 10, tag: 'Sua música', pillar: 'musica', Icon: Heart,
      detail: 'Escolha 2 compassos difíceis, “Repetir compassos”, até 3 passadas limpas.',
      done: attemptedToday((a) => a.kind === 'musica', store),
      href: '#/musica/' + song.id,
    });
  } else {
    plan.push({
      key: 'musica', title: 'Escolha a sua música', minutes: 10, tag: 'Sua música', pillar: 'musica', Icon: Heart,
      detail: 'Uma do repertório ou um .mid da música que você quer tocar. Ela entra no plano todo dia.',
      done: attemptedToday((a) => a.kind === 'musica', store),
      href: '#/musicas',
    });
  }
  const planMin = plan.reduce((a, p) => a + p.minutes, 0);
  const planDone = plan.filter((p) => p.done).length;
  const next = plan.find((p) => !p.done);
  const pillars = pillarProgress(store);

  const days: string[] = [];
  for (let i = 13; i >= 0; i--) days.push(addDays(today(), -i));
  const maxMin = Math.max(20, ...days.map((d) => store.minutes[d] ?? 0));
  const week = days.slice(7).reduce((a, d) => a + (store.minutes[d] ?? 0), 0);
  const days7 = days.slice(7).filter((d) => (store.minutes[d] ?? 0) > 0).length;

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
    <div className="page wide">
      <header className="page-head">
        <p className="eyebrow">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <h1>{greeting()}</h1>
      </header>

      <div className="home-grid">
        <div className="home-main">
          <a className="m-entry" href="#/sessao">
            <span className="m-entry-icon" aria-hidden="true"><Sparkles size={22} /></span>
            <span className="m-entry-text">
              <b>Sessão com o professor</b>
              <span>10 minutos. Ele vê onde você erra e monta cada exercício na hora.</span>
            </span>
            <ChevronRight size={20} aria-hidden="true" />
          </a>
          <section className="hero">
            <div className="hero-text">
              <p className="hero-eyebrow">Fase {phase.n} · {phase.title}<span className="hero-dot" />Nível {level.n} de 12</p>
              <h2 className="hero-title">{level.title}</h2>
              <p className="hero-goal">{level.goal}</p>
              <div className="hero-progress">
                <span className="meter light"><i style={{ width: (lvDone / level.missions.length) * 100 + '%' }} /></span>
                <span className="num small">{lvDone}/{level.missions.length} missões</span>
              </div>
            </div>
            <div className="hero-cta">
              {next
                ? <a className="btn big brass" href={next.href}><Play size={18} fill="currentColor" aria-hidden="true" />{planDone ? 'Continuar' : 'Começar'}</a>
                : <span className="hero-done"><Check size={20} aria-hidden="true" /> Tudo feito hoje</span>}
              <span className="hero-sub"><Clock size={14} aria-hidden="true" /> {planMin} min · {planDone}/{plan.length} feitos</span>
            </div>
          </section>

          <section>
            <div className="section-head">
              <h2>Plano de hoje</h2>
              <a className="link" href="#/trilha">Trilha inteira <ArrowRight size={15} aria-hidden="true" /></a>
            </div>
            <ol className="plan-list">
              {plan.map((p, i) => (
                <li key={p.key} className={'q-' + p.pillar + (p.done ? ' done' : '') + (p === next ? ' next' : '')}>
                  <a href={p.href}>
                    <span className="plan-icon" aria-hidden="true">{p.done ? <Check size={20} strokeWidth={2.6} /> : <p.Icon size={20} />}</span>
                    <span className="plan-main">
                      <span className="plan-tag">{i + 1}. {p.tag} · {p.minutes} min</span>
                      <span className="plan-title">{p.title}</span>
                      <span className="plan-detail">{p.detail}</span>
                    </span>
                    <ChevronRight className="plan-go" size={20} aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="home-side">
          <section className="stats">
            <div className="stat">
              <span className="stat-icon s-flame"><Flame size={18} aria-hidden="true" /></span>
              <span className="stat-num num">{streak(store)}</span>
              <span className="stat-label">dias seguidos</span>
            </div>
            <div className="stat">
              <span className="stat-icon s-clock"><CalendarDays size={18} aria-hidden="true" /></span>
              <span className="stat-num num">{Math.round(week)}<span className="stat-of"> min</span></span>
              <span className="stat-label">em 7 dias · {days7} dia{days7 === 1 ? '' : 's'}</span>
            </div>
            <div className="stat stat-ring">
              <span className="ring-wrap"><Ring value={doneCount} total={missions.length} /><Target size={16} aria-hidden="true" /></span>
              <span>
                <span className="stat-num num">{doneCount}<span className="stat-of">/{missions.length}</span></span>
                <span className="stat-label">missões da trilha</span>
              </span>
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <h2>O que faz um pianista</h2>
            </div>
            <div className="pillars">
              {PILLARS.map((p) => {
                const v = pillars[p.id];
                const Icon = PILLAR_ICON[p.id];
                return (
                  <div key={p.id} className={'pillar p-' + p.id} title={p.hint}>
                    <span className="pillar-icon" aria-hidden="true"><Icon size={16} /></span>
                    <span className="pillar-name">{p.title}</span>
                    <span className="num small muted">{v.done}/{v.total}</span>
                    <span className="meter"><i style={{ width: (v.total ? (v.done / v.total) * 100 : 0) + '%' }} /></span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <h2>Duas semanas</h2>
              <span className="muted small">minutos por dia</span>
            </div>
            <div className="bars" aria-label="Minutos por dia nas últimas duas semanas">
              {days.map((d) => {
                const m = store.minutes[d] ?? 0;
                return <div key={d} className={'bar' + (m ? ' on' : '') + (d === today() ? ' today' : '')} style={{ height: `${m ? Math.max(8, (m / maxMin) * 100) : 4}%` }} title={`${d.slice(8)}/${d.slice(5, 7)}: ${Math.round(m)} min`} />;
              })}
            </div>
            <div className="actions">
              <button className="btn ghost small" onClick={copy}><Copy size={15} aria-hidden="true" />Copiar relatório</button>
              <button className="btn ghost small" onClick={() => setShowReport((s) => !s)}><FileText size={15} aria-hidden="true" />{showReport ? 'Esconder' : 'Ver relatório'}</button>
            </div>
            {copied === 'ok' && <span className="ok">Copiado. Cole no chat com o Claude.</span>}
            {copied === 'erro' && <span className="warn">Não consegui copiar; selecione o texto abaixo.</span>}
            {showReport && <textarea className="report" readOnly value={report(7)} rows={14} onFocus={(e) => e.currentTarget.select()} />}
          </section>
        </aside>
      </div>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}
