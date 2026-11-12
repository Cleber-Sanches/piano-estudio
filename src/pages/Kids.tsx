import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { EarGame, Jam, MiniKeys, noteColor } from '../components/Games';
import { click, play, startAudio, stopAll } from '../engine/audio';
import { input } from '../engine/input';
import { BUILTIN_PIECES, pieceById } from '../lib/pieces';
import { ageLabel, ageMonths, useActiveProfile } from '../lib/profiles';
import { load, recordGame, subscribe } from '../lib/progress';
import { PITCH_PT } from '../lib/theory';

// Perfil de criança: musicalização antes da partitura (ouvir, cantar, ritmo, brincar no teclado),
// com o adulto junto. Atividades curtas, sempre com uma frase para o adulto saber o que fazer.

interface Activity {
  id: string;
  title: string;
  detail: string;
  adult: string;
  href: string;
  emoji: string;
}

interface Stage {
  id: string;
  title: string;
  range: string;
  intro: string;
  activities: Activity[];
}

const kidsPieces = BUILTIN_PIECES.filter((p) => p.kids);

const STAGES: Stage[] = [
  {
    id: 'gestacao', title: 'Antes de nascer', range: 'gravidez',
    intro: 'A partir da metade da gravidez o bebê já ouve sons de fora. O que mais conta agora é você tocar e cantar: é a voz e a música que ela vai reconhecer depois.',
    activities: [
      { id: 'pai', emoji: '🎹', title: 'Você toca, ela escuta', detail: 'Toque uma cantiga da sua trilha todo dia, sempre a mesma por uma semana.', adult: 'Repetição cria familiaridade. Cante junto enquanto toca.', href: '#/musicas' },
      { id: 'ouvir', emoji: '👂', title: 'Ouvir cantigas', detail: 'O app toca as cantigas devagar, com as cores das notas.', adult: 'Bom para aprender as melodias que você vai tocar para ela.', href: '#/ouvir/brilha' },
    ],
  },
  {
    id: 'bebe', title: 'Bebê', range: '0 a 2 anos',
    intro: 'Nessa fase não existe aula: existe brincar com som no colo de alguém. Ouvir, bater no teclado, ver cores e ouvir a voz de quem cuida.',
    activities: [
      { id: 'brincar', emoji: '🫧', title: 'Brincar no teclado', detail: 'Qualquer tecla faz uma bolha colorida. Forte = bolha grande.', adult: 'Com a criança no colo. Celebre cada som; nomeie: “forte!”, “fraquinho!”.', href: '#/jogo/kid-brincar' },
      { id: 'ouvir', emoji: '🎵', title: 'Ouvir e cantar', detail: 'Cantigas tocadas devagar, com a nota grande e colorida.', adult: 'Cante junto e balance no ritmo. Toque a mesma música por vários dias.', href: '#/ouvir/brilha' },
    ],
  },
  {
    id: 'pequena', title: 'Pequena', range: '3 e 4 anos',
    intro: 'Hora de perceber diferenças: agudo e grave, forte e fraco, teclas pretas em grupos, ritmo. Tudo por jogo, poucos minutos.',
    activities: [
      { id: 'ag', emoji: '🐦', title: 'Passarinho ou urso', detail: 'Ouve um som: agudo (passarinho) ou grave (urso)? Toca no lado certo.', adult: 'Mostre antes: direita do teclado é agudo, esquerda é grave.', href: '#/jogo/kid-agudo-grave' },
      { id: 'ff', emoji: '🐘', title: 'Elefante e ratinho', detail: 'Tocar forte como elefante ou fraquinho como ratinho.', adult: 'O piano sente a força do dedo. Faça junto, exagerando.', href: '#/jogo/kid-forte-fraco' },
      { id: 'pretas', emoji: '⚫', title: 'Teclas pretas', detail: 'Achar as pretas em grupo de 2 e de 3.', adult: 'Esse é o mapa do teclado: o Dó fica logo antes das 2 pretas.', href: '#/jogo/kid-pretas' },
      { id: 'ritmo', emoji: '🥁', title: 'Eco de ritmo', detail: 'O app bate um ritmo; ela bate igual em qualquer tecla.', adult: 'Bata palmas junto antes de tocar.', href: '#/jogo/kid-ritmo' },
      { id: 'brincar', emoji: '🫧', title: 'Brincar livre', detail: 'Bolhas coloridas, sem regra.', adult: 'Toque uma nota e peça para ela “responder”.', href: '#/jogo/kid-brincar' },
    ],
  },
  {
    id: 'crianca', title: 'Criança', range: '5 a 7 anos',
    intro: 'Idade em que muitos professores começam aulas de verdade: cantigas com as cores, eco de ouvido, primeiras notas na pauta. Sessões de 10 a 15 minutos.',
    activities: [
      ...kidsPieces.slice(0, 3).map((p) => ({ id: 'peca-' + p.id, emoji: '🎶', title: 'Tocar: ' + p.title, detail: 'No modo espera: a música só anda quando ela acerta a nota.', adult: 'Primeiro só a mão direita. Cante o nome das notas junto.', href: '#/peca/' + p.id })),
      { id: 'eco', emoji: '👂', title: 'Eco de 2 notas', detail: 'O app toca 2 notas, ela repete. As teclas acendem com cor.', adult: 'Se ela errar, toque junto devagar. Ouvido se treina brincando.', href: '#/jogo/kid-eco' },
      { id: 'ritmo', emoji: '🥁', title: 'Eco de ritmo', detail: 'Ritmos um pouco mais longos.', adult: 'Fale “tá, tá, ti-ti, tá” junto com o ritmo.', href: '#/jogo/kid-ritmo' },
      { id: 'ler', emoji: '📖', title: 'Primeiras notas na pauta', detail: 'Leitura nível 1: Dó a Sol, uma nota por vez.', adult: 'Só depois que ela já toca as cantigas de ouvido.', href: '#/leitura' },
    ],
  },
  {
    id: 'trilha', title: 'Pronta para a trilha', range: '8 anos ou mais',
    intro: 'Já pode seguir a trilha completa (a mesma do adulto), com sessões curtas. Crie um perfil de adulto para ela, ou mude o tipo deste perfil em Perfis.',
    activities: [
      { id: 'perfis', emoji: '🧭', title: 'Ir para a trilha completa', detail: 'Em Perfis, mude o tipo deste perfil para “adulto”.', adult: 'Mantenha as cantigas e o improviso: são o que dá vontade de tocar.', href: '#/perfis' },
    ],
  },
];

