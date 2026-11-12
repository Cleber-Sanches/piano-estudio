import { useCallback, useEffect, useRef, useState } from 'react';
import { onPianoLoad, play, startAudio } from '../engine/audio';
import { input } from '../engine/input';
import { recordGame } from '../lib/progress';
import { isBlack, PITCH_PT } from '../lib/theory';

// Jogos sem partitura: eco (ouvir e repetir) e improviso livre sobre um acompanhamento.

/** Uma cor por nota (Dó vermelho … Si rosa), igual para adulto e criança. */
export const NOTE_COLORS = ['#E5484D', '#E5484D', '#F76B15', '#F76B15', '#F5C400', '#30A46C', '#30A46C', '#12A594', '#12A594', '#3E63DD', '#3E63DD', '#D6409F'];
export const noteColor = (midi: number) => NOTE_COLORS[((midi % 12) + 12) % 12];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Teclado pequeno na tela: mostra as teclas liberadas, as acesas e aceita toque. */
export function MiniKeys({ lo, hi, pool, lit = [], colored = false, big = false }: { lo: number; hi: number; pool?: number[]; lit?: number[]; colored?: boolean; big?: boolean }) {
  const whites: number[] = [];
  for (let m = lo; m <= hi; m++) if (!isBlack(m)) whites.push(m);
  const w = 100 / whites.length;
  const tap = (m: number) => { input.emit('on', m, 0.7, 'tela'); setTimeout(() => input.emit('off', m, 0, 'tela'), 250); };
  const style = (m: number) => {
    const on = lit.includes(m);
    const inPool = !pool || pool.includes(m);
    if (on) return { background: noteColor(m) };
    if (colored && inPool) return { background: noteColor(m), opacity: 0.35 };
    return inPool ? undefined : { opacity: 0.45 };
  };
  return (
    <div className={'mini-keys' + (big ? ' big' : '')} aria-hidden="true">
      {whites.map((m) => <button key={m} tabIndex={-1} className="mk-white" style={style(m)} onPointerDown={() => tap(m)} />)}
      {whites.map((m, i) => (isBlack(m + 1) && m + 1 <= hi
        ? <button key={'b' + m} tabIndex={-1} className="mk-black" style={{ left: `calc(${(i + 1) * w}% - ${w * 0.3}%)`, width: `${w * 0.6}%`, ...(lit.includes(m + 1) ? { background: noteColor(m + 1) } : {}) }} onPointerDown={() => tap(m + 1)} />
        : null))}
    </div>
  );
}

function PianoStatus() {
  const [p, setP] = useState(0);
  useEffect(() => onPianoLoad(setP), []);
  if (p === 1) return null;
  return <p className="muted small">{p < 0 ? 'Sem o som do app (precisa de internet na primeira vez).' : 'Carregando o som do piano…'}</p>;
}

