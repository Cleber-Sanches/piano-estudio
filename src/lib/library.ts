// Biblioteca de músicas: arquivos .mid guardados no navegador (IndexedDB).

export interface StoredSong {
  id: string;
  name: string;
  addedAt: string;
  data: ArrayBuffer;
  /** Mão por faixa escolhida pelo usuário. */
  hands?: Record<number, 'R' | 'L' | 'ignorar'> | 'split';
}

const DB = 'piano-estudio';
const STORE = 'musicas';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const r = fn(db.transaction(STORE, mode).objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export const listSongs = () => tx<StoredSong[]>('readonly', (s) => s.getAll() as IDBRequest<StoredSong[]>);
export const getSong = (id: string) => tx<StoredSong | undefined>('readonly', (s) => s.get(id) as IDBRequest<StoredSong | undefined>);
export const putSong = (song: StoredSong) => tx('readwrite', (s) => s.put(song));
export const deleteSong = (id: string) => tx('readwrite', (s) => s.delete(id));

export function newId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