function stageFor(months: number | null): string {
  if (months == null) return 'crianca';
  if (months < 0) return 'gestacao';
  if (months < 36) return 'bebe';
  if (months < 60) return 'pequena';
  if (months < 96) return 'crianca';
  return 'trilha';
}

export function Kids() {
  const profile = useActiveProfile();
  const store = useSyncExternalStore(subscribe, load);
  const months = ageMonths(profile.birth);
  const current = stageFor(months);
  const [open, setOpen] = useState<string | null>(null);
  const stage = STAGES.find((s) => s.id === current)!;
  const others = STAGES.filter((s) => s.id !== current);
  const playedToday = Object.values(store.games ?? {}).filter((g) => g.lastAt?.slice(0, 10) === new Date().toISOString().slice(0, 10)).length;

  return (
    <div className="page kids">
      <section className="plan">
        <p className="eyebrow">{profile.name}{months != null ? ' · ' + ageLabel(months) : ''} · {stage.title} ({stage.range})</p>
        <h1>{months != null && months < 0 ? 'Música antes de nascer' : 'Hora de brincar com música'}</h1>
        <p className="muted">{stage.intro}</p>
        {playedToday > 0 && <p className="ok">🌟 {playedToday} {playedToday === 1 ? 'atividade' : 'atividades'} hoje.</p>}
        <div className="kid-grid">
          {stage.activities.map((a) => <ActivityCard key={a.id} a={a} done={!!store.games?.[a.href.replace('#/jogo/', '')]?.done} />)}
        </div>
      </section>

      <h2 className="section-title">Outras idades</h2>
      {others.map((s) => (
        <section key={s.id} className="card">
          <button className="kid-stage-head" onClick={() => setOpen(open === s.id ? null : s.id)} aria-expanded={open === s.id}>
            <b>{s.title}</b> <span className="muted small">{s.range}</span>
            <span className="plan-go" aria-hidden="true">{open === s.id ? '−' : '+'}</span>
          </button>
          {open === s.id && (
            <>
              <p className="muted">{s.intro}</p>
              <div className="kid-grid">{s.activities.map((a) => <ActivityCard key={a.id} a={a} done={false} />)}</div>
            </>
          )}
        </section>
      ))}
      <p className="muted small">Base: musicalização infantil (Suzuki, Kodály, Orff) e métodos como Hoffman Academy, que sugerem aulas formais por volta dos 5 a 7 anos e muito ouvir e brincar antes disso.</p>
    </div>
  );
}

