import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ask, firstMessage, friendlyError, getApiKey, setApiKey, visibleText, type ChatMessage } from '../lib/ai';

const SUGGESTIONS = [
  'Analise meu progresso das últimas duas semanas e diga o que treinar hoje.',
  'Por que estou travado na lição atual? O que mudar?',
  'Onde estou errando mais: tempo, notas ou alguma mão?',
];

// negrito e itálico simples, sem HTML cru
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part.startsWith('_') && part.endsWith('_') && part.length > 2 ? <em key={i}>{part.slice(1, -1)}</em>
        : part);
}

function Markdown({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const items = list.items.map((it, i) => <li key={i}>{inline(it)}</li>);
    out.push(list.ordered ? <ol key={out.length}>{items}</ol> : <ul key={out.length}>{items}</ul>);
    list = null;
  };
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    const ul = /^\s*[-*•]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (ul || ol) {
      const ordered = !!ol;
      if (list && list.ordered !== ordered) flush();
      if (!list) list = { ordered, items: [] };
      list.items.push((ul ?? ol)![1]);
      continue;
    }
    flush();
    const h = /^#{1,4}\s+(.*)$/.exec(line);
    if (h) out.push(<h3 key={out.length}>{inline(h[1])}</h3>);
    else if (line.trim() && !/^-{3,}$/.test(line.trim())) out.push(<p key={out.length}>{inline(line)}</p>);
  }
  flush();
  return <>{out}</>;
}

export function Coach() {
  const [hasKey, setHasKey] = useState(() => !!getApiKey());
  const [keyDraft, setKeyDraft] = useState('');
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [history.length, streaming]);

  const busy = streaming !== null;

  const send = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    const userMsg: ChatMessage = history.length ? { role: 'user', content: q } : firstMessage(q);
    const next = [...history, userMsg];
    setHistory(next);
    setDraft('');
    setError(null);
    setStreaming('');
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const reply = await ask(next, (t) => setStreaming(t), ctrl.signal);
      setHistory([...next, reply]);
    } catch (e) {
      if (!ctrl.signal.aborted) setError(friendlyError(e));
      setHistory(history); // desfaz a pergunta que falhou, para poder tentar de novo
      setDraft(q);
    } finally {
      setStreaming(null);
      abortRef.current = null;
    }
  };

  const saveKey = () => {
    const k = keyDraft.trim();
    if (!k) return;
    setApiKey(k);
    setKeyDraft('');
    setHasKey(true);
  };

  if (!hasKey) {
    return (
      <div className="page coach">
        <section className="card">
          <p className="eyebrow">Coach IA</p>
          <h1>Converse com o Claude sobre sua prática</h1>
          <p className="muted">O coach lê seu histórico de tentativas, BPM, precisão e minutos, e sugere o que treinar. Ele precisa de uma chave da API da Anthropic (criada em console.anthropic.com, com cobrança por uso).</p>
          <p className="muted small">A chave fica salva só neste aparelho e não vai para o backup do iCloud.</p>
          <div className="coach-key">
            <input type="password" autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder="sk-ant-…" value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveKey()} />
            <button className="btn" onClick={saveKey} disabled={!keyDraft.trim()}>Salvar chave</button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page coach">
      <div className="coach-head">
        <div>
          <p className="eyebrow">Coach IA</p>
          <h1>Seu coach de piano</h1>
          <p className="muted small">Lê seus dados de prática no começo de cada conversa.</p>
        </div>
        {history.length > 0 && !busy && <button className="btn ghost small" onClick={() => { setHistory([]); setError(null); }}>Nova conversa</button>}
      </div>

      {history.length === 0 && (
        <div className="coach-suggestions">
          {SUGGESTIONS.map((s, i) => (
            <button key={s} className={i === 0 ? 'btn' : 'btn ghost'} onClick={() => send(s)} disabled={busy}>{i === 0 ? 'Analisar meu progresso' : s}</button>
          ))}
        </div>
      )}

      <div className="coach-thread">
        {history.map((m, i) => (
          <div key={i} className={'coach-msg ' + m.role}>
            {m.role === 'assistant' ? <Markdown text={visibleText(m)} /> : <p>{visibleText(m)}</p>}
          </div>
        ))}
        {busy && (
          <div className="coach-msg assistant">
            {streaming ? <Markdown text={streaming} /> : <p className="muted">Analisando seus dados…</p>}
          </div>
        )}
        {error && <p className="warn">{error}</p>}
        <div ref={endRef} />
      </div>

      <form className="coach-input" onSubmit={(e) => { e.preventDefault(); send(draft); }}>
        <textarea rows={2} placeholder={history.length ? 'Pergunte mais alguma coisa…' : 'Ou escreva sua pergunta…'} value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(draft); } }} />
        {busy
          ? <button type="button" className="btn ghost" onClick={() => abortRef.current?.abort()}>Parar</button>
          : <button type="submit" className="btn" disabled={!draft.trim()}>Enviar</button>}
      </form>
    </div>
  );
}
