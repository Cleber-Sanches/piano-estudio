import { SplendidGrandPiano } from 'smplr';

// Som: piano de cauda amostrado (carregado da internet na primeira vez) e metrônomo.

let ctx: AudioContext | null = null;
let piano: ReturnType<typeof SplendidGrandPiano> | null = null;
let ready = false;
const loadListeners = new Set<(p: number) => void>();
export let loadProgress = 0;

export function audioContext(): AudioContext {
  if (!ctx) ctx = new AudioContext({ latencyHint: 'interactive' });
  return ctx;
}

/** Precisa ser chamado a partir de um clique (regra dos navegadores). */
export async function startAudio() {
  const c = audioContext();
  if (c.state === 'suspended') await c.resume();
  if (!piano) {
    piano = SplendidGrandPiano(c, {
      volume: 100,
      onLoadProgress: (p) => {
        loadProgress = p.total ? p.loaded / p.total : 0;
        loadListeners.forEach((l) => l(loadProgress));
      },
    });
    piano.ready.then(
      () => {
        ready = true;
        loadProgress = 1;
        loadListeners.forEach((l) => l(1));
      },
      () => {
        // sem internet ou bloqueado: o app segue funcionando, só sem o som do piano
        loadProgress = -1;
        loadListeners.forEach((l) => l(-1));
        piano = null;
      },
    );
  }
}

export function onPianoLoad(fn: (p: number) => void) {
  loadListeners.add(fn);
  fn(ready ? 1 : loadProgress);
  return () => { loadListeners.delete(fn); };
}

export function isPianoReady() {
  return ready;
}

const playing = new Map<number, (t?: number) => void>();

export function play(midi: number, velocity = 0.7, duration?: number) {
  if (!piano || !ready) return;
  const stop = piano.start({ note: midi, velocity: Math.round(velocity * 127), duration: duration ?? null });
  if (!duration) {
    playing.get(midi)?.();
    playing.set(midi, stop);
  }
}

export function release(midi: number) {
  const s = playing.get(midi);
  if (s) {
    s();
    playing.delete(midi);
  }
}

export function stopAll() {
  piano?.stop();
  playing.clear();
}

export function setVolume(v: number) {
  if (piano) piano.output.volume = Math.round(v * 127);
}

export function click(accent: boolean) {
  const c = audioContext();
  if (c.state !== 'running') return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.frequency.value = accent ? 1760 : 1200;
  g.gain.setValueAtTime(accent ? 0.35 : 0.2, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.05);
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + 0.06);
}

/** Atraso entre mandar tocar e o som sair do alto-falante (s). O iPad nem sempre informa; usa 40 ms nesse caso. */
export function audioLeadSec(): number {
  try {
    const c = audioContext() as AudioContext & { outputLatency?: number };
    const l = (c.outputLatency || 0) + (c.baseLatency || 0);
    return l > 0.005 ? Math.min(0.15, l) : 0.04;
  } catch {
    return 0.04;
  }
}
