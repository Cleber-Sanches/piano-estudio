import { useState, useSyncExternalStore } from 'react';
import { ArrowLeft, Check, ChevronRight, Download, GraduationCap, Library, Trophy } from 'lucide-react';
import { PILLAR_ICON } from '../lib/icons';
import { currentLevel, LEVELS, levelDone, missionDone, missionHref, missionKey, missionPillar, missionTitle, OBRAS, PHASES, PILLARS, type Level } from '../lib/curriculum';
import { lessonById, MODULES } from '../lib/lessons';
import { dueReviews, load, moduleDone, recordGame, subscribe, type Store } from '../lib/progress';
import { missionDetail } from './Home';

const PILLAR_LABEL = Object.fromEntries(PILLARS.map((p) => [p.id, p.title]));

function LevelPath({ level, store, current }: { level: Level; store: Store; current: boolean }) {
  const reviews = dueReviews(store);
  const firstOpen = level.missions.find((m) => !missionDone(m, store));
  const mod = MODULES.find((m) => m.id === 'N' + level.n);
  return (
    <>
      <ol className="path">
        {level.missions.map((m) => {
          const done = missionDone(m, store);
          const isNow = current && m === firstOpen;
          const p = m.kind === 'licao' ? store.lessons[m.id] : undefined;
          const lesson = m.kind === 'licao' ? lessonById(m.id) : undefined;
          const due = m.kind === 'licao' && reviews.includes(m.id);
          const meta = done
            ? (p ? (p.viaTeste ? 'Dominada no nivelamento' : `Feita · ${Math.round(p.bestAccuracy * 100)}% a ${p.bestBpm} BPM`) : 'Feita')
            : missionDetail(m, store);
          const pill = missionPillar(m);
          const Icon = m.kind === 'obra' ? Trophy : PILLAR_ICON[pill];
          return (
            <li key={missionKey(m)} className={'node ' + (done ? 'feita' : isNow ? 'atual' : 'aberta') + ' p-' + pill + (lesson?.kind === 'peca' || m.kind === 'obra' ? ' peca' : '')}>
              <a href={missionHref(m)}>
                <span className="node-dot" aria-hidden="true">{done ? <Check size={18} strokeWidth={2.6} /> : <Icon size={18} />}</span>
                <span className="node-main">
                  <span className="node-tag">{PILLAR_LABEL[pill]}{lesson?.kind === 'peca' || m.kind === 'obra' ? ' · peça' : ''}{due ? ' · revisar' : ''}</span>
                  <span className="node-title">{missionTitle(m)}</span>
                  <span className="node-meta">{meta}</span>
                </span>
                {isNow ? <span className="node-now">Agora</span> : <ChevronRight className="node-go" size={18} aria-hidden="true" />}
              </a>
            </li>
          );
        })}
      </ol>
      {mod && !moduleDone(mod.id, store) && (
        <p className="path-test">
          <GraduationCap size={18} aria-hidden="true" />
          <span>Já sabe esta parte? <a href={'#/teste/' + mod.id}>Faça o teste do nível</a> — uma passada na meta marca a técnica como dominada.</span>
        </p>
      )}
    </>
  );
}