/** Eco: o app toca uma frase curta, você repete. Vale a nota em qualquer oitava. */
export function EarGame({ id, title, detail, pool, length = 3, rounds = 8, kid = false, onExit }: {
  id: string; title: string; detail: string; pool: number[]; length?: number; rounds?: number; kid?: boolean; onExit: () => void;
}) {
  const [phase, setPhase] = useState<'inicio' | 'ouvir' | 'tocar' | 'certo' | 'errado' | 'fim'>('inicio');
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [lit, setLit] = useState<number[]>([]);
  const [typed, setTyped] = useState(0);
  const phrase = useRef<number[]>([]);
  const tries = useRef(0);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const playPhrase = useCallback(async () => {
    setPhase('ouvir');
    setTyped(0);
    await sleep(400);
    for (const m of phrase.current) {
      if (!alive.current) return;
      play(m, 0.8, 0.55);
      if (kid) setLit([m]);
      await sleep(kid ? 750 : 620);
      setLit([]);
    }
    if (alive.current) setPhase('tocar');
  }, [kid]);

  const newRound = useCallback(() => {
    const ph: number[] = [];
    // começa perto do Dó e anda por graus próximos, como numa melodia
    let i = Math.floor(Math.random() * Math.min(3, pool.length));
    for (let k = 0; k < length; k++) {
      ph.push(pool[i]);
      const step = [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)];
      i = Math.max(0, Math.min(pool.length - 1, i + step));
    }
    phrase.current = ph;
    tries.current = 0;
    playPhrase();
  }, [pool, length, playPhrase]);

  const start = async () => {
    await startAudio().catch(() => {});
    setRound(0);
    setScore(0);
    newRound();
  };

  const finishRound = useCallback((ok: boolean) => {
    if (ok && tries.current === 0) setScore((s) => s + 1);
    setPhase(ok ? 'certo' : 'errado');
    setTimeout(() => {
      if (!alive.current) return;
      setRound((r) => {
        const nr = r + 1;
        if (nr >= rounds) { setPhase('fim'); return nr; }
        newRound();
        return nr;
      });
    }, ok ? 900 : 1600);
  }, [rounds, newRound]);

  useEffect(() => {
    if (phase !== 'tocar') return;
    let idx = 0;
    return input.on((e) => {
      if (e.type !== 'on') return;
      setLit([e.midi]);
      setTimeout(() => setLit([]), 250);
      const want = phrase.current[idx];
      if (e.midi % 12 === want % 12) {
        idx++;
        setTyped(idx);
        if (idx >= phrase.current.length) finishRound(true);
      } else if (tries.current === 0) {
        tries.current = 1;
        setPhase('errado');
        setTimeout(() => { if (alive.current) playPhrase(); }, 900);
      } else {
        finishRound(false);
      }
    });
  }, [phase, finishRound, playPhrase]);

  const passed = score >= Math.ceil(rounds * 0.75);
  useEffect(() => {
    if (phase === 'fim') recordGame(id, title, score / rounds, kid || passed);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const lo = Math.min(...pool) - (Math.min(...pool) % 12 === 0 ? 0 : 0);
  const hi = Math.max(...pool);
  return (
    <div className={'page game' + (kid ? ' kid' : '')}>
      <button className="btn ghost small" onClick={onExit}>← Voltar</button>
      <section className="card game-card">
        <p className="eyebrow">Ouvido</p>
        <h1>{title}</h1>
        {phase === 'inicio' && (
          <>
            <p className="muted">{detail} Ouça, depois toque as mesmas notas no piano. Se errar, a frase toca de novo uma vez.</p>
            <div className="actions"><button className="btn big" onClick={start}>Começar</button></div>
          </>
        )}
        {phase !== 'inicio' && phase !== 'fim' && (
          <>
            <div className="game-status">
              <span className="mono">Rodada {Math.min(round + 1, rounds)}/{rounds}</span>
              <span className="mono">Acertos: {score}</span>
            </div>
            <div className={'game-msg ' + phase}>
              {phase === 'ouvir' && (kid ? '👂 Escute…' : 'Escute…')}
              {phase === 'tocar' && (kid ? '🎹 Sua vez!' : 'Sua vez: toque a frase')}
              {phase === 'certo' && (kid ? '🌟 Isso!' : 'Certo!')}
              {phase === 'errado' && (kid ? '🙂 Quase! De novo…' : 'Quase. Ouça de novo.')}
            </div>
            <div className="dots" aria-label={`${typed} de ${length} notas`}>
              {Array.from({ length }, (_, i) => <i key={i} className={i < typed ? 'on' : ''} />)}
            </div>
            <MiniKeys lo={lo} hi={hi} pool={pool} lit={lit} colored={kid} big={kid} />
            <div className="actions">
              <button className="btn ghost" disabled={phase !== 'tocar'} onClick={playPhrase}>Ouvir de novo</button>
            </div>
          </>
        )}
        {phase === 'fim' && (
          <>
            <div className="game-msg certo">{kid ? '🎉' : ''} {score} de {rounds} de primeira</div>
            <p className="muted">{passed || kid ? 'Missão feita. Amanhã o ouvido vai estar ainda melhor.' : `Para concluir a missão: ${Math.ceil(rounds * 0.75)} de primeira. Tente de novo outro dia ou agora.`}</p>
            <div className="actions">
              <button className="btn" onClick={start}>Jogar de novo</button>
              <button className="btn ghost" onClick={onExit}>Voltar</button>
            </div>
          </>
        )}
        <PianoStatus />
      </section>
    </div>
  );
}

interface Bubble { key: number; midi: number; x: number; size: number }

/** Improviso livre: acompanhamento do app e você inventa. Conta só o tempo em que você está tocando. */
export function Jam({ id, title, detail, pool, backing, seconds = 120, kid = false, onExit }: {
  id: string; title: string; detail: string; pool: number[]; backing?: { roots: number[]; minor?: boolean[]; bpm: number }; seconds?: number; kid?: boolean; onExit: () => void;
}) {
  const [running, setRunning] = useState(false);
  const [played, setPlayed] = useState(0);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [lit, setLit] = useState<number[]>([]);
  const [done, setDone] = useState(false);
  const lastNote = useRef(0);
  const counter = useRef(0);

  // acompanhamento: baixo no tempo 1, acorde suave nos tempos 1 e 3
  useEffect(() => {
    if (!running || !backing) return;
    const beatMs = 60000 / backing.bpm;
    let beat = 0;
    const tick = () => {
      const bar = Math.floor(beat / 4) % backing.roots.length;
      const root = backing.roots[bar];
      const minor = backing.minor?.[bar];
      const b = beat % 4;
      if (b === 0) play(root, 0.55, (beatMs * 3.5) / 1000);
      if (b === 0 || b === 2) {
        const r = root + 12;
        [r, r + (minor ? 3 : 4), r + 7].forEach((m) => play(m, 0.3, (beatMs * 1.8) / 1000));
      }
      beat++;
    };
    tick();
    const t = setInterval(tick, beatMs);
    return () => clearInterval(t);
  }, [running, backing]);

  // tempo tocando: conta 1 s sempre que houve nota nos últimos 2 s
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      if (performance.now() - lastNote.current < 2000) setPlayed((p) => p + 1);
    }, 1000);
    return () => clearInterval(t);
  }, [running]);

  useEffect(() => {
    if (!running) return;
    return input.on((e) => {
      if (e.type === 'off') { setLit((l) => l.filter((m) => m !== e.midi)); return; }
      lastNote.current = performance.now();
      setLit((l) => [...l, e.midi]);
      const k = ++counter.current;
      const x = Math.max(4, Math.min(96, ((e.midi - 36) / 60) * 100));
      setBubbles((bs) => [...bs.slice(-24), { key: k, midi: e.midi, x, size: 30 + e.velocity * (kid ? 90 : 40) }]);
      setTimeout(() => setBubbles((bs) => bs.filter((b) => b.key !== k)), 1600);
    });
  }, [running, kid]);

  useEffect(() => {
    if (!done && seconds && played >= seconds) {
      setDone(true);
      recordGame(id, title, 1, true);
    }
  }, [played, seconds, done, id, title]);

  const start = async () => {
    await startAudio().catch(() => {});
    setPlayed(0);
    setRunning(true);
  };
  const stop = () => {
    setRunning(false);
    if (!done && played >= 20 && kid) recordGame(id, title, 1, true);
  };

  const lo = Math.min(...pool) - 5;
  const hi = Math.max(...pool) + 5;
  return (
    <div className={'page game' + (kid ? ' kid' : '')}>
      <button className="btn ghost small" onClick={() => { setRunning(false); onExit(); }}>← Voltar</button>
      <section className="card game-card">
        <p className="eyebrow">{kid ? 'Brincar' : 'Criar'}</p>
        <h1>{title}</h1>
        <p className="muted">{detail}</p>
        {!kid && <p className="muted small">Notas liberadas: {[...new Set(pool.map((m) => PITCH_PT[m % 12]))].join(' · ')}. Dica: repita uma ideia curta e mude só um pedaço dela.</p>}
        <div className={'bubbles' + (kid ? ' big' : '')} aria-hidden="true">
          {bubbles.map((b) => <span key={b.key} className="bubble" style={{ left: b.x + '%', width: b.size, height: b.size, background: noteColor(b.midi) }} />)}
        </div>
        <MiniKeys lo={lo} hi={hi} pool={pool} lit={lit} colored={kid} big={kid} />
        {seconds > 0 && !kid && (
          <div className="meter" aria-label={`${played} de ${seconds} segundos`}>
            <i style={{ width: Math.min(100, (played / seconds) * 100) + '%' }} />
          </div>
        )}
        <div className="actions">
          {running ? <button className="btn ghost" onClick={stop}>Parar</button> : <button className="btn big" onClick={start}>{played ? 'Continuar' : 'Começar'}</button>}
          {!kid && <span className="muted small mono">{Math.floor(played / 60)}:{String(played % 60).padStart(2, '0')} tocando</span>}
          {done && <span className="ok">{kid ? '🌟' : 'Missão feita.'} Pode continuar quanto quiser.</span>}
        </div>
        <PianoStatus />
      </section>
    </div>
  );
}
