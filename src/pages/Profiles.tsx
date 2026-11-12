import { useState } from 'react';
import { addProfile, ageLabel, ageMonths, FIRST_ID, PROFILE_COLORS, removeProfile, switchProfile, updateProfile, useActiveProfile, useProfiles, type Profile, type ProfileKind } from '../lib/profiles';

// Criar, editar e remover perfis. Cada perfil tem a própria trilha e o próprio progresso.

function ProfileForm({ initial, onSave, onCancel }: { initial?: Profile; onSave: (p: { name: string; kind: ProfileKind; birth?: string; color: string }) => void; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [kind, setKind] = useState<ProfileKind>(initial?.kind ?? 'crianca');
  const [birth, setBirth] = useState(initial?.birth ?? '');
  const [color, setColor] = useState(initial?.color ?? PROFILE_COLORS[1]);
  const ok = name.trim().length > 0;
  return (
    <form className="profile-form" onSubmit={(e) => { e.preventDefault(); if (ok) onSave({ name: name.trim(), kind, birth: kind === 'crianca' && birth ? birth : undefined, color }); }}>
      <label htmlFor="pf-nome">Nome</label>
      <input id="pf-nome" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" placeholder="Ex.: Ana" />
      <span className="field-label">Tipo</span>
      <div className="chips" role="radiogroup" aria-label="Tipo de perfil">
        <button type="button" className={'chip' + (kind === 'crianca' ? ' on' : '')} aria-pressed={kind === 'crianca'} onClick={() => setKind('crianca')}>Criança (até 7 anos)</button>
        <button type="button" className={'chip' + (kind === 'adulto' ? ' on' : '')} aria-pressed={kind === 'adulto'} onClick={() => setKind('adulto')}>Adulto / trilha completa</button>
      </div>
      {kind === 'crianca' && (
        <>
          <label htmlFor="pf-nasc">Data de nascimento (ou a data prevista)</label>
          <input id="pf-nasc" type="date" value={birth} onChange={(e) => setBirth(e.target.value)} />
          <p className="muted small">Usada só para escolher as atividades da idade. {birth ? 'Hoje: ' + ageLabel(ageMonths(birth)) + '.' : ''}</p>
        </>
      )}
      <span className="field-label">Cor</span>
      <div className="chips" role="radiogroup" aria-label="Cor">
        {PROFILE_COLORS.map((c) => <button key={c} type="button" className={'swatch' + (c === color ? ' on' : '')} style={{ background: c }} aria-label={'Cor ' + c} aria-pressed={c === color} onClick={() => setColor(c)} />)}
      </div>
      <div className="actions">
        <button className="btn" type="submit" disabled={!ok}>{initial ? 'Salvar' : 'Criar perfil'}</button>
        <button className="btn ghost" type="button" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
}

export function ProfilesPage() {
  const list = useProfiles();
  const active = useActiveProfile();
  const [editing, setEditing] = useState<string | 'novo' | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  return (
    <div className="page">
      <section className="card">
        <h1>Perfis</h1>
        <p className="muted">Cada pessoa tem a própria trilha e o próprio progresso. Os ajustes do piano (atraso, volume) valem para todos.</p>
        <div className="song-list">
          {list.map((p) => (
            <div key={p.id} className="profile-row">
              {editing === p.id ? (
                <ProfileForm initial={p} onCancel={() => setEditing(null)} onSave={(v) => { updateProfile(p.id, v); setEditing(null); }} />
              ) : (
                <>
                  <span className="avatar" style={{ background: p.color }} aria-hidden="true">{p.name.slice(0, 1).toUpperCase()}</span>
                  <span className="rep-main">
                    <b>{p.name}{p.id === active.id ? ' · ativo' : ''}</b>
                    <span className="muted small">{p.kind === 'crianca' ? 'Criança' + (p.birth ? ' · ' + ageLabel(ageMonths(p.birth)) : '') : 'Adulto · trilha completa'}</span>
                  </span>
                  <span className="actions">
                    {p.id !== active.id && <button className="btn small" onClick={() => { switchProfile(p.id); location.hash = '/'; }}>Usar</button>}
                    <button className="btn small ghost" onClick={() => setEditing(p.id)}>Editar</button>
                    {p.id !== FIRST_ID && (confirmDel === p.id ? (
                      <>
                        <button className="btn small danger" onClick={() => { removeProfile(p.id); setConfirmDel(null); }}>Apagar perfil e progresso</button>
                        <button className="btn small ghost" onClick={() => setConfirmDel(null)}>Cancelar</button>
                      </>
                    ) : <button className="btn small ghost" onClick={() => setConfirmDel(p.id)}>Remover</button>)}
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
        {editing === 'novo'
          ? <ProfileForm onCancel={() => setEditing(null)} onSave={(v) => { addProfile(v); setEditing(null); location.hash = '/'; }} />
          : <div className="actions"><button className="btn" onClick={() => setEditing('novo')}>Novo perfil</button></div>}
      </section>
    </div>
  );
}
