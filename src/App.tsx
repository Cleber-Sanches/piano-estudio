import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { BookOpen, GraduationCap, MessageCircle, Music, Piano, Route, Settings2, Sparkles, Sun } from 'lucide-react';
import { EarGame, Jam } from './components/Games';
import { Player } from './components/Player';
import { input } from './engine/input';
import { GAMES } from './lib/curriculum';
import { LESSONS, lessonById, MODULES } from './lib/lessons';
import { BUILTIN_PIECES } from './lib/pieces';
import { switchProfile, useActiveProfile, useProfiles } from './lib/profiles';
import type { Song } from './lib/song';
import { Home } from './pages/Home';
import { KidGameRoute, Kids, Listen } from './pages/Kids';
import { ProfilesPage } from './pages/Profiles';
import { SettingsPage } from './pages/Settings';
import { Songs, SongSetup } from './pages/Songs';
import { Obra, Trail } from './pages/Trail';

const Coach = lazy(() => import('./pages/Coach').then((m) => ({ default: m.Coach })));
const Mestre = lazy(() => import('./pages/Mestre').then((m) => ({ default: m.Mestre })));
const Reading = lazy(() => import('./pages/Reading').then((m) => ({ default: m.Reading })));

function useHash() {
  const [hash, setHash] = useState(() => location.hash.slice(1) || '/');
  useEffect(() => {
    const f = () => setHash(location.hash.slice(1) || '/');
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return hash;
}

const go = (path: string) => { location.hash = path; };

/** Bolinha com a inicial do perfil; abre a lista para trocar. */
function ProfileSwitcher() {
  const active = useActiveProfile();
  const list = useProfiles();
  const [open, setOpen] = useState(false);
  return (
    <div className="profile-switch">
      <button className="avatar" style={{ background: active.color }} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={'Perfil: ' + active.name + '. Trocar perfil'}>
        {active.name.slice(0, 1).toUpperCase()}
      </button>
      {open && (
        <>
          <div className="menu-backdrop" onClick={() => setOpen(false)} />
          <div className="profile-menu" role="menu">
            {list.map((p) => (
              <button key={p.id} role="menuitem" className={p.id === active.id ? 'on' : ''} onClick={() => { switchProfile(p.id); setOpen(false); go('/'); }}>
                <span className="avatar small" style={{ background: p.color }} aria-hidden="true">{p.name.slice(0, 1).toUpperCase()}</span>
                {p.name} <span className="muted small">{p.kind === 'crianca' ? 'criança' : 'adulto'}</span>
              </button>
            ))}
            <a role="menuitem" href="#/perfis" onClick={() => setOpen(false)}>Novo perfil / gerenciar</a>
          </div>
        </>
      )}
    </div>
  );
}

export function App() {
  const route = useHash();
  const profile = useActiveProfile();
  const kid = profile.kind === 'crianca';
  const [devices, setDevices] = useState(0);
  const [song, setSong] = useState<{ id: string; song: Song } | null>(null);
  useEffect(() => input.onDevices((d) => setDevices(d.length)), []);

  const parts = route.split('/').filter(Boolean);
  const section = parts[0] ?? '';
  const builtin = useMemo(() => {
    const pc = section === 'peca' ? BUILTIN_PIECES.find((x) => x.id === parts[1]) : undefined;
    return pc ? { pc, song: pc.build(pc.bpm, ['R', 'L']) } : null;
  }, [section, parts[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  const inPlayer = (section === 'peca' && builtin) || (section === 'licao' && parts[1]) || (section === 'teste' && parts[1]) || (section === 'musica' && parts[1] && song?.id === parts[1]);

  const testLesson = useMemo(() => {
    const mod = section === 'teste' ? MODULES.find((m) => m.id === parts[1]) : undefined;
    const lesson = mod && lessonById(mod.testId);
    if (!mod || !lesson) return null;
    return {
      mod,
      lesson: { ...lesson, title: `Teste do módulo: ${mod.title}`, tip: `Uma passada no modo tempo a ${lesson.goalBpm} BPM com ${Math.round(lesson.goalAccuracy * 100)}% libera o módulo inteiro. Pode treinar no modo espera antes.` },
    };
  }, [section, parts[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  let body: React.ReactNode;
  if (section === 'licao' && parts[1]) {
    const lesson = lessonById(parts[1]);
    if (!lesson) body = <p className="page">Lição não encontrada.</p>;
    else {
      const i = LESSONS.indexOf(lesson);
      const next = LESSONS[i + 1];
      body = <Player key={lesson.id} kind="licao" id={lesson.id} lesson={lesson} onExit={() => go('/')} onNextLesson={next ? () => go('/licao/' + next.id) : undefined} />;
    }
  } else if (section === 'teste' && parts[1]) {
    body = testLesson
      ? <Player key={'teste-' + testLesson.mod.id} kind="teste" id={testLesson.lesson.id} lesson={testLesson.lesson} moduleTest={{ id: testLesson.mod.id, title: testLesson.mod.title }} onExit={() => go('/')} />
      : <p className="page">Teste não encontrado.</p>;
  } else if (section === 'peca') {
    body = builtin
      ? <Player key={'peca-' + builtin.pc.id} kind="musica" id={'peca-' + builtin.pc.id} song={builtin.song} onExit={() => go('/musicas')} />
      : <p className="page">Peça não encontrada.</p>;
  } else if (section === 'sessao' && !kid) {
    body = <Suspense fallback={<p className="page muted">Carregando…</p>}><Mestre /></Suspense>;
  } else if (section === 'leitura') {
    body = <Suspense fallback={<p className="page muted">Carregando…</p>}><Reading /></Suspense>;
  } else if (section === 'musica' && parts[1]) {
    body = song?.id === parts[1]
      ? <Player key={parts[1]} kind="musica" id={parts[1]} song={song.song} onExit={() => { setSong(null); go('/musicas'); }} />
      : <SongSetup id={parts[1]} onBack={() => go('/musicas')} onReady={(s) => setSong({ id: parts[1], song: s })} />;
  } else if (section === 'musicas') {
    body = <Songs openSong={(id) => { setSong(null); go('/musica/' + id); }} />;
  } else if (section === 'coach') {
    body = <Suspense fallback={<p className="page muted">Carregando…</p>}><Coach /></Suspense>;
  } else if (section === 'trilha' && !kid) {
    body = <Trail />;
  } else if (section === 'obra' && parts[1]) {
    body = <Obra id={parts[1]} />;
  } else if (section === 'ajustes') {
    body = <SettingsPage />;
  } else if (section === 'perfis') {
    body = <ProfilesPage />;
  } else if (section === 'ouvir' && parts[1]) {
    body = <Listen key={parts[1]} id={parts[1]} onExit={() => go(kid ? '/' : '/musicas')} />;
  } else if (section === 'jogo' && parts[1]) {
    const g = GAMES[parts[1]];
    const back = () => go('/');
    body = g
      ? g.type === 'eco'
        ? <EarGame key={parts[1]} id={parts[1]} title={g.title} detail={g.detail} pool={g.pool} length={g.length} rounds={g.rounds} onExit={back} />
        : <Jam key={parts[1]} id={parts[1]} title={g.title} detail={g.detail} pool={g.pool} backing={g.backing} seconds={g.seconds} onExit={back} />
      : <KidGameRoute key={parts[1]} id={parts[1]} onExit={back} />;
  } else {
    body = kid ? <Kids /> : <Home />;
  }

  const items = [
    { href: '#/', label: kid ? 'Brincar' : 'Hoje', Icon: kid ? Sparkles : Sun, on: section === '' },
    ...(kid ? [] : [{ href: '#/sessao', label: 'Professor', Icon: GraduationCap, on: section === 'sessao' }]),
    ...(kid ? [] : [{ href: '#/trilha', label: 'Trilha', Icon: Route, on: section === 'trilha' || section === 'obra' }]),
    ...(kid ? [] : [{ href: '#/leitura', label: 'Leitura', Icon: BookOpen, on: section === 'leitura' }]),
    { href: '#/musicas', label: 'Músicas', Icon: Music, on: section === 'musicas' || section === 'musica' },
    ...(kid ? [] : [{ href: '#/coach', label: 'Coach', Icon: MessageCircle, on: section === 'coach' }]),
    { href: '#/ajustes', label: 'Ajustes', Icon: Settings2, on: section === 'ajustes' || section === 'perfis' },
  ];

  return (
    <div className={'app' + (inPlayer ? ' app-player' : '')}>
      {!inPlayer && (
        <aside className="sidebar">
          <a className="brand" href="#/" aria-label="Piano Estúdio, início">
            <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
            <span className="brand-name">Piano<br />Estúdio</span>
          </a>
          <nav className="nav">
            {items.map(({ href, label, Icon, on }) => (
              <a key={href} href={href} aria-current={on ? 'page' : undefined}>
                <Icon size={21} strokeWidth={on ? 2.2 : 1.8} aria-hidden="true" />
                <span>{label}</span>
              </a>
            ))}
          </nav>
          <div className="sidebar-foot">
            <span className={'midi-pill' + (devices ? ' on' : '')} title={devices ? 'Teclado MIDI conectado' : 'Nenhum teclado MIDI'}>
              <Piano size={16} aria-hidden="true" />
              <span>{devices ? 'Teclado conectado' : 'Sem teclado'}</span>
            </span>
            <ProfileSwitcher />
          </div>
        </aside>
      )}
      <main key={profile.id}>{body}</main>
    </div>
  );
}
