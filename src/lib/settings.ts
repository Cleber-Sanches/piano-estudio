import { useSyncExternalStore } from 'react';

export interface Settings {
  /** Tocar som do app quando VOCÊ aperta uma tecla (desligue se o piano já faz som). */
  soundMine: boolean;
  /** Tocar a mão que você não está praticando. */
  soundAuto: boolean;
  metronome: boolean;
  volume: number;
  latencyMs: number;
  windowMs: number;
  deviceId: string;
  showFingers: boolean;
  showNames: boolean;
  showSheet: boolean;
  /** Ponte para a partitura: notas caindo normais, fracas ou ocultas. */
  fall: 'normal' | 'fraca' | 'oculta';
}

const DEFAULTS: Settings = {
  soundMine: false,
  soundAuto: true,
  metronome: true,
  volume: 0.8,
  latencyMs: 0,
  windowMs: 160,
  deviceId: 'todos',
  showFingers: true,
  showNames: true,
  showSheet: true,
  fall: 'normal',
};

const KEY = 'piano-estudio:ajustes';
let current: Settings = (() => {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return DEFAULTS;
  }
})();
const listeners = new Set<() => void>();

export function getSettings() {
  return current;
}

export function setSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* ignora */
  }
  listeners.forEach((l) => l());
}

export function subscribeSettings(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    },
    () => current,
  );
}
