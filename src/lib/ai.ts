// Coach IA: conversa com o Claude sobre o seu progresso no piano.
// A chave da API fica só neste aparelho (fora do backup do iCloud).

import Anthropic from '@anthropic-ai/sdk';
import { LESSONS, MODULES } from './lessons';
import { load, nextLessonId, report } from './progress';

const KEY_STORAGE = 'piano-estudio:claude-key';
const MODEL = 'claude-opus-5-5';

export type ChatMessage = Anthropic.Beta.BetaMessageParam;

export const getApiKey = () => {
  try { return localStorage.getItem(KEY_STORAGE) ?? ''; } catch { return ''; }
};
export const setApiKey = (k: string) => {
  if (k) localStorage.setItem(KEY_STORAGE, k.trim());
  else localStorage.removeItem(KEY_STORAGE);
};

const SYSTEM = `Você é o coach de piano dentro do app "Piano Estúdio". O aluno estuda sozinho com um piano digital ligado por USB ao iPad.

Como o app funciona:
- Trilha de lições em módulos. Cada lição tem modo "espera" (o app espera a nota certa) e modo "tempo" (com metrônomo).
- Uma lição só é concluída com uma passada no modo tempo, sem repetição de trecho, na meta de BPM e com a precisão mínima (normalmente 90%). Se não bater a meta, a lição continua sendo a próxima no dia seguinte.
- O BPM sobe sozinho conforme o acerto. Há revisão espaçada de lições concluídas e a "Leitura relâmpago" para leitura de partitura.
- O desvio médio (ms) indica quão longe do tempo certo as notas saíram.

Como responder:
- Português do Brasil, direto e acolhedor, sem enrolação.
- Baseie tudo nos dados recebidos; cite números concretos. Se um dado não existe, diga isso em vez de inventar.
- Termine com no máximo 3 ações práticas para a próxima sessão (o que tocar, em qual modo, em que BPM, por quantos minutos).
- Respostas curtas: listas e frases curtas, poucos títulos.`;

/** Foto dos dados no começo da conversa (não muda no meio, para manter o histórico estável). */
export function practiceSnapshot(): string {
  const s = load();
  const next = nextLessonId(s);
  const lessons = LESSONS.map((l) => {
    const p = s.lessons[l.id];
    const mod = MODULES.find((m) => m.id === l.module)?.title ?? l.module;
    const status = p?.completed ? 'concluída' : p?.attempts ? 'em andamento' : 'não iniciada';
    return `${l.id === next ? '→ ' : ''}${l.title} [${mod}] meta ${l.goalBpm} BPM/${Math.round(l.goalAccuracy * 100)}% — ${status}` +
      (p?.attempts ? `; ${p.attempts} tentativas; melhor ${p.bestBpm} BPM, ${Math.round(p.bestAccuracy * 100)}%` : '');
  });
  const recent = s.attempts.slice(0, 80).map((a) =>
    [a.at.slice(0, 16).replace('T', ' '), a.title, a.mode, a.hands.join('+'), a.bpm ? a.bpm + 'bpm' : Math.round(a.speed * 100) + '%vel',
      Math.round(a.accuracy * 100) + '%', `${a.hits}/${a.total}`, a.wrong + ' erradas', Math.round(a.avgOffsetMs) + 'ms',
      a.loop ? `trecho ${a.loop[0] + 1}-${a.loop[1] + 1}` : '', a.troubleMeasures.length ? 'compassos difíceis ' + a.troubleMeasures.map((m) => m + 1).join(',') : '',
    ].filter(Boolean).join(' | '));
  return [
    `Hoje: ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`,
    '', report(14),
    '', 'TRILHA (→ = próxima lição):', ...lessons,
    '', 'TENTATIVAS RECENTES (mais nova primeiro; data | item | modo | mãos | andamento | precisão | acertos | erradas | desvio médio | trecho | compassos):',
    ...(recent.length ? recent : ['(nenhuma)']),
  ].join('\n');
}

/** Primeira mensagem de uma conversa: os dados + a pergunta. */
export function firstMessage(question: string): ChatMessage {
  return {
    role: 'user',
    content: [
      { type: 'text', text: `<dados_de_pratica>\n${practiceSnapshot()}\n</dados_de_pratica>` },
      { type: 'text', text: question },
    ],
  };
}

export function friendlyError(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return 'Chave da API inválida. Confira e cole de novo.';
  if (e instanceof Anthropic.PermissionDeniedError) return 'Essa chave não tem permissão para usar o modelo.';
  if (e instanceof Anthropic.RateLimitError) return 'Muitos pedidos ou limite da conta atingido. Tente de novo em instantes.';
  if (e instanceof Anthropic.APIConnectionError) return 'Sem conexão com a internet.';
  if (e instanceof Anthropic.APIError) return `Erro da API (${e.status ?? '?'}): ${e.message}`;
  return 'Algo deu errado: ' + (e instanceof Error ? e.message : String(e));
}

/** Envia a conversa e vai entregando o texto conforme chega. Devolve a mensagem completa do assistente. */
export async function ask(history: ChatMessage[], onText: (full: string) => void, signal?: AbortSignal): Promise<ChatMessage> {
  const client = new Anthropic({ apiKey: getApiKey(), dangerouslyAllowBrowser: true });
  const stream = client.beta.messages.stream(
    {
      model: MODEL,
      max_tokens: 64000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      system: SYSTEM,
      cache_control: { type: 'ephemeral' },
      messages: history,
    },
    { signal },
  );
  let text = '';
  stream.on('text', (delta) => { text += delta; onText(text); });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === 'refusal') {
    onText(text + (text ? '\n\n' : '') + '_O modelo não quis responder essa pergunta. Tente perguntar de outro jeito._');
  }
  return { role: 'assistant', content: msg.content };
}

/** Texto visível de uma mensagem (ignora blocos de raciocínio e os dados anexados). */
export function visibleText(m: ChatMessage): string {
  const c = m.content;
  if (!c) return '';
  if (typeof c === 'string') return c;
  const out: string[] = [];
  for (const b of c) {
    if (b.type === 'text' && 'text' in b && typeof b.text === 'string' && !b.text.startsWith('<dados_de_pratica>')) out.push(b.text);
  }
  return out.join('\n');
}
