import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { Practice } from '../engine/practice';
import type { Song } from '../lib/song';
import { isBlack, PITCH_PT } from '../lib/theory';

export interface StageHandle {
  draw: (p: Practice, view: StageView) => void;
}

export interface StageView {
  pressed: Map<number, 'certo' | 'errado' | 'livre'>;
  showFingers: boolean;
  showNames: boolean;
  /** 1 = normal, 0.3 = fracas, 0 = ocultas (só partitura). */
  fallAlpha: number;
  onKey?: (midi: number, down: boolean) => void;
}

const COLORS = {
  bg: '#101015',
  lane: 'rgba(255,255,255,0.04)',
  laneC: 'rgba(255,255,255,0.09)',
  measure: 'rgba(255,255,255,0.12)',
  measureText: 'rgba(255,255,255,0.35)',
  R: '#E2A84B',
  L: '#3FB8A8',
  wrong: '#E5534B',
  good: '#7BD88F',
  white: '#F4F2EC',
  whiteEdge: '#C9C6BD',
  black: '#1A1A1F',
  now: 'rgba(226,168,75,0.85)',
  loop: 'rgba(226,168,75,0.12)',
};

interface Layout {
  lo: number;
  hi: number;
  whiteW: number;
  keyX: Map<number, { x: number; w: number; black: boolean }>;
}

export function keyRange(song: Song): [number, number] {
  let lo = 127, hi = 0;
  song.notes.forEach((n) => { lo = Math.min(lo, n.midi); hi = Math.max(hi, n.midi); });
  if (lo > hi) { lo = 48; hi = 72; }
  lo = Math.min(lo - 2, 48);
  hi = Math.max(hi + 2, 72);
  // começa num Dó e termina num Dó para o teclado ficar bonito
  lo = lo - (((lo % 12) + 12) % 12);
  hi = hi + ((12 - (((hi % 12) + 12) % 12)) % 12);
  return [Math.max(21, lo), Math.min(108, hi)];
}

