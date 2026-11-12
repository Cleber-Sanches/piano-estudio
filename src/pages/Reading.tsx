import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Accidental, Formatter, Renderer, Stave, StaveNote, Voice } from 'vexflow';
import { startAudio, play } from '../engine/audio';
import { input } from '../engine/input';
import { load, recordReading, subscribe } from '../lib/progress';
import { useSettings } from '../lib/settings';
import { isBlack, PITCH_PT } from '../lib/theory';

// Leitura relâmpago: uma nota na pauta, você aperta a tecla. 20 notas por rodada.

interface Level {
  n: number;
  title: string;
  lo: number;
  hi: number;
  black: boolean;
}

export const READING_LEVELS: Level[] = [
  { n: 1, title: 'Clave de sol: Dó a Sol', lo: 60, hi: 67, black: false },
  { n: 2, title: 'Clave de sol: Dó a Dó', lo: 60, hi: 72, black: false },
  { n: 3, title: 'Clave de fá: Dó a Dó central', lo: 48, hi: 60, black: false },
  { n: 4, title: 'Clave de sol: Dó central ao Sol agudo', lo: 60, hi: 79, black: false },
  { n: 5, title: 'Clave de fá: Sol grave ao Dó central', lo: 43, hi: 60, black: false },
  { n: 6, title: 'As duas claves misturadas', lo: 43, hi: 79, black: false },
  { n: 7, title: 'Com sustenidos e bemóis', lo: 48, hi: 72, black: true },
];

const ROUND = 20;
const SHARP = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
const FLAT = ['c', 'db', 'd', 'eb', 'e', 'f', 'gb', 'g', 'ab', 'a', 'bb', 'b'];

function pickNotes(level: Level): Array<{ midi: number; flat: boolean }> {
  const pool: number[] = [];
  for (let m = level.lo; m <= level.hi; m++) if (level.black || !isBlack(m)) pool.push(m);
  const out: Array<{ midi: number; flat: boolean }> = [];
  let last = -1;
  while (out.length < ROUND) {
    const m = pool[Math.floor(Math.random() * pool.length)];
    if (m === last) continue;
    last = m;
    out.push({ midi: m, flat: Math.random() < 0.5 });
  }
  return out;
}

function clefFor(level: Level, midi: number): 'treble' | 'bass' {
  if (level.hi <= 60) return 'bass';
  if (level.lo >= 60) return 'treble';
  return midi >= 60 ? 'treble' : 'bass';
}

export function NoteView({ midi, flat, clef, state }: { midi: number; flat: boolean; clef: 'treble' | 'bass'; state: 'neutro' | 'certo' | 'errado' }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = host.current!;
    el.innerHTML = '';
    const r = new Renderer(el, Renderer.Backends.SVG);
    r.resize(240, 150);
    const ctx = r.getContext();
    ctx.scale(1.6, 1.6);
    const stave = new Stave(4, 0, 140);
    stave.addClef(clef).setContext(ctx).draw();
    const pc = midi % 12;
    const name = (flat ? FLAT : SHARP)[pc];
    const key = `${name}/${Math.floor(midi / 12) - 1}`;
    const n = new StaveNote({ keys: [key], duration: 'w', clef });
    if (name.length > 1) n.addModifier(new Accidental(name.endsWith('#') ? '#' : 'b'), 0);
    const color = state === 'certo' ? '#2E8B57' : state === 'errado' ? '#D2453D' : '#17171B';
    n.setStyle({ fillStyle: color, strokeStyle: color });
    const v = new Voice({ num_beats: 4, beat_value: 4 }).addTickables([n]);
    new Formatter().joinVoices([v]).format([v], 60);
    v.draw(ctx, stave);
  }, [midi, flat, clef, state]);
  return <div className="reading-note" ref={host} aria-label="Nota na pauta" />;
}

