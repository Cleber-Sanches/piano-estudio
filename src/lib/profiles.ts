import { useSyncExternalStore } from 'react';

// Perfis: cada pessoa tem o próprio progresso. Os ajustes do aparelho (atraso, volume) são compartilhados.

export type ProfileKind = 'adulto' | 'crianca';

export interface Profile {
  id: string;
  name: string;
  kind: ProfileKind;
  /** Só para crianças: data de nascimento (AAAA-MM-DD), usada para escolher as atividades da idade. */
  birth?: string;
  color: string;
  createdAt: string;
}

interface ProfilesFile {
  active: string;
  list: Profile[];
}

export const PROFILES_KEY = 'piano-estudio:perfis';
/** O primeiro perfil usa a chave antiga, para não perder o progresso de antes dos perfis. */
export const FIRST_ID = 'principal';
export const PROFILE_COLORS = ['#C98F2E', '#2C9C8E', '#D9577A', '#6B6BD6', '#4E9A3C', '#E07A2E'];

function initial(): ProfilesFile {
  return { active: FIRST_ID, list: [{ id: FIRST_ID, name: 'Eu', kind: 'adulto', color: PROFILE_COLORS[0], createdAt: new Date().toISOString() }] };
}

let file: ProfilesFile = (() => {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    const f = raw ? (JSON.parse(raw) as ProfilesFile) : initial();
    if (!f.list?.length) return initial();
    if (!f.list.some((p) => p.id === f.active)) f.active = f.list[0].id;
    return f;
  } catch {
    return initial();
  }
})();

const listeners = new Set<() => void>();

function save(f: ProfilesFile) {
  file = f;
  try { localStorage.setItem(PROFILES_KEY, JSON.stringify(f)); } catch { /* ignora */ }
  listeners.forEach((l) => l());
}

export function subscribeProfiles(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export const profiles = () => file.list;
export const activeProfile = (): Profile => file.list.find((p) => p.id === file.active) ?? file.list[0];

/** Chave do progresso de um perfil no localStorage. */
export const storeKey = (id: string) => (id === FIRST_ID ? 'piano-estudio:v1' : 'piano-estudio:v1:' + id);
export const allStoreKeys = () => file.list.map((p) => storeKey(p.id));

export function switchProfile(id: string) {
  if (file.list.some((p) => p.id === id) && id !== file.active) save({ ...file, active: id });
}

export function addProfile(p: Omit<Profile, 'id' | 'createdAt' | 'color'> & { color?: string }): Profile {
  const prof: Profile = {
    ...p,
    id: Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4),
    color: p.color ?? PROFILE_COLORS[file.list.length % PROFILE_COLORS.length],
    createdAt: new Date().toISOString(),
  };
  save({ active: prof.id, list: [...file.list, prof] });
  return prof;
}

export function updateProfile(id: string, patch: Partial<Omit<Profile, 'id' | 'createdAt'>>) {
  save({ ...file, list: file.list.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
}

/** Remove um perfil e o progresso dele. O primeiro perfil não pode ser removido. */
export function removeProfile(id: string) {
  if (id === FIRST_ID) return;
  try { localStorage.removeItem(storeKey(id)); } catch { /* ignora */ }
  const list = file.list.filter((p) => p.id !== id);
  save({ active: file.active === id ? list[0].id : file.active, list });
}

/** Idade em meses a partir da data de nascimento (negativa se ainda não nasceu). */
export function ageMonths(birth?: string, now = new Date()): number | null {
  if (!birth) return null;
  const b = new Date(birth + 'T12:00:00');
  if (isNaN(b.getTime())) return null;
  return (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth()) - (now.getDate() < b.getDate() ? 1 : 0);
}

export function ageLabel(months: number | null): string {
  if (months == null) return '';
  if (months < 0) return 'ainda vai nascer';
  if (months < 12) return `${months} ${months === 1 ? 'mês' : 'meses'}`;
  const y = Math.floor(months / 12);
  return `${y} ${y === 1 ? 'ano' : 'anos'}`;
}

export function useActiveProfile(): Profile {
  return useSyncExternalStore(subscribeProfiles, activeProfile);
}

export function useProfiles(): Profile[] {
  return useSyncExternalStore(subscribeProfiles, profiles);
}