export function Trail() {
  const store = useSyncExternalStore(subscribe, load);
  const cur = currentLevel(store);
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Do zero ao pianista</p>
        <h1>A trilha</h1>
        <p className="muted">4 fases, 12 níveis. Cada nível junta técnica, leitura, ouvido, criação e termina numa música. Faça na ordem; o plano de hoje sempre puxa a próxima.</p>
      </header>

      {PHASES.map((ph) => {
        const lv = LEVELS.filter((l) => l.phase === ph.n);
        const total = lv.reduce((a, l) => a + l.missions.length, 0);
        const done = lv.reduce((a, l) => a + levelDone(l, store), 0);
        return (
          <section key={ph.n} className={'phase' + (cur.phase === ph.n ? ' on' : '')}>
            <div className="phase-head">
              <span className="phase-n num">{ph.n}</span>
              <div>
                <h2>{ph.title}</h2>
                <p className="muted small">{ph.goal}</p>
              </div>
              <span className="muted small num phase-count">{done}/{total}</span>
            </div>
            {lv.map((l) => {
              const d = levelDone(l, store);
              const isCur = l === cur;
              const expanded = open === l.n || (open === null && isCur);
              const state = d === l.missions.length ? 'feito' : isCur ? 'atual' : l.n < cur.n ? 'aberto' : 'futuro';
              return (
                <div key={l.n} className={'level ' + state + (expanded ? ' expanded' : '')}>
                  <button className="level-head" onClick={() => setOpen(expanded ? -1 : l.n)} aria-expanded={expanded}>
                    <span className="level-n num">{d === l.missions.length ? <Check size={18} strokeWidth={2.6} /> : l.n}</span>
                    <span className="level-main">
                      <span className="level-title">{l.title}</span>
                      <span className="level-goal">{l.goal}</span>
                    </span>
                    <span className="level-meter"><span className="meter"><i style={{ width: (d / l.missions.length) * 100 + '%' }} /></span><span className="num small muted">{d}/{l.missions.length}</span></span>
                    <ChevronRight className="level-chev" size={20} aria-hidden="true" />
                  </button>
                  {expanded && <LevelPath level={l} store={store} current={isCur} />}
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}

/** Obra real: sem partitura embutida; você toca pelo .mid na aba Músicas e marca quando consegue inteira. */
export function Obra({ id }: { id: string }) {
  const store = useSyncExternalStore(subscribe, load);
  const o = OBRAS[id];
  if (!o) return <p className="page">Obra não encontrada.</p>;
  const done = !!store.games?.[id]?.done;
  const own = o.composer === 'Você escolhe' || o.composer === 'Você';
  return (
    <div className="page narrow">
      <a className="link" href="#/trilha"><ArrowLeft size={15} aria-hidden="true" /> Trilha</a>
      <section className="hero obra">
        <span className="hero-badge" aria-hidden="true"><Trophy size={26} /></span>
        <div className="hero-text">
          <p className="hero-eyebrow">{own ? 'Desafio' : 'Obra · ' + o.composer}</p>
          <h1 className="hero-title">{o.title}</h1>
          <p className="hero-goal">{o.detail}</p>
        </div>
      </section>
      <section className="card">
        <div className="card-head"><h2>Como estudar</h2>{!own && <span className="muted small"><Download size={14} aria-hidden="true" /> MIDI gratuito</span>}</div>
        <ol className="steps">
          {own ? (
            <>
              <li>Escolha a música e escute três vezes, cantando junto.</li>
              <li>Se tiver o .mid, adicione em <a href="#/musicas">Músicas</a>; se não, toque de ouvido ou pela cifra.</li>
              <li>Um trecho por dia, 10 minutos. Mãos separadas antes de juntar.</li>
              <li>Quando tocar do começo ao fim sem parar, marque abaixo.</li>
            </>
          ) : (
            <>
              <li>Baixe o arquivo MIDI gratuito (domínio público) em <b>Mutopia</b>, <b>piano-midi.de</b> ou <b>IMSLP</b>, buscando “{o.composer} {o.title}”.</li>
              <li>Adicione em <a href="#/musicas">Músicas</a> e use “Repetir compassos” para estudar de 4 em 4 compassos.</li>
              <li>Modo espera até sair limpo; depois modo tempo, começando em 60% da velocidade.</li>
              <li>Quando tocar inteira no tempo, marque abaixo.</li>
            </>
          )}
        </ol>
        <div className="actions">
          {done
            ? <span className="ok"><Check size={16} aria-hidden="true" /> Concluída</span>
            : <button className="btn" onClick={() => recordGame(id, o.title, 1, true)}><Check size={16} aria-hidden="true" />Já toco essa inteira</button>}
          <a className="btn ghost" href="#/musicas"><Library size={16} aria-hidden="true" />Abrir Músicas</a>
        </div>
      </section>
    </div>
  );
}
