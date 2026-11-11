import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Player } from './components/Player';
import { input } from './engine/input';
import { LESSONS, lessonById, MODULES } from './lib/lessons';
import { BUILTIN_PIECES } from './lib/pieces';
import type { Song } from './lib/song';
import { Home } from './pages/Home';
import { SettingsPage } from './pages/Settings';
import { Songs, SongSetup } from './pages/Songs';

const Coach = lazy(() => import('./pages/Coach').then((m) => ({ default: m.Coach })));
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

export function App() {
  const route = useHash();
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
  } else if (section === 'ajustes') {
    body = <SettingsPage />;
  } else {
    body = <Home />;
  }

  return (
    <div className={'app' + (inPlayer ? ' app-player' : '')}>
      {!inPlayer && (
        <header className="topbar">
          <a className="brand" href="#/">
            <span className="brand-keys" aria-hidden="true"><i /><i /><i /></span>
            Piano Estúdio
          </a>
          <nav>
            <a href="#/" aria-current={section === '' ? 'page' : undefined}>Trilha</a>
            <a href="#/leitura" aria-current={section === 'leitura' ? 'page' : undefined}>Leitura</a>
            <a href="#/musicas" aria-current={section === 'musicas' ? 'page' : undefined}>Músicas</a>
            <a href="#/coach" aria-current={section === 'coach' ? 'page' : undefined}>Coach</a>
            <a href="#/ajustes" aria-current={section === 'ajustes' ? 'page' : undefined}>Ajustes</a>
          </nav>
          <span className={'midi-pill' + (devices ? ' on' : '')} title={devices ? 'Teclado MIDI conectado' : 'Nenhum teclado MIDI'}>
            {devices ? 'Teclado conectado' : 'Sem teclado'}
          </span>
        </header>
      )}
      <main>{body}</main>
    </div>
  );
}
