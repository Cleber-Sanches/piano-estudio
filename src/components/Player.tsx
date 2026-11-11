import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { audioLeadSec, click, play, release, startAudio, stopAll, onPianoLoad } from '../engine/audio';
import { input } from '../engine/input';
import { Practice, type PassResult, type PracticeMode } from '../engine/practice';
import { coach, nextBpm } from '../lib/coach';
import type { Lesson } from '../lib/lessons';
import { addMinutes, recordAttempt, type LessonProgress } from '../lib/progress';
import { setSettings, useSettings } from '../lib/settings';
import { measureAt, measureCount, type Song } from '../lib/song';
import type { Hand } from '../lib/theory';
import { Stage, type StageHandle } from './Stage';

interface Props {
  kind: 'licao' | 'musica' | 'teste';
  id: string;
  /** Teste de nivelamento: id do módulo que é liberado se passar. */
  moduleTest?: { id: string; title: string };
  /** Para lições: a lição (BPM ajustável). Para músicas: a música pronta. */
  lesson?: Lesson;
  song?: Song;
  onExit: () => void;
  onNextLesson?: () => void;
}

const Sheet = lazy(() => import('./Sheet').then((m) => ({ default: m.Sheet })));

const HAND_OPTS: Array<{ v: Hand[]; label: string }> = [
  { v: ['R'], label: 'Direita' },
  { v: ['L'], label: 'Esquerda' },
  { v: ['R', 'L'], label: 'Juntas' },
];