function namePt(midi: number) {
  return `${PITCH_PT[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

export function Reading() {
  const store = useSyncExternalStore(subscribe, load);
  const settings = useSettings();
  const [level, setLevel] = useState<Level | null>(null);
  const [notes, setNotes] = useState<Array<{ midi: number; flat: boolean }>>([]);
  const [i, setI] = useState(0);
  const [state, setState] = useState<'neutro' | 'certo' | 'errado'>('neutro');
  const [msg, setMsg] = useState('');
  const [done, setDone] = useState<{ acc: number; ms: number; unlocked: boolean } | null>(null);
  const firstTry = useRef<boolean[]>([]);
  const times = useRef<number[]>([]);
  const shownAt = useRef(0);
  const wrong = useRef(0);
  const busy = useRef(false);

  const start = useCallback((lv: Level) => {
    startAudio();
    setLevel(lv);
    setNotes(pickNotes(lv));
    setI(0);
    setState('neutro');
    setMsg('');
    setDone(null);
    firstTry.current = [];
    times.current = [];
    wrong.current = 0;
    shownAt.current = performance.now();
  }, []);

  const current = notes[i];

  useEffect(() => {
    if (!level || !current || done) return;
    return input.on((e) => {
      if (e.type !== 'on' || busy.current) return;
      if (settings.soundMine) play(e.midi, 0.6, 0.6);
      if (e.midi === current.midi) {
        busy.current = true;
        if (firstTry.current[i] === undefined) firstTry.current[i] = true;
        times.current.push(performance.now() - shownAt.current);
        setState('certo');
        setMsg(namePt(current.midi).replace(/\d+$/, ''));
        setTimeout(() => {
          busy.current = false;
          if (i + 1 >= ROUND) {
            const hits = firstTry.current.filter(Boolean).length;
            const acc = hits / ROUND;
            const ms = times.current.reduce((a, b) => a + b, 0) / times.current.length;
            const r = recordReading(level.n, `Leitura nível ${level.n}: ${level.title}`, acc, ms, hits, ROUND, wrong.current, READING_LEVELS.length);
            setDone({ acc, ms, unlocked: r.unlocked });
          } else {
            setI(i + 1);
            setState('neutro');
            setMsg('');
            shownAt.current = performance.now();
          }
        }, 350);
      } else {
        firstTry.current[i] = false;
        wrong.current++;
        setState('errado');
        const sameName = e.midi % 12 === current.midi % 12;
        setMsg(sameName ? 'Nota certa, oitava errada. Procure a mesma nota em outra altura.' : `Você tocou ${namePt(e.midi).replace(/\d+$/, '')}. Tente de novo.`);
      }
    });
  }, [level, current, i, done, settings.soundMine]);

  const kbRange = useMemo(() => {
    if (!level) return [60, 72];
    const lo = level.lo - (level.lo % 12);
    const hi = level.hi + ((12 - (level.hi % 12)) % 12);
    return [lo, hi];
  }, [level]);

  if (!level) {
    return (
      <div className="page">
        <section className="card">
          <p className="eyebrow">5 minutos por dia</p>
          <h1>Leitura relâmpago</h1>
          <p className="muted">Aparece uma nota na pauta e você aperta a tecla no piano. Sem pressa no começo: acertar vem primeiro, a velocidade vem com os dias. Para liberar o próximo nível: 90% de acerto na primeira tentativa e até 2,5 s por nota.</p>
        </section>
        <section className="lesson-list">
          {READING_LEVELS.map((lv) => {
            const best = store.reading.best[lv.n];
            const open = lv.n <= store.reading.level;
            return (
              <button key={lv.n} className={'lesson ' + (open ? (lv.n === store.reading.level ? 'atual' : 'feita') : 'bloqueada')} onClick={() => open && start(lv)} disabled={!open}>
                <span className="lesson-dot" aria-hidden="true" />
                <span className="lesson-main">
                  <span className="lesson-title">Nível {lv.n} · {lv.title}</span>
                  <span className="lesson-meta">
                    {best ? `Melhor: ${Math.round(best.accuracy * 100)}% · ${(best.avgMs / 1000).toFixed(1)} s por nota` : open ? 'Ainda não jogado' : 'Libere o nível anterior'}
                  </span>
                </span>
                <span className="lesson-tag">{open ? 'Jogar' : ''}</span>
              </button>
            );
          })}
        </section>
      </div>
    );
  }

  if (done) {
    return (
      <div className="page">
        <section className="card">
          <h1>{done.acc >= 0.9 ? 'Boa leitura' : 'Continue treinando'}</h1>
          <div className="result-stats light">
            <div><b className="mono">{Math.round(done.acc * 100)}%</b><span>certas de primeira</span></div>
            <div><b className="mono">{(done.ms / 1000).toFixed(1)} s</b><span>por nota</span></div>
          </div>
          <p className="muted">
            {done.unlocked ? 'Próximo nível liberado.' : done.acc < 0.9 ? 'Use as linhas de referência: na clave de sol, a 2ª linha é Sol; na clave de fá, a 4ª linha é Fá. Conte a partir delas.' : 'Acertos ótimos. Agora é ganhar velocidade: repita amanhã e tente ficar abaixo de 2,5 s.'}
          </p>
          <div className="actions">
            <button className="btn" onClick={() => start(level)}>Jogar de novo</button>
            {done.unlocked && <button className="btn ghost" onClick={() => start(READING_LEVELS[level.n])}>Ir para o nível {level.n + 1}</button>}
            <button className="btn ghost" onClick={() => setLevel(null)}>Ver níveis</button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page reading">
      <button className="btn ghost" onClick={() => setLevel(null)}>← Níveis</button>
      <section className="card reading-card">
        <div className="card-head">
          <span className="eyebrow">Nível {level.n} · {level.title}</span>
          <span className="mono muted">{i + 1}/{ROUND}</span>
        </div>
        {current && <NoteView midi={current.midi} flat={current.flat} clef={clefFor(level, current.midi)} state={state} />}
        <p className={'reading-msg ' + state} role="status">{msg || 'Toque esta nota no piano'}</p>
        <MiniKeyboard lo={kbRange[0]} hi={kbRange[1]} />
      </section>
    </div>
  );
}

/** Teclado clicável para quem está sem o piano. */
function MiniKeyboard({ lo, hi }: { lo: number; hi: number }) {
  const whites: number[] = [];
  for (let m = lo; m <= hi; m++) if (!isBlack(m)) whites.push(m);
  const w = 100 / whites.length;
  return (
    <div className="mini-kb" aria-label="Teclado na tela">
      {whites.map((m, k) => (
        <button key={m} className="mk-white" style={{ left: `${k * w}%`, width: `${w}%` }}
          onPointerDown={() => input.emit('on', m, 0.7, 'tela')} onPointerUp={() => input.emit('off', m, 0, 'tela')} aria-label={namePt(m)}>
          {m % 12 === 0 && <span>{namePt(m)}</span>}
        </button>
      ))}
      {whites.map((m, k) => (isBlack(m + 1) && m + 1 <= hi ? (
        <button key={m + 1} className="mk-black" style={{ left: `${(k + 1) * w - w * 0.3}%`, width: `${w * 0.6}%` }}
          onPointerDown={() => input.emit('on', m + 1, 0.7, 'tela')} onPointerUp={() => input.emit('off', m + 1, 0, 'tela')} aria-label={namePt(m + 1)} />
      ) : null))}
    </div>
  );
}
