// Backup automático numa pasta escolhida pelo usuário (no iPad, normalmente o iCloud Drive).
// Junta progresso, ajustes e músicas num único arquivo piano-estudio-backup.json.

import { registerPlugin } from '@capacitor/core';
import { isNativeApp } from '../engine/input';
import { listSongs, putSong, subscribeLibrary, type StoredSong } from './library';
import { subscribe as subscribeProgress } from './progress';
import { subscribeSettings } from './settings';

interface NativeBackup {
  pickFolder(): Promise<{ name?: string; cancelled?: boolean }>;
  status(): Promise<{ configured: boolean; folderName?: string }>;
  write(o: { data: string }): Promise<{ savedAt: string }>;
  read(): Promise<{ data?: string }>;
}

const Native = registerPlugin<NativeBackup>('Backup');

const KEYS = ['piano-estudio:v1', 'piano-estudio:ajustes'];
/** Só gravamos sozinhos depois que este aparelho fez um backup ou uma restauração (evita apagar um backup bom com dados vazios). */
const READY_KEY = 'piano-estudio:backup-ativo';
const LAST_KEY = 'piano-estudio:backup-ultimo';

interface BackupFile {
  app: 'piano-estudio';
  version: 1;
  savedAt: string;
  storage: Record<string, string | null>;
  songs: (Omit<StoredSong, 'data'> & { data: string })[];
}

export const backupSupported = isNativeApp;

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromBase64(b64: string): ArrayBuffer {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes.buffer;
}

async function buildBackup(): Promise<string> {
  const songs = await listSongs();
  const file: BackupFile = {
    app: 'piano-estudio',
    version: 1,
    savedAt: new Date().toISOString(),
    storage: Object.fromEntries(KEYS.map((k) => [k, localStorage.getItem(k)])),
    songs: songs.map((s) => ({ ...s, data: toBase64(s.data) })),
  };
  return JSON.stringify(file);
}

export const backupStatus = () => Native.status();
export const lastBackupAt = () => localStorage.getItem(LAST_KEY);
export const autoBackupOn = () => localStorage.getItem(READY_KEY) === '1';

/** Abre o seletor de pasta. Retorna o nome da pasta e se já existe um backup lá. */
export async function chooseFolder(): Promise<{ name: string; existing: string | null } | null> {
  const r = await Native.pickFolder();
  if (r.cancelled || !r.name) return null;
  localStorage.removeItem(READY_KEY);
  const existing = await readBackup();
  if (!existing) await saveNow();
  return { name: r.name, existing: existing?.savedAt ?? null };
}

export async function saveNow(): Promise<string> {
  const { savedAt } = await Native.write({ data: await buildBackup() });
  localStorage.setItem(READY_KEY, '1');
  localStorage.setItem(LAST_KEY, savedAt);
  notify();
  return savedAt;
}

async function readBackup(): Promise<BackupFile | null> {
  const { data } = await Native.read();
  if (!data) return null;
  const f = JSON.parse(data) as BackupFile;
  if (f.app !== 'piano-estudio' || f.version !== 1) throw new Error('Arquivo de backup inválido');
  return f;
}

let restoring = false;

/** Traz progresso, ajustes e músicas do backup e recarrega o app. */
export async function restoreNow(): Promise<boolean> {
  const f = await readBackup();
  if (!f) return false;
  restoring = true;
  for (const [k, v] of Object.entries(f.storage)) {
    if (!KEYS.includes(k)) continue;
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  }
  for (const s of f.songs) await putSong({ ...s, data: fromBase64(s.data) });
  localStorage.setItem(READY_KEY, '1');
  localStorage.setItem(LAST_KEY, f.savedAt);
  location.reload();
  return true;
}

// Avisos para a tela de Ajustes mostrar o horário do último backup.
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
export function onBackupChange(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

let timer: ReturnType<typeof setTimeout> | undefined;
let dirty = false;

function flush() {
  clearTimeout(timer);
  timer = undefined;
  if (!dirty || restoring || !autoBackupOn()) return;
  dirty = false;
  saveNow().catch(() => { dirty = true; });
}

function schedule() {
  if (restoring) return;
  dirty = true;
  clearTimeout(timer);
  timer = setTimeout(flush, 5000);
}

/** Liga o backup automático: grava alguns segundos depois de cada mudança e ao sair do app. */
export function initAutoBackup() {
  if (!backupSupported) return;
  subscribeProgress(schedule);
  subscribeSettings(schedule);
  subscribeLibrary(schedule);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}
