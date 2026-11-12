import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, Check, Ear, Music2, Play, Sparkles, Timer, TrendingUp, X } from 'lucide-react';
import { MiniKeys, noteColor } from '../components/Games';
import { click, play, startAudio } from '../engine/audio';
import { input } from '../engine/input';
import {
  diagnose, ecoLength, iois, lerTargetMs, mastery, nextRound, noteLabel, phrasesOf, recordConfusion, ritmoWindowMs,
  saveMind, skillLabel, SONG_LADDER, songFor, stepLevel, todayStr, updateSkill, useMind,
  type Hint, type Mind, type Round,
} from '../lib/mentor';
import { BUILTIN_PIECES, pieceById } from '../lib/pieces';
import { addMinutes } from '../lib/progress';
import { getSettings } from '../lib/settings';
import type { SongNote } from '../lib/song';
import { NoteView } from './Reading';

// Sessão com o professor: um botão, ~10 minutos, o app decide cada rodada de 30 s.

const SESSION_SEC = 10 * 60;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };

interface Outcome {
  score: number;
  /** Nota de cada habilidade tocada nesta rodada (0 a 1). */
  skills: Record<string, number>;
  swaps: Array<[number, number]>;
  timing?: { early: number; late: number; n: number };
  msg: string;
}

function useAlive() {
  const a = useRef(true);
  useEffect(() => { a.current = true; return () => { a.current = false; }; }, []);
  return a;
}

/** Som do app para o que VOCÊ toca: só se o ajuste pedir ou se veio da tela. */
function echo(e: { midi: number; velocity: number; source: string }) {
  if (e.source === 'tela' || getSettings().soundMine) play(e.midi, e.velocity || 0.7, 0.5);
}

function byKey(pairs: Array<[string, number]>): Record<string, number> {
  const acc: Record<string, number[]> = {};
  pairs.forEach(([k, v]) => { (acc[k] ??= []).push(v); });
  return Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, avg(v)]));
}

function keyRange(notes: number[]): [number, number] {
  let lo = Math.min(...notes) - 2, hi = Math.max(...notes) + 2;
  lo = Math.min(lo, 60); hi = Math.max(hi, 72);
  return [lo - (lo % 12 === 1 || lo % 12 === 6 ? 1 : 0), hi];
}

// ---------- Eco: ouvir e repetir um pedaço real da música ----------

