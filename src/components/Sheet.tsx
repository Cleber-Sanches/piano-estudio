import { useEffect, useMemo, useRef, useState } from 'react';
import { Accidental, Dot, Formatter, Renderer, Stave, StaveConnector, StaveNote, StaveTie, Voice } from 'vexflow';
import type { Practice } from '../engine/practice';
import { buildSheet, isDotted, vexDuration, vexKey, type SheetItem } from '../lib/sheet';
import type { Song } from '../lib/song';

interface Props {
  song: Song;
  /** Compasso atual (índice 0) — muda a página e o destaque. */
  measure: number;
  practice: Practice | null;
  /** Força redesenho para atualizar cores de acerto/erro. */
  version: number;
  /** Posição dentro do compasso (0–1) para o cursor. */
  cursorRef: React.MutableRefObject<number>;
}

const GOOD = '#2E8B57';
const BAD = '#D2453D';

export function Sheet({ song, measure, practice, version, cursorRef }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const cursor = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const measures = useMemo(() => buildSheet(song), [song]);
  const perPage = width < 560 ? 2 : width < 900 ? 3 : 4;
  const page = Math.floor(Math.max(0, measure) / perPage);
  const boxes = useRef<Array<{ x0: number; x1: number }>>([]);

  useEffect(() => {
    const el = host.current!;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = host.current;
    if (!el || width < 50) return;
    el.querySelectorAll('svg').forEach((s) => s.remove());
    const renderer = new Renderer(el, Renderer.Backends.SVG);
    const H = 230;
    renderer.resize(width, H);
    const ctx = renderer.getContext();
    const list = measures.slice(page * perPage, page * perPage + perPage);
    const keyAccs = Math.abs(keyCount(song.key));
    const firstExtra = 70 + keyAccs * 10 + 28;
    const left = 24;
    const usable = width - left - 8 - firstExtra;
    const mw = usable / perPage;
    const tieNotes: Array<{ a: StaveNote; b: StaveNote; n: number }> = [];
    let lastR: StaveNote | null = null;
    let lastL: StaveNote | null = null;
    let pendingR = false, pendingL = false;
    boxes.current = [];

    list.forEach((m, i) => {
      const x = left + (i === 0 ? 0 : firstExtra + i * mw);
      const w = i === 0 ? firstExtra + mw : mw;
      const top = new Stave(x, 0, w);
      const bot = new Stave(x, 100, w);
      if (i === 0) {
        top.addClef('treble').addKeySignature(song.key);
        bot.addClef('bass').addKeySignature(song.key);
        if (page === 0) {
          top.addTimeSignature(`${song.timeSig[0]}/${song.timeSig[1]}`);
          bot.addTimeSignature(`${song.timeSig[0]}/${song.timeSig[1]}`);
        }
      }
      if (m.index === measure) {
        top.setStyle({ strokeStyle: '#B07A10', fillStyle: '#B07A10' });
      }
      top.setMeasure(m.index + 1);
      top.setContext(ctx).draw();
      bot.setContext(ctx).draw();
      if (i === 0) {
        new StaveConnector(top, bot).setType('brace').setContext(ctx).draw();
        new StaveConnector(top, bot).setType('singleLeft').setContext(ctx).draw();
      }
      new StaveConnector(top, bot).setType('singleRight').setContext(ctx).draw();

      const mk = (it: SheetItem, clef: 'treble' | 'bass') => {
        const rest = it.keys.length === 0;
        const keys = rest ? [clef === 'treble' ? 'b/4' : 'd/3'] : it.keys.map((k) => vexKey(k, song.key));
        const sn = new StaveNote({ keys, duration: vexDuration(it.len) + (rest ? 'r' : ''), clef, auto_stem: !rest });
        if (isDotted(it.len)) Dot.buildAndAttach([sn], { all: true });
        if (!rest && practice) {
          const states = it.noteIds.map((id) => practice.state.get(id));
          if (states.length && states.every((s) => s === 'acerto')) sn.setStyle({ fillStyle: GOOD, strokeStyle: GOOD });
          else if (states.some((s) => s === 'erro')) sn.setStyle({ fillStyle: BAD, strokeStyle: BAD });
        }
        return sn;
      };
      const vR = new Voice({ num_beats: song.timeSig[0], beat_value: song.timeSig[1] }).setMode(Voice.Mode.SOFT);
      const vL = new Voice({ num_beats: song.timeSig[0], beat_value: song.timeSig[1] }).setMode(Voice.Mode.SOFT);
      const rNotes = m.R.map((it) => mk(it, 'treble'));
      const lNotes = m.L.map((it) => mk(it, 'bass'));
      vR.addTickables(rNotes);
      vL.addTickables(lNotes);
      try {
        Accidental.applyAccidentals([vR], song.key);
        Accidental.applyAccidentals([vL], song.key);
      } catch {
        /* armadura incomum: segue sem acidentes automáticos */
      }
      const noteStart = top.getNoteStartX();
      const noteW = Math.max(40, x + w - noteStart - 14);
      new Formatter().joinVoices([vR]).joinVoices([vL]).format([vR, vL], noteW);
      vR.draw(ctx, top);
      vL.draw(ctx, bot);
      boxes.current.push({ x0: noteStart, x1: x + w - 6 });

      // ligaduras (dentro da página)
      const tie = (items: SheetItem[], notes: StaveNote[], last: StaveNote | null, pending: boolean) => {
        if (pending && last && notes[0] && items[0].keys.length) tieNotes.push({ a: last, b: notes[0], n: items[0].keys.length });
        items.forEach((it, k) => {
          if (it.tieNext && notes[k + 1] && it.keys.length) tieNotes.push({ a: notes[k], b: notes[k + 1], n: it.keys.length });
        });
      };
      tie(m.R, rNotes, lastR, pendingR);
      tie(m.L, lNotes, lastL, pendingL);
      lastR = rNotes[rNotes.length - 1] ?? null;
      lastL = lNotes[lNotes.length - 1] ?? null;
      pendingR = !!m.R[m.R.length - 1]?.tieNext;
      pendingL = !!m.L[m.L.length - 1]?.tieNext;
    });
    tieNotes.forEach(({ a, b, n }) => {
      const idx = Array.from({ length: n }, (_, i) => i);
      new StaveTie({ first_note: a, last_note: b, first_indices: idx, last_indices: idx }).setContext(ctx).draw();
    });
  }, [measures, page, perPage, width, song, measure, version, practice]);

  // cursor contínuo
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const b = boxes.current[measure - page * perPage];
      const c = cursor.current;
      if (c) {
        if (b) {
          c.style.opacity = '1';
          c.style.transform = `translateX(${b.x0 + (b.x1 - b.x0) * Math.min(1, Math.max(0, cursorRef.current)) - 1}px)`;
        } else c.style.opacity = '0';
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [measure, page, perPage, cursorRef]);

  return (
    <div className="sheet" ref={host}>
      <div className="sheet-cursor" ref={cursor} />
    </div>
  );
}

function keyCount(key: string): number {
  const map: Record<string, number> = {
    C: 0, Am: 0, G: 1, Em: 1, D: 2, Bm: 2, A: 3, 'F#m': 3, E: 4, 'C#m': 4, B: 5, 'G#m': 5, 'F#': 6, 'D#m': 6, 'C#': 7,
    F: -1, Dm: -1, Bb: -2, Gm: -2, Eb: -3, Cm: -3, Ab: -4, Fm: -4, Db: -5, Bbm: -5, Gb: -6, Ebm: -6, Cb: -7,
  };
  return map[key] ?? 0;
}