function ActivityCard({ a, done }: { a: Activity; done: boolean }) {
  return (
    <a className={'kid-card' + (done ? ' done' : '')} href={a.href}>
      <span className="kid-emoji" aria-hidden="true">{a.emoji}</span>
      <b>{a.title}{done ? ' ✓' : ''}</b>
      <span className="muted small">{a.detail}</span>
      <span className="kid-adult"><b>Para o adulto:</b> {a.adult}</span>
    </a>
  );
}

// ---------- jogos da criança ----------

type KidKind = 'agudo-grave' | 'forte-fraco' | 'pretas';

const KID_ROUNDS = 6;

const KID_INFO: Record<KidKind, { title: string; intro: string }> = {
  'agudo-grave': { title: 'Passarinho ou urso?', intro: 'Ouça o som. Agudo (fino) é passarinho 🐦: toque na direita do piano. Grave (grosso) é urso 🐻: toque na esquerda.' },
  'forte-fraco': { title: 'Elefante e ratinho', intro: 'Quando aparecer o elefante 🐘, toque forte. Quando aparecer o ratinho 🐭, toque bem fraquinho.' },
  pretas: { title: 'Teclas pretas', intro: 'As teclas pretas moram em grupos de 2 e de 3. Toque uma preta do grupo que aparecer.' },
};