function EcoRound({ notes, onDone }: { notes: number[]; onDone: (o: Outcome) => void }) {
  const alive = useAlive();
  const [phase, setPhase] = useState<'ouvir' | 'tocar' | 'quase'>('ouvir');
  const [lit, setLit] = useState<number[]>([]);
  const [typed, setTyped] = useState(0);
  const tries = useRef(0);
  const scores = useRef<number[]>(notes.map(() => 1));
  const swaps = useRef<Array<[number, number]>>([]);

  const listen = async (showKeys: boolean) => {
    setPhase('ouvir');
    setTyped(0);
    await sleep(350);
    for (const m of notes) {
      if (!alive.current) return;
      play(m, 0.8, 0.55);
      if (showKeys) setLit([m]);
      await sleep(620);
      setLit([]);
    }
    if (alive.current) setPhase('tocar');
  };
  useEffect(() => { listen(false); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase !== 'tocar') return;
    let idx = 0;
    const finish = () => {
      const s = avg(scores.current);
      onDone({
        score: s,
        skills: byKey(notes.map((m, k) => ['tecla:' + m, scores.current[k]])),
        swaps: swaps.current,
        msg: s >= 0.9 ? 'De primeira!' : s >= 0.5 ? 'Saiu na segunda.' : 'Esse pedaço volta daqui a pouco.',
      });
    };
    return input.on((e) => {
      if (e.type !== 'on') return;
      echo(e);
      setLit([e.midi]);
      setTimeout(() => alive.current && setLit([]), 220);
      const want = notes[idx];
      if (e.midi % 12 === want % 12) {
        idx++;
        setTyped(idx);
        if (idx >= notes.length) finish();
        return;
      }
      swaps.current.push([want, e.midi]);
      if (tries.current === 0) {
        tries.current = 1;
        for (let k = idx; k < notes.length; k++) scores.current[k] = 0.5;
        scores.current[idx] = 0.2;
        setPhase('quase');
        setTimeout(() => alive.current && listen(true), 700);
      } else {
        for (let k = idx; k < notes.length; k++) scores.current[k] = 0;
        finish();
      }
    });
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const [lo, hi] = keyRange(notes);
  return (
    <>
      <div className={'m-cue ' + phase}>{phase === 'ouvir' ? 'Escute…' : phase === 'tocar' ? 'Sua vez: repita' : 'Quase. Agora com as teclas acesas.'}</div>
      <div className="dots m-dots">{notes.map((_, i) => <i key={i} className={i < typed ? 'on' : ''} />)}</div>
      <MiniKeys lo={lo} hi={hi} lit={lit} colored />
      <div className="actions center"><button className="btn ghost" disabled={phase !== 'tocar'} onClick={() => listen(tries.current > 0)}><Ear size={16} aria-hidden="true" />Ouvir de novo</button></div>
    </>
  );
}

// ---------- Leitura: a nota na pauta, você acha a tecla ----------

function LerRound({ notes, mind, onDone }: { notes: number[]; mind: Mind; onDone: (o: Outcome) => void }) {
  const alive = useAlive();
  const [k, setK] = useState(0);
  const [state, setState] = useState<'neutro' | 'certo' | 'errado'>('neutro');
  const [lit, setLit] = useState<number[]>([]);
  const t0 = useRef(performance.now());
  const res = useRef<Array<[string, number]>>([]);
  const swaps = useRef<Array<[number, number]>>([]);
  const target = lerTargetMs(mind.levels.ler);
  const cur = notes[k];
  const first = !mind.skills['ler:' + cur];

  useEffect(() => {
    if (k >= notes.length) return;
    t0.current = performance.now();
    setLit(first ? [cur] : []);
    let locked = false;
    return input.on((e) => {
      if (e.type !== 'on' || locked) return;
      echo(e);
      locked = true;
      const ms = performance.now() - t0.current;
      const ok = e.midi % 12 === cur % 12;
      let s = ok ? (ms <= target ? 1 : Math.max(0.5, target / ms)) : 0;
      if (first) s = Math.min(s, 0.6);
      res.current.push(['ler:' + cur, s]);
      if (!ok) swaps.current.push([cur, e.midi]);
      setState(ok ? 'certo' : 'errado');
      setLit([cur]);
      setTimeout(() => {
        if (!alive.current) return;
        setState('neutro');
        if (k + 1 >= notes.length) {
          const sc = avg(res.current.map((r) => r[1]));
          onDone({ score: sc, skills: byKey(res.current), swaps: swaps.current, msg: sc >= 0.85 ? 'Leitura rápida e certa.' : sc >= 0.5 ? 'Certo, mas ainda devagar. Vai acelerar.' : 'Essas notas voltam já já.' });
        } else setK(k + 1);
      }, ok ? 450 : 1100);
    });
  }, [k]); // eslint-disable-line react-hooks/exhaustive-deps

  if (k >= notes.length) return null;
  const [lo, hi] = keyRange(notes);
  return (
    <>
      <div className="m-cue tocar">Que nota é esta? Toque no piano.</div>
      <div className="m-staff"><NoteView midi={cur} flat={false} clef={cur >= 60 ? 'treble' : 'bass'} state={state} /></div>
      <p className="m-hint">{first ? <>Esta é o <b>{noteLabel(cur)}</b>. Veja onde ela fica.</> : state === 'errado' ? <>Era o <b>{noteLabel(cur)}</b>.</> : ' '}</p>
      <div className="dots m-dots">{notes.map((_, i) => <i key={i} className={i < k ? 'on' : ''} />)}</div>
      <MiniKeys lo={lo} hi={hi} lit={lit} colored />
    </>
  );
}

// ---------- Ritmo: o ritmo da frase numa tecla só ----------

function RitmoRound({ pattern, bpm, level, onDone }: { pattern: number[]; bpm: number; level: number; onDone: (o: Outcome) => void }) {
  const alive = useAlive();
  const [phase, setPhase] = useState<'ouvir' | 'conta' | 'tocar'>('ouvir');
  const [at, setAt] = useState(-1);
  const [count, setCount] = useState(0);
  const beatMs = 60000 / bpm;
  const starts = useMemo(() => pattern.reduce<number[]>((acc, d, i) => [...acc, i ? acc[i - 1] + pattern[i - 1] : 0], []), [pattern]);
  const total = pattern.reduce((a, b) => a + b, 0);

  const run = async (demo: boolean) => {
    setPhase(demo ? 'ouvir' : 'conta');
    const taps: number[] = [];
    const off = demo ? () => {} : input.on((e) => { if (e.type === 'on') { echo(e); taps.push(performance.now() - getSettings().latencyMs); } });
    const t0 = performance.now() + 300;
    const beats = 4 + Math.ceil(total);
    const timers: number[] = [];
    for (let b = 0; b < beats; b++) {
      timers.push(window.setTimeout(() => { if (!alive.current) return; click(b % 4 === 0); setCount(b < 4 ? b + 1 : 0); if (b === 4) setPhase(demo ? 'ouvir' : 'tocar'); }, 300 + b * beatMs));
    }
    starts.forEach((s, i) => timers.push(window.setTimeout(() => {
      if (!alive.current) return;
      setAt(i);
      if (demo) play(60, 0.8, Math.min(0.9, (pattern[i] * beatMs) / 1000 * 0.9));
    }, 300 + (4 + s) * beatMs)));
    await sleep(300 + (beats + 0.6) * beatMs);
    timers.forEach(clearTimeout);
    off();
    setAt(-1);
    return { taps, t0 };
  };

  useEffect(() => {
    (async () => {
      await run(true);
      if (!alive.current) return;
      await sleep(500);
      const { taps, t0 } = await run(false);
      if (!alive.current) return;
      const win = ritmoWindowMs(level);
      const used = new Set<number>();
      let early = 0, late = 0, n = 0;
      const per: Array<[string, number]> = starts.map((s, i) => {
        const want = t0 + (4 + s) * beatMs;
        let best = -1, bestD = Infinity;
        taps.forEach((t, j) => { const d = Math.abs(t - want); if (!used.has(j) && d < bestD) { best = j; bestD = d; } });
        if (best >= 0 && bestD <= win) {
          used.add(best);
          const off = taps[best] - want;
          n++; if (off < -35) early++; else if (off > 40) late++;
          return ['ritmo:' + pattern[i], 1 - Math.max(0, (bestD - win / 2) / win)];
        }
        return ['ritmo:' + pattern[i], 0];
      });
      const extra = Math.max(0, taps.length - used.size);
      const sc = Math.max(0, avg(per.map((p) => p[1])) - 0.08 * extra);
      onDone({
        score: sc, skills: byKey(per), swaps: [], timing: { early, late, n },
        msg: sc >= 0.85 ? 'Ritmo no lugar.' : early > late + 1 ? 'Você adiantou algumas notas. Espere o clique.' : late > early + 1 ? 'Algumas notas saíram atrasadas.' : 'Quase. O ritmo volta mais devagar.',
      });
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className={'m-cue ' + (phase === 'tocar' ? 'tocar' : 'ouvir')}>
        {phase === 'ouvir' ? 'Escute o ritmo…' : phase === 'conta' ? (count ? `Prepare: ${count}` : 'Prepare…') : 'Agora você, em qualquer tecla'}
      </div>
      <div className="m-rhythm" aria-hidden="true">
        {pattern.map((d, i) => <span key={i} className={i === at ? 'on' : ''} style={{ flexGrow: d }}><i /></span>)}
      </div>
      <p className="m-hint muted small">{bpm} BPM · cada bloco dura o tamanho da nota</p>
    </>
  );
}

// ---------- Frase: tocar a música, o app acompanha seguindo você ----------

function FraseRound({ notes, lh, hint, bpm, onDone }: { notes: SongNote[]; lh: SongNote[]; hint: Hint; bpm: number; onDone: (o: Outcome) => void }) {
  const alive = useAlive();
  const [phase, setPhase] = useState<'demo' | 'tocar'>(hint === 'tecla' ? 'demo' : 'tocar');
  const [idx, setIdx] = useState(0);
  const [lit, setLit] = useState<number[]>([]);
  const [bad, setBad] = useState(false);
  const durs = useMemo(() => iois(notes), [notes]);
  const firstTry = useRef<boolean[]>(notes.map(() => true));
  const times = useRef<number[]>([]);
  const swaps = useRef<Array<[number, number]>>([]);
  const beatMs = useRef(60000 / bpm);

  const accompany = (k: number) => {
    const from = notes[k].beat, to = notes[k + 1]?.beat ?? from + notes[k].beats;
    lh.filter((n) => n.beat >= from && n.beat < to).forEach((n) => {
      const delay = (n.beat - from) * beatMs.current;
      const go = () => alive.current && play(n.midi, 0.45, (n.beats * beatMs.current) / 1000);
      delay < 10 ? go() : setTimeout(go, delay);
    });
  };

  useEffect(() => {
    if (phase !== 'demo') return;
    (async () => {
      await sleep(400);
      const spb = 60000 / bpm;
      for (let k = 0; k < notes.length; k++) {
        if (!alive.current) return;
        setIdx(k);
        setLit([notes[k].midi]);
        play(notes[k].midi, 0.8, (durs[k] * spb * 0.95) / 1000);
        accompany(k);
        await sleep(durs[k] * spb);
      }
      if (!alive.current) return;
      setLit([]);
      setIdx(0);
      await sleep(500);
      setPhase('tocar');
    })();
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase !== 'tocar') return;
    let k = 0;
    if (hint === 'tecla') setLit([notes[0].midi]);
    return input.on((e) => {
      if (e.type !== 'on' || k >= notes.length) return;
      echo(e);
      const want = notes[k].midi;
      if (e.midi % 12 !== want % 12) {
        firstTry.current[k] = false;
        swaps.current.push([want, e.midi]);
        setBad(true);
        setTimeout(() => alive.current && setBad(false), 350);
        return;
      }
      times.current[k] = performance.now();
      // o acompanhamento segue o SEU andamento
      if (k > 0) {
        const per = (times.current[k] - times.current[k - 1]) / durs[k - 1];
        if (per > 150 && per < 3000) beatMs.current = beatMs.current * 0.5 + per * 0.5;
      }
      accompany(k);
      k++;
      setIdx(k);
      setLit(hint === 'tecla' && k < notes.length ? [notes[k].midi] : []);
      if (k < notes.length) return;

      const pitch = avg(firstTry.current.map((v) => (v ? 1 : 0)));
      const ratios = durs.slice(0, -1).map((d, i) => (times.current[i + 1] - times.current[i]) / d);
      const med = median(ratios);
      const dev = ratios.map((r) => Math.abs(Math.log2(r / med)));
      const rhythm = ratios.length >= 2 ? Math.max(0, 1 - avg(dev) * 1.6) : 1;
      const cap = hint === 'tecla' ? 0.6 : hint === 'nome' ? 0.85 : 1;
      const score = Math.min(cap, 0.7 * pitch + 0.3 * rhythm);
      const pairs: Array<[string, number]> = notes.map((n, i) => ['tecla:' + n.midi, Math.min(hint === 'tecla' ? 0.5 : 1, firstTry.current[i] ? 1 : 0)]);
      dev.forEach((d, i) => pairs.push(['ritmo:' + durs[i], Math.max(0, 1 - d * 2)]));
      const playedBpm = Math.round(60000 / med);
      setTimeout(() => alive.current && onDone({
        score, skills: byKey(pairs), swaps: swaps.current,
        msg: `${Math.round(pitch * 100)}% das notas de primeira · ritmo ${Math.round(rhythm * 100)}% · ~${playedBpm} BPM`,
      }), 600);
    });
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const [lo, hi] = keyRange(notes.map((n) => n.midi));
  return (
    <>
      <div className={'m-cue ' + (phase === 'demo' ? 'ouvir' : bad ? 'quase' : 'tocar')}>
        {phase === 'demo' ? 'Veja e escute primeiro…' : bad ? 'Essa não. Procure de novo.' : hint === 'tecla' ? 'Sua vez: siga as teclas acesas' : hint === 'nome' ? 'Sua vez: pelos nomes' : 'De cor. Você consegue.'}
      </div>
      <div className="m-notes" aria-label="Notas da frase">
        {notes.map((n, i) => (
          <span key={i} className={'m-note' + (i < idx ? ' done' : i === idx ? ' now' : '')} style={{ '--nc': noteColor(n.midi), flexGrow: durs[i] } as React.CSSProperties}>
            {hint === 'nada' && i >= idx ? '' : noteLabel(n.midi)}
          </span>
        ))}
      </div>
      <MiniKeys lo={lo} hi={hi} lit={lit} colored={hint !== 'nada'} />
    </>
  );
}

// ---------- sessão ----------

function apply(mind: Mind, round: Round, o: Outcome): Mind {
  const day = todayStr();
  let m = mind;
  Object.entries(o.skills).forEach(([k, v]) => { m = updateSkill(m, k, v, day); });
  if (round.kind === 'frase') round.phrases.forEach((i) => { m = updateSkill(m, `frase:${mind.songId}:${i}`, o.score, day); });
  o.swaps.forEach(([a, b]) => { m = recordConfusion(m, a, b); });
  const lv = { ...m.levels };
  if (round.kind === 'eco') lv.eco = stepLevel(lv.eco, o.score);
  if (round.kind === 'ler') lv.ler = stepLevel(lv.ler, o.score);
  if (round.kind === 'ritmo') lv.ritmo = stepLevel(lv.ritmo, o.score);
  const t = o.timing ? { early: m.timing.early + o.timing.early, late: m.timing.late + o.timing.late, n: m.timing.n + o.timing.n } : m.timing;
  return { ...m, levels: lv, timing: t };
}

const KIND: Record<Round['kind'], { label: string; Icon: typeof Ear }> = {
  eco: { label: 'Ouvido', Icon: Ear },
  ler: { label: 'Leitura', Icon: BookOpen },
  ritmo: { label: 'Ritmo', Icon: Timer },
  frase: { label: 'Música', Icon: Music2 },
};

export function Mestre() {
  const mind = useMind();
  const piece = pieceById(mind.songId) ?? BUILTIN_PIECES[0];
  const song = useMemo(() => songFor(mind), [mind.songId]); // eslint-disable-line react-hooks/exhaustive-deps
  const phrases = useMemo(() => phrasesOf(song), [song]);
  const [stage, setStage] = useState<'inicio' | 'rodada' | 'fim'>('inicio');
  const [round, setRound] = useState<Round | null>(null);
  const [n, setN] = useState(0);
  const [result, setResult] = useState<Outcome | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const history = useRef<Round['kind'][]>([]);
  const before = useRef<Mind>(mind);
  const t0 = useRef(0);
  const limit = useRef(SESSION_SEC);

  useEffect(() => {
    if (stage !== 'rodada') return;
    const t = setInterval(() => setElapsed(Math.round((performance.now() - t0.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [stage]);

  const fm = (i: number, m = mind) => mastery(m, `frase:${m.songId}:${i}`);
  const diag = diagnose(mind, piece.title);
  const doneSong = phrases.every((p) => fm(p.i) >= 0.8);

  const begin = async (extra = 0) => {
    await startAudio().catch(() => {});
    if (!extra) { before.current = mind; history.current = []; t0.current = performance.now(); setElapsed(0); limit.current = SESSION_SEC; }
    else limit.current = elapsed + extra;
    setResult(null);
    setRound(nextRound(mind, song, history.current));
    setN((x) => x + 1);
    setStage('rodada');
  };

  const finish = (m: Mind) => {
    const sec = Math.round((performance.now() - t0.current) / 1000);
    addMinutes(sec);
    saveMind({ ...m, sessions: [...m.sessions, { day: todayStr(), rounds: history.current.length, sec }].slice(-200) });
    setStage('fim');
  };

  const onDone = (o: Outcome) => {
    if (!round) return;
    history.current.push(round.kind);
    let m = apply(mind, round, o);
    if (round.kind === 'frase' && round.phrases.length === phrases.length && o.score >= 0.8 && !m.learned.includes(m.songId)) m = { ...m, learned: [...m.learned, m.songId] };
    saveMind(m);
    setResult(o);
    setTimeout(() => {
      if ((performance.now() - t0.current) / 1000 >= limit.current) { finish(m); return; }
      setResult(null);
      setRound(nextRound(m, song, history.current));
      setN((x) => x + 1);
    }, 1700);
  };

  const pickSong = (id: string) => saveMind({ ...mind, songId: id });

  if (stage === 'inicio') {
    const nextSong = SONG_LADDER.find((id) => id !== mind.songId && !mind.learned.includes(id));
    return (
      <div className="page wide mestre">
        <header className="page-head">
          <p className="eyebrow">Sessão com o professor · 10 min</p>
          <h1>Aprender tocando</h1>
          <p className="muted">Você escolhe a música. O app quebra em frases, descobre o que falta em você e monta cada exercício na hora. Sem lição fixa.</p>
        </header>
        <div className="home-grid">
          <div className="home-main">
            <section className="hero">
              <div className="hero-text">
                <p className="hero-eyebrow">Música de agora</p>
                <h2 className="hero-title">{piece.title}</h2>
                <p className="hero-goal">{doneSong ? 'Você já toca esta inteira. Escolha a próxima abaixo.' : `${phrases.filter((p) => fm(p.i) >= 0.8).length} de ${phrases.length} frases dominadas`}</p>
                <div className="m-phrases" aria-label="Frases da música">
                  {phrases.map((p) => <span key={p.i} title={`Frase ${p.i + 1}`} style={{ '--f': Math.min(1, fm(p.i) / 0.8) } as React.CSSProperties}><i /></span>)}
                </div>
              </div>
              <button className="hero-play" onClick={() => begin()} aria-label="Começar a sessão"><Play size={28} fill="currentColor" /></button>
            </section>
            <section className="card">
              <div className="card-head"><h2>Trocar de música</h2>{doneSong && nextSong && <button className="btn small" onClick={() => pickSong(nextSong)}>Próxima sugerida</button>}</div>
              <div className="m-songs">
                {SONG_LADDER.map((id) => pieceById(id)).filter(Boolean).map((p) => (
                  <button key={p!.id} className={'m-song' + (p!.id === mind.songId ? ' on' : '')} onClick={() => pickSong(p!.id)}>
                    {mind.learned.includes(p!.id) && <Check size={14} aria-hidden="true" />}{p!.title}
                  </button>
                ))}
              </div>
            </section>
          </div>
          <aside className="home-side">
            <section className="card">
              <div className="card-head"><h2>O que o professor vê</h2></div>
              {Object.keys(mind.skills).length === 0 ? (
                <p className="muted small">Ainda nada. Na primeira sessão ele observa cada nota que você toca: qual tecla demora, qual você troca, se adianta ou atrasa.</p>
              ) : (
                <ul className="m-diag">
                  {diag.weak.map((w) => <li key={w.key}><span>{w.label}</span><span className="meter"><i style={{ width: w.m * 100 + '%' }} /></span></li>)}
                  {diag.swaps.map((s) => <li key={s} className="muted small">{s}</li>)}
                  {diag.tempo && <li className="muted small">{diag.tempo}</li>}
                  {!diag.weak.length && !diag.swaps.length && !diag.tempo && <li className="muted small">Nenhum ponto fraco claro ainda. Segue o plano.</li>}
                </ul>
              )}
            </section>
            <section className="card">
              <div className="card-head"><h2>Como funciona</h2></div>
              <ol className="steps">
                <li>Rodadas de 30 segundos. O app escolhe; você só toca.</li>
                <li>Errou uma tecla ou um ritmo? A próxima rodada treina só aquilo, com o pedaço real da música.</li>
                <li>As ajudas somem conforme você domina: teclas acesas, depois nomes, depois de cor.</li>
                <li>A outra mão o app toca, seguindo o seu tempo.</li>
              </ol>
            </section>
          </aside>
        </div>
      </div>
    );
  }

  if (stage === 'fim') {
    const gains = Object.keys(mind.skills)
      .map((k) => ({ k, d: mastery(mind, k) - mastery(before.current, k), m: mastery(mind, k) }))
      .filter((g) => g.d > 0.02)
      .sort((a, b) => b.d - a.d)
      .slice(0, 6);
    return (
      <div className="page narrow mestre">
        <section className="hero">
          <span className="hero-badge" aria-hidden="true"><Sparkles size={26} /></span>
          <div className="hero-text">
            <p className="hero-eyebrow">Sessão feita · {history.current.length} rodadas · {Math.round(elapsed / 60)} min</p>
            <h1 className="hero-title">O que melhorou hoje</h1>
          </div>
        </section>
        <section className="card">
          {gains.length ? (
            <ul className="m-gains">
              {gains.map((g) => (
                <li key={g.k}>
                  <TrendingUp size={16} aria-hidden="true" />
                  <span>{skillLabel(g.k, piece.title)}</span>
                  <span className="meter"><i style={{ width: g.m * 100 + '%' }} /></span>
                  <span className="num small">+{Math.round(g.d * 100)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="muted">Hoje foi de consolidar. Amanhã o professor volta no que ficou fraco.</p>}
          <div className="actions">
            <button className="btn" onClick={() => begin(5 * 60)}><Play size={16} aria-hidden="true" />Mais 5 minutos</button>
            <a className="btn ghost" href="#/">Terminar</a>
          </div>
        </section>
      </div>
    );
  }

  const meta = round ? KIND[round.kind] : null;
  const fragNotes = round?.kind === 'frase' ? round.phrases.flatMap((i) => phrases[i].notes) : [];
  const fragLh = round?.kind === 'frase' ? round.phrases.flatMap((i) => phrases[i].lh) : [];
  return (
    <div className="page narrow mestre">
      <div className="m-top">
        <button className="btn ghost small" onClick={() => finish(mind)}><X size={16} aria-hidden="true" />Encerrar</button>
        <span className="meter m-time"><i style={{ width: Math.min(100, (elapsed / limit.current) * 100) + '%' }} /></span>
        <span className="muted small num">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}</span>
      </div>
      {round && meta && (
        <section className="card m-card">
          <p className="eyebrow m-kind"><meta.Icon size={15} aria-hidden="true" />{meta.label}</p>
          <p className="m-why">{round.why}</p>
          {result ? (
            <div className={'m-result ' + (result.score >= 0.8 ? 'ok' : result.score >= 0.5 ? 'meio' : 'baixo')}>
              <span className="m-score num">{Math.round(result.score * 100)}%</span>
              <span>{result.msg}</span>
            </div>
          ) : round.kind === 'eco' ? <EcoRound key={n} notes={round.notes} onDone={onDone} />
            : round.kind === 'ler' ? <LerRound key={n} notes={round.notes} mind={mind} onDone={onDone} />
            : round.kind === 'ritmo' ? <RitmoRound key={n} pattern={round.pattern} bpm={round.bpm} level={mind.levels.ritmo} onDone={onDone} />
            : <FraseRound key={n} notes={fragNotes} lh={fragLh} hint={round.hint} bpm={Math.min(song.bpm, 80)} onDone={onDone} />}
        </section>
      )}
      <p className="muted small center">Nível do ouvido {mind.levels.eco} · ritmo {mind.levels.ritmo} · leitura {mind.levels.ler} · frases de até {ecoLength(mind.levels.eco)} notas no eco</p>
      <a className="link" href="#/"><ArrowLeft size={15} aria-hidden="true" /> Sair</a>
    </div>
  );
}

