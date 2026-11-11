import { useEffect, useRef, useState } from 'react';
import { audioLeadSec, click, startAudio } from '../engine/audio';
import { input } from '../engine/input';
import { setSettings } from '../lib/settings';

const PERIOD_MS = 800; // 75 BPM
const TAPS = 12;
const SKIP = 2; // os primeiros toques são de "pegar o jeito"

/**
 * Mede o atraso real do caminho piano → iPad → tela/som:
 * uma bolinha cai e bate na linha a cada tempo; você aperta qualquer tecla quando ela bate.
 */
export function Calibrate() {
  const [running, setRunning] = useState(false);
  const [taps, setTaps] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const ball = useRef<HTMLDivElement>(null);
  const flash = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!running) return;
    const t0 = performance.now() + 2 * PERIOD_MS;
    const leadMs = audioLeadSec() * 1000;
    const offsets: number[] = [];
    let lastClick = -1;
    let raf = 0;

    const frame = (now: number) => {
      const k = (now - t0) / PERIOD_MS;
      const phase = ((k % 1) + 1) % 1;
      if (ball.current) ball.current.style.transform = `translateY(${-(1 - phase) * 90}%)`;
      if (flash.current) flash.current.style.opacity = phase < 0.12 && k >= 0 ? '1' : '0';
      // som disparado um pouco antes para chegar no ouvido junto com a bolinha
      const kc = Math.floor((now + leadMs - t0) / PERIOD_MS);
      if (kc > lastClick) { lastClick = kc; click(kc % 4 === 0); }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const off = input.on((e) => {
      if (e.type !== 'on') return;
      const now = performance.now();
      const k = Math.round((now - t0) / PERIOD_MS);
      if (k < 0) return;
      const d = now - (t0 + k * PERIOD_MS);
      if (Math.abs(d) > PERIOD_MS * 0.4) return;
      offsets.push(d);
      setTaps(offsets.length);
      if (offsets.length >= TAPS) {
        const xs = offsets.slice(SKIP).sort((a, b) => a - b);
        const med = xs[Math.floor(xs.length / 2)];
        const ms = Math.max(0, Math.min(150, Math.round(med / 5) * 5));
        setSettings({ latencyMs: ms });
        setMsg(med < 0
          ? `Você tocou em média ${Math.round(-med)} ms antes da batida. Compensação zerada; tente de novo apertando exatamente quando a bolinha bate.`
          : `Atraso medido: ${Math.round(med)} ms. A compensação foi ajustada para ${ms} ms.`);
        setRunning(false);
      }
    });
    return () => { cancelAnimationFrame(raf); off(); };
  }, [running]);

  const start = async () => {
    await startAudio().catch(() => {});
    setMsg(null);
    setTaps(0);
    setRunning(true);
  };

  return (
    <div className="calib">
      {running ? (
        <>
          <div className="calib-lane" aria-hidden="true">
            <div className="calib-ball" ref={ball} />
            <div className="calib-line" />
            <div className="calib-flash" ref={flash} />
          </div>
          <p className="muted small">Aperte qualquer tecla do piano no exato momento em que a bolinha bate na linha (junto com o clique). {taps}/{TAPS}</p>
          <div className="actions"><button className="btn ghost" onClick={() => setRunning(false)}>Cancelar</button></div>
        </>
      ) : (
        <div className="actions">
          <button className="btn ghost" onClick={start}>Calibrar com o piano</button>
          {msg && <span className="muted small">{msg}</span>}
        </div>
      )}
    </div>
  );
}