function KidQuiz({ kind, onExit }: { kind: KidKind; onExit: () => void }) {
  const [round, setRound] = useState(-1);
  const [target, setTarget] = useState<0 | 1>(0);
  const [msg, setMsg] = useState<'' | 'certo' | 'errado'>('');
  const score = useRef(0);
  const info = KID_INFO[kind];

  const ask = (t: 0 | 1) => {
    setTarget(t);
    setMsg('');
    if (kind === 'agudo-grave') play(t === 0 ? 79 + Math.floor(Math.random() * 5) : 40 + Math.floor(Math.random() * 5), 0.8, 1);
  };
  const next = (r: number) => {
    if (r >= KID_ROUNDS) { setRound(r); recordGame('kid-' + kind, info.title, score.current / KID_ROUNDS, true); return; }
    setRound(r);
    ask(Math.random() < 0.5 ? 0 : 1);
  };
  const start = async () => {
    await startAudio().catch(() => {});
    score.current = 0;
    next(0);
  };

  useEffect(() => {
    if (round < 0 || round >= KID_ROUNDS || msg === 'certo') return;
    return input.on((e) => {
      if (e.type !== 'on') return;
      let ok = false;
      if (kind === 'agudo-grave') ok = target === 0 ? e.midi >= 72 : e.midi <= 52;
      if (kind === 'forte-fraco') ok = target === 0 ? e.velocity > 0.6 : e.velocity < 0.45;
      if (kind === 'pretas') ok = (target === 0 ? [1, 3] : [6, 8, 10]).includes(e.midi % 12);
      if (ok) {
        if (msg !== 'errado') score.current++;
        setMsg('certo');
        setTimeout(() => next(round + 1), 1100);
      } else {
        setMsg('errado');
        if (kind === 'agudo-grave') setTimeout(() => ask(target), 700);
      }
    });
  }, [round, target, msg, kind]); // eslint-disable-line react-hooks/exhaustive-deps

  const prompt = kind === 'agudo-grave' ? (target === 0 ? '🐦' : '🐻') : kind === 'forte-fraco' ? (target === 0 ? '🐘' : '🐭') : target === 0 ? '⚫⚫' : '⚫⚫⚫';
  const label = kind === 'agudo-grave' ? (target === 0 ? 'Agudo: direita' : 'Grave: esquerda') : kind === 'forte-fraco' ? (target === 0 ? 'Forte!' : 'Fraquinho…') : target === 0 ? 'Grupo de 2' : 'Grupo de 3';

  return (
    <div className="page game kid">
      <button className="btn ghost small" onClick={onExit}>← Voltar</button>
      <section className="card game-card">
        <h1>{info.title}</h1>
        {round < 0 && (
          <>
            <p className="muted">{info.intro}</p>
            <div className="actions"><button className="btn big" onClick={start}>Começar</button></div>
          </>
        )}
        {round >= 0 && round < KID_ROUNDS && (
          <>
            <div className="kid-prompt" aria-label={label}>{prompt}</div>
            <div className={'game-msg ' + (msg || 'tocar')}>{msg === 'certo' ? '🌟 Isso!' : msg === 'errado' ? '🙂 Tenta de novo' : label}</div>
            <div className="dots">{Array.from({ length: KID_ROUNDS }, (_, i) => <i key={i} className={i < round ? 'on' : ''} />)}</div>
            {kind === 'agudo-grave' && <div className="actions"><button className="btn ghost" onClick={() => ask(target)}>Ouvir de novo</button></div>}
            {kind === 'pretas' && <MiniKeys lo={48} hi={71} pool={[49, 51, 54, 56, 58, 61, 63, 66, 68, 70]} big />}
          </>
        )}
        {round >= KID_ROUNDS && (
          <>
            <div className="kid-prompt">🎉</div>
            <div className="game-msg certo">Muito bem!</div>
            <div className="actions">
              <button className="btn" onClick={start}>De novo</button>
              <button className="btn ghost" onClick={onExit}>Voltar</button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

/** Ritmos em tempos (1 = semínima, 0.5 = colcheia). */
const RHYTHMS = [[1, 1, 1], [1, 1, 2], [2, 1, 1], [1, 0.5, 0.5, 1], [0.5, 0.5, 1, 1], [1, 1, 0.5, 0.5, 1], [0.5, 0.5, 0.5, 0.5, 2]];
const BEAT_MS = 600;

function RhythmEcho({ onExit }: { onExit: () => void }) {
  const [round, setRound] = useState(-1);
  const [phase, setPhase] = useState<'ouvir' | 'tocar' | 'certo' | 'errado'>('ouvir');
  const [taps, setTaps] = useState(0);
  const [lit, setLit] = useState(-1);
  const pattern = useRef<number[]>([]);
  const score = useRef(0);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const playPattern = async () => {
    setPhase('ouvir');
    setTaps(0);
    let t = 0;
    const onsets = pattern.current.map((d) => { const o = t; t += d; return o; });
    onsets.forEach((o, i) => setTimeout(() => { if (!alive.current) return; click(i === 0); setLit(i); setTimeout(() => setLit(-1), 180); }, 500 + o * BEAT_MS));
    setTimeout(() => { if (alive.current) setPhase('tocar'); }, 500 + t * BEAT_MS);
  };
  const next = (r: number) => {
    if (r >= KID_ROUNDS) { setRound(r); recordGame('kid-ritmo', 'Eco de ritmo', score.current / KID_ROUNDS, true); return; }
    setRound(r);
    pattern.current = RHYTHMS[Math.min(RHYTHMS.length - 1, Math.floor(r / 2) + Math.floor(Math.random() * 3))];
    playPattern();
  };
  const start = async () => {
    await startAudio().catch(() => {});
    score.current = 0;
    next(0);
  };

  useEffect(() => {
    if (phase !== 'tocar') return;
    const times: number[] = [];
    let idle = 0;
    const judge = () => {
      const p = pattern.current;
      let ok = times.length === p.length;
      if (ok && p.length > 1) {
        const unit = (times[times.length - 1] - times[0]) / p.slice(0, -1).reduce((a, b) => a + b, 0);
        for (let i = 0; i < p.length - 1 && ok; i++) {
          const want = p[i] * unit;
          ok = Math.abs(times[i + 1] - times[i] - want) <= want * 0.35;
        }
      }
      if (ok) score.current++;
      setPhase(ok ? 'certo' : 'errado');
      setTimeout(() => { if (alive.current) (ok ? next(round + 1) : playPattern()); }, ok ? 1000 : 1300);
    };
    const off = input.on((e) => {
      if (e.type !== 'on') return;
      times.push(performance.now());
      setTaps(times.length);
      clearTimeout(idle);
      if (times.length >= pattern.current.length) idle = window.setTimeout(judge, 400);
      else idle = window.setTimeout(judge, 2500);
    });
    return () => { off(); clearTimeout(idle); };
  }, [phase, round]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="page game kid">
      <button className="btn ghost small" onClick={onExit}>← Voltar</button>
      <section className="card game-card">
        <h1>Eco de ritmo</h1>
        {round < 0 && (
          <>
            <p className="muted">O app bate um ritmo. Depois, bata igual em qualquer tecla do piano.</p>
            <div className="actions"><button className="btn big" onClick={start}>Começar</button></div>
          </>
        )}
        {round >= 0 && round < KID_ROUNDS && (
          <>
            <div className="rhythm-row" aria-hidden="true">
              {pattern.current.map((d, i) => <span key={i} className={'rhythm-dot' + (i === lit ? ' on' : '') + (phase === 'tocar' && i < taps ? ' tap' : '')} style={{ flexGrow: d }}>🥁</span>)}
            </div>
            <div className={'game-msg ' + phase}>{phase === 'ouvir' ? '👂 Escute…' : phase === 'tocar' ? '🥁 Sua vez!' : phase === 'certo' ? '🌟 Isso!' : '🙂 Escute de novo'}</div>
            <div className="dots">{Array.from({ length: KID_ROUNDS }, (_, i) => <i key={i} className={i < round ? 'on' : ''} />)}</div>
          </>
        )}
        {round >= KID_ROUNDS && (
          <>
            <div className="kid-prompt">🎉</div>
            <div className="actions">
              <button className="btn" onClick={start}>De novo</button>
              <button className="btn ghost" onClick={onExit}>Voltar</button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

const KID_ECO_POOL = [60, 62, 64, 65, 67];
const KID_JAM_POOL = [48, 50, 52, 53, 55, 57, 59, 60, 62, 64, 65, 67, 69, 71, 72, 74, 76];

/** Rota #/jogo/kid-…: devolve o jogo de criança. */
export function KidGameRoute({ id, onExit }: { id: string; onExit: () => void }) {
  if (id === 'kid-agudo-grave' || id === 'kid-forte-fraco' || id === 'kid-pretas') return <KidQuiz kind={id.slice(4) as KidKind} onExit={onExit} />;
  if (id === 'kid-ritmo') return <RhythmEcho onExit={onExit} />;
  if (id === 'kid-eco') return <EarGame id="kid-eco" title="Eco de 2 notas" detail="O app toca 2 notas e as teclas acendem." pool={KID_ECO_POOL} length={2} rounds={6} kid onExit={onExit} />;
  if (id === 'kid-brincar') return <Jam id="kid-brincar" title="Bolhas de som" detail="Toque qualquer tecla. Forte faz bolha grande, fraco faz bolha pequena." pool={KID_JAM_POOL} seconds={0} kid onExit={onExit} />;
  return <div className="page"><p>Jogo não encontrado.</p><button className="btn ghost" onClick={onExit}>← Voltar</button></div>;
}

/** Ouvir uma cantiga: o app toca devagar e mostra a nota grande, colorida. */
export function Listen({ id, onExit }: { id: string; onExit: () => void }) {
  const piece = pieceById(id);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState<number | null>(null);
  const timers = useRef<number[]>([]);

  const stop = () => { timers.current.forEach(clearTimeout); timers.current = []; stopAll(); setPlaying(false); setCur(null); };
  useEffect(() => stop, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!piece) return <div className="page"><p>Música não encontrada.</p><button className="btn ghost" onClick={onExit}>← Voltar</button></div>;

  const start = async () => {
    await startAudio().catch(() => {});
    stop();
    const bpm = Math.round(piece.bpm * 0.8);
    const song = piece.build(bpm, ['R', 'L']);
    setPlaying(true);
    for (const n of song.notes) {
      const at = song.beatToSec(n.beat) * 1000 + 300;
      timers.current.push(window.setTimeout(() => {
        play(n.midi, n.hand === 'R' ? 0.75 : 0.45, song.beatToSec(n.beat + n.beats) - song.beatToSec(n.beat));
        if (n.hand === 'R') setCur(n.midi);
      }, at));
    }
    timers.current.push(window.setTimeout(() => { setPlaying(false); setCur(null); }, song.duration * 1000 + 800));
  };

  return (
    <div className="page game kid">
      <button className="btn ghost small" onClick={() => { stop(); onExit(); }}>← Voltar</button>
      <section className="card game-card">
        <p className="eyebrow">Ouvir e cantar</p>
        <h1>{piece.title}</h1>
        <div className="listen-note" style={{ background: cur != null ? noteColor(cur) : 'var(--line)' }}>
          {cur != null ? PITCH_PT[cur % 12] : '♪'}
        </div>
        <MiniKeys lo={48} hi={72} lit={cur != null ? [cur] : []} colored big />
        <div className="actions">
          {playing ? <button className="btn ghost" onClick={stop}>Parar</button> : <button className="btn big" onClick={start}>Tocar</button>}
        </div>
        <div className="kid-picks">
          {kidsPieces.map((p) => <a key={p.id} className={'btn small' + (p.id === id ? '' : ' ghost')} href={'#/ouvir/' + p.id}>{p.title}</a>)}
        </div>
      </section>
    </div>
  );
}
