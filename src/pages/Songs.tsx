import { Midi } from '@tonejs/midi';
import { useEffect, useState } from 'react';
import { BUILTIN_PIECES } from '../lib/pieces';
import { deleteSong, getSong, listSongs, newId, putSong, type StoredSong } from '../lib/library';
import { guessHands, midiTracks, songFromMidi, type Song, type TrackHands, type TrackInfo } from '../lib/song';
import { noteName } from '../lib/theory';

export function Songs({ openSong }: { openSong: (id: string) => void }) {
  const [songs, setSongs] = useState<StoredSong[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const refresh = () => listSongs().then((s) => setSongs(s.sort((a, b) => b.addedAt.localeCompare(a.addedAt)))).catch(() => setSongs([]));
  useEffect(() => { refresh(); }, []);

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    setError(null);
    for (const f of Array.from(files)) {
      try {
        const data = await f.arrayBuffer();
        const midi = new Midi(data);
        if (!midi.tracks.some((t) => t.notes.length)) throw new Error('sem notas');
        const tracks = midiTracks(midi);
        await putSong({ id: newId(), name: f.name.replace(/\.(mid|midi)$/i, ''), addedAt: new Date().toISOString(), data, hands: guessHands(tracks) });
      } catch {
        setError(`Não consegui ler “${f.name}”. Confira se é um arquivo .mid válido.`);
      }
    }
    refresh();
  };

  return (
    <div className="page">
      <section className="card">
        <h1>Repertório sugerido</h1>
        <p className="muted">Peças escolhidas para o seu nível, prontas para tocar. Comece pelo nível 1 e use o modo espera com mãos separadas.</p>
        <div className="song-list">
          {BUILTIN_PIECES.map((pc) => (
            <a key={pc.id} className="rep-row" href={'#/peca/' + pc.id}>
              <span className={'rep-level l' + pc.level}>Nível {pc.level}</span>
              <span className="rep-main">
                <b>{pc.title}</b>
                <span className="muted small">{pc.why}</span>
              </span>
              <span className="plan-go" aria-hidden="true">→</span>
            </a>
          ))}
        </div>
      </section>

      <section className="card">
        <h1>Suas músicas</h1>
        <p className="muted">Adicione os arquivos .mid que você usa no Synthesia. Eles ficam guardados neste navegador. Para músicas recentes, use arquivos que você comprou ou baixou de fontes autorizadas.</p>
        <label className="drop" htmlFor="upload"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); onFiles(e.dataTransfer.files); }}>
          <input id="upload" type="file" accept=".mid,.midi,audio/midi" multiple onChange={(e) => onFiles(e.target.files)} />
          <b>Escolher arquivos .mid</b>
          <span className="muted">ou arraste para cá</span>
        </label>
        {error && <p className="warn">{error}</p>}
      </section>

      <section className="card">
        {songs == null ? <p className="muted">Carregando…</p> : songs.length === 0 ? (
          <div className="empty">Nenhuma música ainda. A pasta de músicas do Synthesia costuma ter os .mid que você já toca.</div>
        ) : (
          <div className="song-list">
            {songs.map((s) => (
              <div key={s.id} className="song-row">
                <button className="song-name" onClick={() => openSong(s.id)}>{s.name}</button>
                <span className="muted small">{new Date(s.addedAt).toLocaleDateString('pt-BR')}</span>
                {confirmDel === s.id ? (
                  <span className="actions">
                    <button className="btn small danger" onClick={async () => { await deleteSong(s.id); setConfirmDel(null); refresh(); }}>Apagar</button>
                    <button className="btn small ghost" onClick={() => setConfirmDel(null)}>Cancelar</button>
                  </span>
                ) : (
                  <button className="btn small ghost" onClick={() => setConfirmDel(s.id)} aria-label={`Remover ${s.name}`}>Remover</button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/** Carrega a música e deixa escolher a mão de cada faixa antes de praticar. */
export function SongSetup({ id, onReady, onBack }: { id: string; onReady: (s: Song) => void; onBack: () => void }) {
  const [stored, setStored] = useState<StoredSong | null>(null);
  const [midi, setMidi] = useState<Midi | null>(null);
  const [tracks, setTracks] = useState<TrackInfo[]>([]);
  const [hands, setHands] = useState<TrackHands | 'split'>('split');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getSong(id).then((s) => {
      if (!s) { setErr('Música não encontrada.'); return; }
      const m = new Midi(s.data);
      const t = midiTracks(m);
      setStored(s);
      setMidi(m);
      setTracks(t);
      setHands(s.hands ?? guessHands(t));
    }).catch(() => setErr('Não consegui abrir a música.'));
  }, [id]);

  if (err) return <div className="page"><p className="warn">{err}</p><button className="btn ghost" onClick={onBack}>← Voltar</button></div>;
  if (!stored || !midi) return <div className="page"><p className="muted">Abrindo…</p></div>;

  const start = async () => {
    await putSong({ ...stored, hands });
    onReady(songFromMidi(midi, stored.name, hands));
  };

  return (
    <div className="page">
      <button className="btn ghost" onClick={onBack}>← Voltar</button>
      <section className="card">
        <h1>{stored.name}</h1>
        <p className="muted">{Math.round(midi.duration)} s · {midi.header.tempos[0] ? Math.round(midi.header.tempos[0].bpm) + ' BPM' : 'andamento não informado'}</p>
        <h2>Qual mão toca cada faixa?</h2>
        {tracks.length <= 1 ? (
          <p className="muted">Este arquivo tem uma faixa só. Vou dividir pelo Dó central: notas do Dó central para cima vão para a direita.</p>
        ) : (
          <div className="tracks">
            {tracks.map((t) => (
              <label key={t.index} className="track" htmlFor={'faixa-' + t.index}>
                <span>
                  <b>{t.name}</b>
                  <span className="muted small"> · {t.noteCount} notas · média {noteName(Math.round(t.avgPitch))}</span>
                </span>
                <select id={'faixa-' + t.index} value={hands === 'split' ? 'split' : hands[t.index] ?? 'ignorar'}
                  onChange={(e) => setHands({ ...(hands === 'split' ? Object.fromEntries(tracks.map((x) => [x.index, 'ignorar'])) : hands), [t.index]: e.target.value as 'R' | 'L' | 'ignorar' })}>
                  {hands === 'split' && <option value="split">Dividir no Dó central</option>}
                  <option value="R">Mão direita</option>
                  <option value="L">Mão esquerda</option>
                  <option value="ignorar">Ignorar</option>
                </select>
              </label>
            ))}
          </div>
        )}
        <div className="actions">
          <button className="btn big" onClick={start}>Praticar</button>
          {tracks.length > 1 && hands !== 'split' && <button className="btn ghost" onClick={() => setHands('split')}>Dividir tudo no Dó central</button>}
        </div>
      </section>
    </div>
  );
}