export function Player({ kind, id, lesson, song: songProp, onExit, onNextLesson, moduleTest }: Props) {
  const settings = useSettings();
  const [bpm, setBpm] = useState(kind === 'teste' && lesson ? lesson.goalBpm : lesson?.startBpm ?? 60);
  const song = useMemo(() => (lesson ? lesson.build(bpm) : songProp!), [lesson, bpm, songProp]);
  const songHands = useMemo(() => {
    const s = new Set(song.notes.map((n) => n.hand));
    return HAND_OPTS.filter((o) => o.v.every((h) => s.has(h)));
  }, [song]);
  const [mode, setMode] = useState<PracticeMode>(kind === 'teste' ? 'tempo' : 'espera');
  const [hands, setHands] = useState<Hand[]>(lesson?.hands ?? songHands[songHands.length - 1]?.v ?? ['R']);
  const [speed, setSpeed] = useState(kind === 'musica' ? 0.6 : 1);
  const [loopOn, setLoopOn] = useState(false);
  const total = measureCount(song);
  const [loopFrom, setLoopFrom] = useState(1);
  const [loopTo, setLoopTo] = useState(Math.min(2, total));
  const [playing, setPlaying] = useState(false);
  const [measure, setMeasure] = useState(0);
  const [live, setLive] = useState<number | null>(null);
  const [sheetVersion, setSheetVersion] = useState(0);
  const [result, setResult] = useState<{ r: PassResult; tips: string[]; progress?: LessonProgress; passed: boolean; moduleCleared: boolean } | null>(null);
  const [passes, setPasses] = useState<PassResult[]>([]);
  const [pianoLoad, setPianoLoad] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const cursorRef = useRef(0);
  const stage = useRef<StageHandle>(null);
  const pressed = useRef(new Map<number, 'certo' | 'errado' | 'livre'>());

  const loop: [number, number] | null = loopOn
    ? [(Math.min(loopFrom, loopTo) - 1) * song.beatsPerMeasure, Math.max(loopFrom, loopTo) * song.beatsPerMeasure]
    : null;

  const opts = { mode, hands, speed, loop, windowMs: settings.windowMs, latencyMs: settings.latencyMs, audioLeadSec: audioLeadSec() };
  const practice = useMemo(() => new Practice(song, opts), [song]); // eslint-disable-line react-hooks/exhaustive-deps
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const cleanStreak = useRef(0);

  useEffect(() => onPianoLoad(setPianoLoad), []);

  // opções mudaram: aplica (e reinicia quando muda o que é avaliado)
  useEffect(() => {
    practice.setOptions({ mode, hands, loop, speed, windowMs: settings.windowMs, latencyMs: settings.latencyMs, audioLeadSec: audioLeadSec() });
    cleanStreak.current = 0;
    setPasses([]);
    setSheetVersion((v) => v + 1);
  }, [practice, mode, hands.join(), loop?.[0], loop?.[1], speed, settings.windowMs, settings.latencyMs]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = useCallback(
    (r: PassResult, fromLoop: boolean) => {
      const effBpm = lesson ? bpm : null;
      const tips = coach({ result: r, mode: practice.opts.mode, bpm: effBpm, speed: practice.opts.speed, cleanStreak: cleanStreak.current, goal: lesson ? { bpm: lesson.goalBpm, accuracy: lesson.goalAccuracy } : undefined, inLoop: fromLoop });
      const rec = recordAttempt(
        {
          kind, id, title: lesson?.title ?? song.title, mode: practice.opts.mode, hands: practice.opts.hands,
          bpm: effBpm ?? Math.round(song.bpm * practice.opts.speed), speed: practice.opts.speed,
          accuracy: r.accuracy, hits: r.hits, total: r.total, wrong: r.wrong, avgOffsetMs: r.avgOffsetMs,
          loop: practice.opts.loop, troubleMeasures: r.troubleMeasures,
        },
        r,
        lesson ? { bpm: lesson.goalBpm, accuracy: lesson.goalAccuracy } : undefined,
        moduleTest?.id,
      );
      if (moduleTest) {
        tips.unshift(rec.moduleCleared
          ? `Teste aprovado: o módulo “${moduleTest.title}” foi marcado como dominado. As lições dele entram na revisão.`
          : `Para passar no teste: ${lesson?.goalBpm} BPM com ${Math.round((lesson?.goalAccuracy ?? 0.9) * 100)}% no modo tempo, sem loop. Se não sair, faça as lições do módulo normalmente.`);
      }
      return { tips, progress: rec.lesson, passed: rec.passed, moduleCleared: rec.moduleCleared };
    },
    [bpm, id, kind, lesson, practice, song, moduleTest],
  );

  // eventos do motor
  useEffect(() => {
    return practice.on((e) => {
      const s = settingsRef.current;
      if (e.type === 'auto' && s.soundAuto) play(e.note.midi, e.note.velocity, e.note.dur / practice.opts.speed);
      if (e.type === 'beat' && s.metronome && !practice.waiting) click(e.downbeat);
      if (e.type === 'pass') {
        cleanStreak.current = e.result.accuracy >= 0.9 ? cleanStreak.current + 1 : 0;
        setPasses((p) => [...p, e.result]);
        if (practice.opts.mode === 'tempo') finish(e.result, true);
        setSheetVersion((v) => v + 1);
      }
      if (e.type === 'fim') {
        setPlaying(false);
        const { tips, progress, passed, moduleCleared } = finish(e.result, false);
        setResult({ r: e.result, tips, progress: kind !== 'musica' ? progress : undefined, passed, moduleCleared });
        setSheetVersion((v) => v + 1);
      }
    });
  }, [practice, finish, kind]);

  // entrada de notas
  const handleNote = useCallback(
    (type: 'on' | 'off', midi: number, velocity: number) => {
      const s = settingsRef.current;
      if (type === 'on') {
        if (s.soundMine) play(midi, velocity);
        if (!practice.playing) {
          pressed.current.set(midi, 'livre');
          practice.noteOn(midi);
          return;
        }
        const before = practice.wrongCount;
        practice.noteOn(midi);
        pressed.current.set(midi, practice.wrongCount > before ? 'errado' : 'certo');
        setSheetVersion((v) => v + 1);
      } else {
        if (s.soundMine) release(midi);
        pressed.current.delete(midi);
        practice.noteOff(midi);
      }
    },
    [practice],
  );

  const onScreenKey = useCallback((m: number, down: boolean) => input.emit(down ? 'on' : 'off', m, 0.7, 'tela'), []);

  // laço de animação
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let playedSec = 0;
    let lastMeasure = -1;
    let lastLive = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      practice.tick(dt);
      if (practice.playing) playedSec += dt;
      const b = Math.max(0, practice.beat);
      const m = Math.min(total - 1, measureAt(song, b));
      cursorRef.current = (b - m * song.beatsPerMeasure) / song.beatsPerMeasure;
      if (m !== lastMeasure) {
        lastMeasure = m;
        setMeasure(m);
      }
      if (now - lastLive > 250) {
        lastLive = now;
        setLive(practice.liveAccuracy());
        if (playedSec > 15) {
          addMinutes(playedSec);
          playedSec = 0;
        }
      }
      const s = settingsRef.current;
      stage.current?.draw(practice, { pressed: pressed.current, showFingers: s.showFingers, showNames: s.showNames, fallAlpha: s.fall === 'normal' ? 1 : s.fall === 'fraca' ? 0.3 : 0 });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      addMinutes(playedSec);
    };
  }, [practice, song, total]);

  useEffect(() => () => stopAll(), []);

  const toggle = useCallback(async () => {
    await startAudio();
    if (practice.finished) {
      practice.reset();
      setResult(null);
    }
    practice.playing = !practice.playing;
    if (!practice.playing) stopAll();
    setPlaying(practice.playing);
  }, [practice]);

  // começar pelo piano: qualquer tecla (parado) ou o pedal (tocar/pausar/repetir)
  const resultRef = useRef(result);
  resultRef.current = result;
  const modalRef = useRef(settingsOpen);
  modalRef.current = settingsOpen;
  useEffect(
    () =>
      input.on((e) => {
        if (e.type === 'on' && e.source === 'midi' && !practice.playing && !resultRef.current && !modalRef.current) {
          toggle();
          return;
        }
        handleNote(e.type, e.midi, e.velocity);
      }),
    [handleNote, toggle, practice],
  );
  useEffect(() => input.onPedal(() => { if (!modalRef.current) toggle(); }), [toggle]);

  const restart = useCallback(() => {
    practice.passIndex = 0;
    practice.reset();
    cleanStreak.current = 0;
    setPasses([]);
    setResult(null);
    stopAll();
    setSheetVersion((v) => v + 1);
  }, [practice]);

  // espaço = tocar/pausar
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.tagName === 'BUTTON')) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [toggle]);

  const trainMeasure = (m: number) => {
    setLoopFrom(m + 1);
    setLoopTo(m + 1);
    setLoopOn(true);
    setResult(null);
    setMode('espera');
  };

  const goal = lesson ? `Meta: modo tempo, ${lesson.goalBpm} BPM, ${Math.round(lesson.goalAccuracy * 100)}% de precisão, sem loop` : null;
  const clean = passes.length ? passes.slice().reverse().findIndex((p) => p.accuracy < 0.9) : 0;
  const streak = passes.length ? (clean === -1 ? passes.length : clean) : 0;

  return (
    <div className="player">
      <div className="player-top">
        <button className="btn ghost" onClick={onExit}>← Voltar</button>
        <div className="player-title">
          <h2>{lesson?.title ?? song.title}</h2>
          {lesson && <p className="muted small">{lesson.tip}</p>}
        </div>
      </div>

      {(settings.showSheet || settings.fall === 'oculta') && (
        <Suspense fallback={<div className="sheet" />}>
          <Sheet song={song} measure={measure} practice={practice} version={sheetVersion} cursorRef={cursorRef} />
        </Suspense>
      )}

      <div className="stage-wrap">
        <Stage ref={stage} song={song} onKey={onScreenKey} />
        {!playing && !result && (
          <button className="stage-play" onClick={toggle} aria-label="Começar">
            <span>▶</span>
            <small>{mode === 'espera' ? 'Modo espera: a música espera você' : 'Modo tempo: siga o metrônomo'}</small>
            <small className="stage-hint">Toque uma tecla do piano ou o pedal para começar</small>
            {pianoLoad < 1 && pianoLoad > 0 && <small>Carregando som do piano… {Math.round(pianoLoad * 100)}%</small>}
            {pianoLoad < 0 && <small>Não consegui baixar o som do piano. O app funciona, mas a mão automática fica muda.</small>}
          </button>
        )}
        {result && (
          <div className="result">
            <div className="result-card">
              <h3>{result.r.accuracy >= 0.9 ? 'Mandou bem' : result.r.accuracy >= 0.7 ? 'Bom caminho' : 'Vamos ajustar'}</h3>
              <div className="result-stats">
                <div><b className="mono">{Math.round(result.r.accuracy * 100)}%</b><span>precisão</span></div>
                <div><b className="mono">{result.r.hits}/{result.r.total}</b><span>notas certas</span></div>
                <div><b className="mono">{result.r.wrong}</b><span>teclas erradas</span></div>
                {mode === 'tempo' && <div><b className="mono">{result.r.avgOffsetMs > 0 ? '+' : ''}{Math.round(result.r.avgOffsetMs)} ms</b><span>{result.r.avgOffsetMs >= 0 ? 'atraso médio' : 'adiantado'}</span></div>}
                {mode === 'tempo' && <div><b className="mono">{result.r.early}</b><span>adiantadas</span></div>}
                {mode === 'tempo' && <div><b className="mono">{result.r.late}</b><span>atrasadas</span></div>}
              </div>
              <ul className="tips">{result.tips.map((t) => <li key={t}>{t}</li>)}</ul>
              {result.moduleCleared && <p className="done-badge">Módulo dominado no nivelamento</p>}
              {!lesson && mode === 'tempo' && speed >= 1 && result.r.accuracy >= 0.9 && <p className="done-badge">Limpo na velocidade real da música</p>}
              {!result.moduleCleared && result.passed && <p className="done-badge">{kind === 'teste' ? 'Teste aprovado' : 'Meta batida'}</p>}
              <div className="actions">
                <button className="btn" onClick={() => { setResult(null); restart(); }}>Tocar de novo</button>
                {result.r.troubleMeasures[0] != null && result.r.accuracy < 0.95 && (
                  <button className="btn ghost" onClick={() => trainMeasure(result.r.troubleMeasures[0])}>Treinar compasso {result.r.troubleMeasures[0] + 1}</button>
                )}
                {mode === 'espera' && result.r.accuracy >= 0.95 && (
                  <button className="btn ghost" onClick={() => { setMode('tempo'); setResult(null); }}>Ir para o modo tempo</button>
                )}
                {lesson && mode === 'tempo' && result.r.accuracy >= 0.9 && bpm < lesson.goalBpm && (
                  <button className="btn ghost" onClick={() => { setBpm(nextBpm(bpm, lesson.goalBpm, result.r.accuracy)); setResult(null); }}>Subir para {nextBpm(bpm, lesson.goalBpm, result.r.accuracy)} BPM</button>
                )}
                {!lesson && mode === 'tempo' && result.r.accuracy >= 0.9 && speed < 1 && (
                  <button className="btn ghost" onClick={() => { setSpeed(Math.min(1, Math.round((speed + 0.1) * 20) / 20)); setResult(null); }}>
                    {speed + 0.1 >= 0.999 ? 'Ir para a velocidade real (100%)' : `Subir para ${Math.round(Math.min(1, Math.round((speed + 0.1) * 20) / 20) * 100)}%`}
                  </button>
                )}
                {(result.passed || result.moduleCleared) && onNextLesson && <button className="btn ghost" onClick={onNextLesson}>Próxima lição →</button>}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="controls">
        <div className="ctrl-group">
          <button className="btn play" onClick={toggle}>{playing ? 'Pausar' : 'Tocar'}</button>
          <button className="btn ghost" onClick={restart}>Reiniciar</button>
        </div>

        <div className="ctrl-group" role="radiogroup" aria-label="Modo">
          {(['espera', 'tempo'] as PracticeMode[]).map((m) => (
            <button key={m} role="radio" aria-checked={mode === m} className={'seg' + (mode === m ? ' on' : '')} onClick={() => setMode(m)}>
              {m === 'espera' ? 'Espera' : 'Tempo'}
            </button>
          ))}
        </div>

        {lesson ? (
          <div className="ctrl-group" aria-label="Andamento">
            <button className="btn ghost small" onClick={() => setBpm((b) => Math.max(30, b - 4))} aria-label="Diminuir BPM">−</button>
            <span className="mono bpm">{bpm} BPM</span>
            <button className="btn ghost small" onClick={() => setBpm((b) => Math.min(200, b + 4))} aria-label="Aumentar BPM">+</button>
          </div>
        ) : (
          <label className="ctrl-group slider" htmlFor="velocidade">
            Velocidade
            <input id="velocidade" type="range" min={0.25} max={1.2} step={0.05} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
            <span className="mono">{Math.round(speed * 100)}% · {Math.round(song.bpm * speed)} BPM</span>
            {speed !== 1 && <button type="button" className="btn ghost small" onClick={() => setSpeed(1)}>100%</button>}
          </label>
        )}

        <button className="btn ghost settings-btn" onClick={() => setSettingsOpen(true)} aria-label="Ajustes da prática">⚙ Ajustes</button>
      </div>

      {settingsOpen && (
        <div className="modal" onClick={(e) => { if (e.target === e.currentTarget) setSettingsOpen(false); }}>
          <div className="modal-card" role="dialog" aria-modal="true" aria-label="Ajustes da prática">
            <div className="modal-head">
              <h3>Ajustes da prática</h3>
              <button className="btn ghost small" onClick={() => setSettingsOpen(false)}>Fechar</button>
            </div>
            {songHands.length > 1 && (
              <div className="ctrl-group" role="radiogroup" aria-label="Mãos">
                {songHands.map((o) => (
                  <button key={o.label} role="radio" aria-checked={hands.join() === o.v.join()} className={'seg' + (hands.join() === o.v.join() ? ' on' : '')} onClick={() => setHands(o.v)}>
                    {o.label}
                  </button>
                ))}
              </div>
            )}
            <div className="ctrl-group loop">
              <label className="check-inline" htmlFor="loop-on">
                <input id="loop-on" type="checkbox" checked={loopOn} onChange={(e) => setLoopOn(e.target.checked)} /> Repetir compassos
              </label>
              <input id="loop-de" type="number" min={1} max={total} value={loopFrom} onChange={(e) => setLoopFrom(Math.min(total, Math.max(1, Number(e.target.value) || 1)))} aria-label="Do compasso" />
              <span className="muted">a</span>
              <input id="loop-ate" type="number" min={1} max={total} value={loopTo} onChange={(e) => setLoopTo(Math.min(total, Math.max(1, Number(e.target.value) || 1)))} aria-label="Até o compasso" />
            </div>
            <div className="ctrl-group">
              <label className="check-inline" htmlFor="metro"><input id="metro" type="checkbox" checked={settings.metronome} onChange={(e) => setSettings({ metronome: e.target.checked })} /> Metrônomo</label>
              <label className="check-inline" htmlFor="partitura"><input id="partitura" type="checkbox" checked={settings.showSheet} onChange={(e) => setSettings({ showSheet: e.target.checked })} /> Partitura</label>
            </div>
            <div className="ctrl-group" role="radiogroup" aria-label="Notas caindo">
              <span className="ctrl-label">Notas caindo</span>
              {([['normal', 'Normais'], ['fraca', 'Fracas'], ['oculta', 'Só partitura']] as const).map(([v, label]) => (
                <button key={v} role="radio" aria-checked={settings.fall === v} className={'seg' + (settings.fall === v ? ' on' : '')} onClick={() => setSettings({ fall: v })}>{label}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="status-bar">
        <span>Compasso <b className="mono">{measure + 1}</b>/{total}</span>
        <span>Precisão agora <b className="mono">{live == null ? '—' : Math.round(live * 100) + '%'}</b></span>
        {loopOn && <span>Passadas limpas seguidas <b className="mono">{streak}</b></span>}
        {goal && <span className="muted">{goal}</span>}
      </div>
    </div>
  );
}
