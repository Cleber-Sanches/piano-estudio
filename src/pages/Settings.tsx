import { useEffect, useState } from 'react';
import { setVolume, startAudio } from '../engine/audio';
import { input, isNativeApp, type MidiDevice } from '../engine/input';
import { getApiKey, setApiKey } from '../lib/ai';
import { autoBackupOn, backupStatus, backupSupported, chooseFolder, lastBackupAt, onBackupChange, restoreNow, saveNow } from '../lib/backup';
import { exportJson, importJson } from '../lib/progress';
import { setSettings, useSettings } from '../lib/settings';

export function SettingsPage() {
  const s = useSettings();
  const [devices, setDevices] = useState<MidiDevice[]>([]);
  const [last, setLast] = useState<string>('');
  const [msg, setMsg] = useState<string | null>(null);

  const [folder, setFolder] = useState<string | null>(null);
  const [lastBk, setLastBk] = useState<string | null>(lastBackupAt());
  const [pendingRestore, setPendingRestore] = useState<string | null>(null);
  const [bkMsg, setBkMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [aiKey, setAiKey] = useState(getApiKey);

  useEffect(() => {
    if (!backupSupported) return;
    backupStatus().then((r) => setFolder(r.configured ? r.folderName ?? 'pasta escolhida' : null)).catch(() => {});
    return onBackupChange(() => setLastBk(lastBackupAt()));
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setBkMsg(null);
    try { await fn(); } catch (e) { setBkMsg(e instanceof Error ? e.message : 'Algo deu errado.'); }
    setBusy(false);
  };

  const pick = () => run(async () => {
    const r = await chooseFolder();
    if (!r) return;
    setFolder(r.name);
    if (r.existing) setPendingRestore(r.existing);
    else setBkMsg('Pasta escolhida. Backup feito.');
  });

  const restore = () => run(async () => {
    if (!(await restoreNow())) setBkMsg('Não achei backup nessa pasta.');
  });

  const keepLocal = () => run(async () => {
    await saveNow();
    setPendingRestore(null);
    setBkMsg('Backup feito com os dados deste iPad.');
  });

  const fmt = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

  useEffect(() => input.onDevices(setDevices), []);
  useEffect(() => input.on((e) => e.type === 'on' && setLast(`${e.midi} (${e.source === 'midi' ? 'teclado MIDI' : e.source === 'pc' ? 'teclado do PC' : 'tela'})`)), []);

  const status = {
    'sem-suporte': 'Este navegador não tem Web MIDI. Use o Chrome ou o Edge no computador, ou o app Piano Estúdio no iPad.',
    negado: 'O acesso ao MIDI foi negado. Libere nas permissões do site (ícone ao lado do endereço) e recarregue.',
    ok: devices.length ? '' : isNativeApp ? 'Nenhum teclado conectado. Ligue o piano no iPad pelo cabo (adaptador USB) ou pareie por Bluetooth abaixo.' : 'Nenhum teclado conectado. Ligue o piano pelo cabo USB e ele aparece aqui.',
    desconhecido: 'Conectando…',
  }[input.midiStatus];

  const exp = () => {
    const blob = new Blob([exportJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'piano-estudio-progresso.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="page">
      <section className="card">
        <h1>Ajustes</h1>
        <h2>Teclado</h2>
        <label htmlFor="device">Entrada MIDI
          <select id="device" value={devices.some((d) => d.id === s.deviceId) ? s.deviceId : 'todos'} onChange={(e) => { setSettings({ deviceId: e.target.value }); input.selectedId = e.target.value; }}>
            <option value="todos">Todos os teclados conectados</option>
            {devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        {devices.length > 0 && <p className="ok small">Piano detectado: <strong>{devices.map((d) => d.name).join(', ')}</strong></p>}
        {status && <p className="warn">{status}</p>}
        {isNativeApp && <div className="actions"><button className="btn ghost" onClick={() => input.pairBluetooth()}>Parear teclado Bluetooth</button></div>}
        <p className="muted small">Última nota recebida: <span className="mono">{last || '—'}</span>. Sem teclado, use o teclado do computador: A W S E D F T G Y H U J K (Dó a Dó), Z e X trocam a oitava.</p>
      </section>

      <section className="card">
        <h2>Som</h2>
        <label className="check-inline" htmlFor="som-meu"><input id="som-meu" type="checkbox" checked={s.soundMine} onChange={(e) => setSettings({ soundMine: e.target.checked })} /> Tocar som quando eu aperto uma tecla <span className="muted small">(deixe desligado se o piano elétrico já faz som)</span></label>
        <label className="check-inline" htmlFor="som-auto"><input id="som-auto" type="checkbox" checked={s.soundAuto} onChange={(e) => setSettings({ soundAuto: e.target.checked })} /> Tocar a mão que eu não estou praticando</label>
        <label className="check-inline" htmlFor="metronomo"><input id="metronomo" type="checkbox" checked={s.metronome} onChange={(e) => setSettings({ metronome: e.target.checked })} /> Metrônomo</label>
        <label htmlFor="volume">Volume do piano do app
          <input id="volume" type="range" min={0} max={1} step={0.05} value={s.volume} onChange={(e) => { const v = Number(e.target.value); setSettings({ volume: v }); startAudio().then(() => setVolume(v)); }} />
        </label>
      </section>

      <section className="card">
        <h2>Tela</h2>
        <label className="check-inline" htmlFor="dedos"><input id="dedos" type="checkbox" checked={s.showFingers} onChange={(e) => setSettings({ showFingers: e.target.checked })} /> Mostrar números dos dedos nas notas</label>
        <label className="check-inline" htmlFor="nomes"><input id="nomes" type="checkbox" checked={s.showNames} onChange={(e) => setSettings({ showNames: e.target.checked })} /> Mostrar nomes das notas no teclado</label>
        <label className="check-inline" htmlFor="pauta"><input id="pauta" type="checkbox" checked={s.showSheet} onChange={(e) => setSettings({ showSheet: e.target.checked })} /> Mostrar partitura</label>
      </section>

      <section className="card">
        <h2>Precisão do modo tempo</h2>
        <label htmlFor="janela">Tolerância: <span className="mono">±{s.windowMs} ms</span>
          <input id="janela" type="range" min={80} max={300} step={10} value={s.windowMs} onChange={(e) => setSettings({ windowMs: Number(e.target.value) })} />
        </label>
        <label htmlFor="latencia">Compensar atraso do teclado: <span className="mono">{s.latencyMs} ms</span>
          <input id="latencia" type="range" min={0} max={150} step={5} value={s.latencyMs} onChange={(e) => setSettings({ latencyMs: Number(e.target.value) })} />
        </label>
        <p className="muted small">Se o resultado sempre diz que você atrasa uns 30–60 ms mesmo tocando junto do metrônomo, aumente a compensação.</p>
      </section>

      {backupSupported && (
        <section className="card">
          <h2>Backup no iCloud</h2>
          <p className="muted small">Escolha uma pasta no iCloud Drive uma vez. O app guarda lá o progresso, os ajustes e as músicas sozinho, depois de cada mudança e quando você sai do app.</p>
          {folder
            ? <p className="ok small">Pasta: <strong>{folder}</strong>{lastBk && autoBackupOn() ? <> · último backup {fmt(lastBk)}</> : null}</p>
            : <p className="warn small">Nenhuma pasta escolhida ainda. Os dados estão só neste iPad.</p>}
          {pendingRestore && (
            <div className="warn small">
              <p>Já existe um backup nessa pasta, de {fmt(pendingRestore)}. O que fazer?</p>
              <div className="actions">
                <button className="btn" disabled={busy} onClick={restore}>Restaurar o backup</button>
                <button className="btn ghost" disabled={busy} onClick={keepLocal}>Substituir pelos dados deste iPad</button>
              </div>
            </div>
          )}
          <div className="actions">
            <button className="btn ghost" disabled={busy} onClick={pick}>{folder ? 'Trocar pasta de backup' : 'Escolher pasta de backup'}</button>
            {folder && !pendingRestore && <button className="btn ghost" disabled={busy} onClick={() => run(async () => { await saveNow(); setBkMsg('Backup feito.'); })}>Salvar agora</button>}
            {folder && !pendingRestore && <button className="btn ghost" disabled={busy} onClick={restore}>Restaurar do iCloud</button>}
            {bkMsg && <span className="muted">{bkMsg}</span>}
          </div>
        </section>
      )}

      <section className="card">
        <h2>Coach IA</h2>
        <p className="muted small">{aiKey ? `Chave salva neste aparelho (termina em …${aiKey.slice(-4)}). Ela não vai para o backup do iCloud.` : 'Nenhuma chave salva. Adicione uma na aba Coach.'}</p>
        <div className="actions">
          {aiKey
            ? <button className="btn ghost" onClick={() => { setApiKey(''); setAiKey(''); }}>Remover chave</button>
            : <a className="btn ghost" href="#/coach">Abrir o Coach</a>}
        </div>
      </section>

      <section className="card">
        <h2>Progresso</h2>
        <p className="muted small">Seu progresso fica salvo neste navegador. Exporte para levar para outro computador.</p>
        <div className="actions">
          <button className="btn ghost" onClick={exp}>Exportar progresso</button>
          <label className="btn ghost" htmlFor="importar">Importar progresso
            <input id="importar" type="file" accept="application/json,.json" hidden onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try { importJson(await f.text()); setMsg('Progresso importado.'); } catch { setMsg('Arquivo inválido.'); }
            }} />
          </label>
          {msg && <span className="muted">{msg}</span>}
        </div>
      </section>
    </div>
  );
}