function layout(lo: number, hi: number, width: number): Layout {
  const whites: number[] = [];
  for (let m = lo; m <= hi; m++) if (!isBlack(m)) whites.push(m);
  const whiteW = width / whites.length;
  const keyX = new Map<number, { x: number; w: number; black: boolean }>();
  whites.forEach((m, i) => keyX.set(m, { x: i * whiteW, w: whiteW, black: false }));
  for (let m = lo; m <= hi; m++) {
    if (!isBlack(m)) continue;
    const left = keyX.get(m - 1);
    if (!left) continue;
    const bw = whiteW * 0.6;
    keyX.set(m, { x: left.x + whiteW - bw / 2, w: bw, black: true });
  }
  return { lo, hi, whiteW, keyX };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export const Stage = forwardRef<StageHandle, { song: Song; onKey?: (midi: number, down: boolean) => void }>(function Stage({ song, onKey }, ref) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const size = useRef({ w: 800, h: 400, dpr: 1 });
  const lay = useRef<Layout | null>(null);
  const range = useRef(keyRange(song));
  const maxDur = useRef(0);

  useEffect(() => {
    range.current = keyRange(song);
    maxDur.current = song.notes.reduce((m, n) => Math.max(m, n.dur), 0);
  }, [song]);

  useEffect(() => {
    const c = canvas.current!;
    const ro = new ResizeObserver(() => {
      const r = c.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      size.current = { w: r.width, h: r.height, dpr };
      c.width = Math.round(r.width * dpr);
      c.height = Math.round(r.height * dpr);
      lay.current = layout(range.current[0], range.current[1], r.width);
    });
    ro.observe(c);
    return () => ro.disconnect();
  }, [song]);

  // toque/clique nas teclas da tela
  useEffect(() => {
    const c = canvas.current!;
    const active = new Map<number, number>();
    const keyAt = (x: number, y: number): number | null => {
      const L = lay.current;
      if (!L) return null;
      const kbTop = size.current.h - kbHeight(size.current.w, size.current.h);
      if (y < kbTop) return null;
      const blackH = (size.current.h - kbTop) * 0.62;
      if (y - kbTop < blackH) {
        for (const [m, k] of L.keyX) if (k.black && x >= k.x && x <= k.x + k.w) return m;
      }
      for (const [m, k] of L.keyX) if (!k.black && x >= k.x && x < k.x + k.w) return m;
      return null;
    };
    const down = (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      const m = keyAt(e.clientX - r.left, e.clientY - r.top);
      if (m == null) return;
      active.set(e.pointerId, m);
      onKey?.(m, true);
    };
    const up = (e: PointerEvent) => {
      const m = active.get(e.pointerId);
      if (m == null) return;
      active.delete(e.pointerId);
      onKey?.(m, false);
    };
    c.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      c.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [onKey]);

  useImperativeHandle(ref, () => ({
    draw(p, view) {
      const c = canvas.current;
      const L = lay.current;
      if (!c || !L) return;
      const ctx = c.getContext('2d')!;
      const { w, h, dpr } = size.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const kbH = kbHeight(w, h);
      const nowY = h - kbH;
      const pps = nowY / 3.2;
      const t = p.t;
      const yOf = (sec: number) => nowY - (sec - t) * pps;

      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, w, h);

      // raias
      for (const [m, k] of L.keyX) {
        if (k.black) continue;
        const pc = ((m % 12) + 12) % 12;
        if (pc === 0 || pc === 5) {
          ctx.fillStyle = pc === 0 ? COLORS.laneC : COLORS.lane;
          ctx.fillRect(Math.round(k.x), 0, 1, nowY);
        }
      }

      // trecho em loop
      if (p.opts.loop) {
        const ya = yOf(song.beatToSec(p.opts.loop[0]));
        const yb = yOf(song.beatToSec(p.opts.loop[1]));
        ctx.fillStyle = COLORS.loop;
        ctx.fillRect(0, Math.max(0, yb), w, Math.min(nowY, ya) - Math.max(0, yb));
      }

      // linhas de compasso
      ctx.font = '600 11px Inter, system-ui, sans-serif';
      ctx.textBaseline = 'bottom';
      const tTop = t + nowY / pps;
      const firstM = Math.max(0, Math.floor(song.secToBeat(Math.max(0, t)) / song.beatsPerMeasure));
      for (let m = firstM; ; m++) {
        const sec = song.beatToSec(m * song.beatsPerMeasure);
        if (sec > tTop || m * song.beatsPerMeasure > song.totalBeats) break;
        const y = yOf(sec);
        if (y > nowY) continue;
        ctx.fillStyle = COLORS.measure;
        ctx.fillRect(0, Math.round(y), w, 1);
        ctx.fillStyle = COLORS.measureText;
        ctx.fillText(String(m + 1), 6, y - 3);
      }

      // notas
      const notes = song.notes;
      let i0 = 0;
      { let lo = 0, hi = notes.length; const target = t - maxDur.current - 0.5; while (lo < hi) { const mid = (lo + hi) >> 1; if (notes[mid].start < target) lo = mid + 1; else hi = mid; } i0 = lo; }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = i0; i < notes.length && view.fallAlpha > 0; i++) {
        const n = notes[i];
        if (n.start > tTop) break;
        if (n.start + n.dur < t - 0.2) continue;
        const k = L.keyX.get(n.midi);
        if (!k) continue;
        const y0 = yOf(n.start);
        const y1 = yOf(n.start + n.dur);
        const mine = p.isMine(n);
        const st = p.state.get(n.id);
        const base = n.hand === 'R' ? COLORS.R : COLORS.L;
        const pad = k.black ? 1 : 2;
        const x = k.x + pad, nw = k.w - pad * 2, nh = Math.max(4, y0 - y1 - 2);
        ctx.globalAlpha = (mine ? 1 : 0.45) * view.fallAlpha;
        roundRect(ctx, x, y1, nw, nh, 5);
        if (st === 'erro') {
          ctx.fillStyle = 'rgba(229,83,75,0.25)';
          ctx.fill();
          ctx.strokeStyle = COLORS.wrong;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else {
          ctx.fillStyle = base;
          ctx.fill();
          if (st === 'acerto') {
            ctx.strokeStyle = COLORS.good;
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;
        if (view.showFingers && view.fallAlpha >= 1 && n.finger && nw >= 14 && nh >= 16) {
          ctx.fillStyle = '#16161a';
          ctx.font = `700 ${Math.min(14, nw * 0.6)}px Inter, system-ui, sans-serif`;
          ctx.fillText(String(n.finger), x + nw / 2, y0 - Math.min(11, nh / 2) - 1);
        }
      }
      ctx.textAlign = 'left';

      // linha do "agora"
      ctx.fillStyle = COLORS.now;
      ctx.fillRect(0, nowY - 2, w, 2);

      // teclado
      const sounding = new Map<number, 'R' | 'L'>();
      for (let i = i0; i < notes.length; i++) {
        const n = notes[i];
        if (n.start > t) break;
        if (!p.isMine(n) && n.start + n.dur > t) sounding.set(n.midi, n.hand);
      }
      const hints = new Set(view.fallAlpha > 0 ? p.hintKeys() : []);
      const hintHand = new Map<number, 'R' | 'L'>();
      p.currentGroup?.notes.forEach((n) => hintHand.set(n.midi, n.hand));
      const blackH = kbH * 0.62;
      const pulse = 0.55 + 0.45 * Math.sin(performance.now() / 180);

      const keyFill = (m: number, black: boolean) => {
        const pr = view.pressed.get(m);
        if (pr === 'certo') return COLORS.good;
        if (pr === 'errado') return COLORS.wrong;
        if (pr === 'livre') return '#7FA7F5';
        const s = sounding.get(m);
        if (s) return s === 'R' ? COLORS.R : COLORS.L;
        return black ? COLORS.black : COLORS.white;
      };

      for (const [m, k] of L.keyX) {
        if (k.black) continue;
        ctx.fillStyle = keyFill(m, false);
        roundRect(ctx, k.x + 0.5, nowY, k.w - 1, kbH - 1, 4);
        ctx.fill();
        ctx.strokeStyle = COLORS.whiteEdge;
        ctx.lineWidth = 1;
        ctx.stroke();
        if (hints.has(m) && !view.pressed.has(m)) {
          ctx.globalAlpha = pulse;
          ctx.fillStyle = hintHand.get(m) === 'L' ? COLORS.L : COLORS.R;
          ctx.beginPath();
          ctx.arc(k.x + k.w / 2, nowY + kbH - Math.min(18, k.w * 0.5), Math.min(7, k.w * 0.28), 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        const pc = ((m % 12) + 12) % 12;
        if (view.showNames && k.w >= 16) {
          ctx.fillStyle = m === 60 ? '#8a6312' : '#8b887f';
          ctx.font = `${m === 60 ? 700 : 500} ${Math.min(11, k.w * 0.42)}px Inter, system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'alphabetic';
          if (pc === 0 || k.w >= 26) ctx.fillText(PITCH_PT[pc].replace('♯', '').replace('♭', ''), k.x + k.w / 2, nowY + kbH - 6);
          ctx.textAlign = 'left';
        }
      }
      for (const [m, k] of L.keyX) {
        if (!k.black) continue;
        ctx.fillStyle = keyFill(m, true);
        roundRect(ctx, k.x, nowY, k.w, blackH, 3);
        ctx.fill();
        if (hints.has(m) && !view.pressed.has(m)) {
          ctx.globalAlpha = pulse;
          ctx.fillStyle = hintHand.get(m) === 'L' ? COLORS.L : COLORS.R;
          ctx.beginPath();
          ctx.arc(k.x + k.w / 2, nowY + blackH - Math.min(12, k.w * 0.6), Math.min(5, k.w * 0.3), 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      // contagem
      if (t < (p.opts.loop ? song.beatToSec(p.opts.loop[0]) : 0) && p.playing) {
        const startSec = p.opts.loop ? song.beatToSec(p.opts.loop[0]) : 0;
        const left = Math.ceil(song.secToBeat(startSec) - (p.beat < 0 ? p.beat : song.secToBeat(t)) - 1e-6);
        if (left > 0) {
          ctx.fillStyle = 'rgba(244,242,236,0.9)';
          ctx.font = '700 64px "Bricolage Grotesque", Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(left), w / 2, nowY / 2);
          ctx.textAlign = 'left';
        }
      }
    },
  }));

  return <canvas ref={canvas} className="stage-canvas" aria-label="Notas caindo e teclado" />;
});

export function kbHeight(w: number, h: number) {
  return Math.round(Math.min(150, Math.max(80, h * 0.28), w * 0.22));
}
