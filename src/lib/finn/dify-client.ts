import type { FinnMessage } from './types';

const DIFY_API_URL = process.env.NEXT_PUBLIC_DIFY_API_URL || '';
const DIFY_API_KEY = process.env.DIFY_API_KEY || '';

/**
 * Cliente para interagir com a API do Dify.
 *
 * Status: MOCKADO — retorna respostas fixas enquanto o Dify não está configurado.
 *
 * Quando o Dify estiver rodando, descomente a chamada fetch no sendChatMessage.
 */
export class DifyClient {
  static readonly DEFAULT_TIMEOUT_MS = 30_000;

  static async sendChatMessage(
    query: string,
    userId: string,
    conversationId: string | null = null,
    _onChunk?: (chunk: string) => void,
  ): Promise<{ answer: string; conversation_id: string }> {
    // === MODO MOCK (remover quando Dify estiver ativo) ===
    if (!DIFY_API_URL) {
      await new Promise((r) => setTimeout(r, 500)); // simula delay
      return this._mockResponse(query);
    }

    // === MODO REAL — descomentar quando Dify estiver configurado ===
    /*
    const response = await fetch(`${DIFY_API_URL}/v1/chat-messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DIFY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: { user_id: userId },
        query,
        response_mode: 'streaming', // ou 'blocking' se não usar SSE
        user: userId,
        conversation_id: conversationId || undefined,
      }),
      signal: AbortSignal.timeout(this.DEFAULT_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Dify API error: ${response.status}`);
    }

    // Streaming: parse Server-Sent Events
    const reader = response.body?.getReader();
    let conversationId = '';
    let answer = '';

    if (reader) {
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });

        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data:')) continue;
          const data = JSON.parse(line.slice(5));
          conversationId = data.conversation_id || conversationId;
          answer += data.answer || '';
          if (_onChunk) _onChunk(data.answer || '');
        }
      }
    }

    return { answer, conversation_id: conversationId };
    */

    return this._mockResponse(query);
  }

  private static _mockResponse(query: string) {
    const lower = query.toLowerCase();

    if (lower.includes('saldo') || lower.includes('balance')) {
      return Promise.resolve({
        answer: 'Seu saldo atual é de R$ 1.234,56. (Dados simulados — conecte o Dify para dados reais.)',
        conversation_id: 'mock-session',
      });
    }

    if (lower.includes('gasto') || lower.includes('despesa') || lower.includes('mercado')) {
      return Promise.resolve({
        answer: 'Você gastou R$ 450,00 com supermercado este mês. (Dados simulados — conecte o Dify para dados reais.)',
        conversation_id: 'mock-session',
      });
    }

    if (lower.includes('imposto') || lower.includes('ir') || lower.includes('tributo')) {
      return Promise.resolve({
        answer: 'Com base nos seus rendimentos, o imposto estimado é de R$ 185,18. Consulte um contador para precisão.',
        conversation_id: 'mock-session',
      });
    }

    if (lower.includes('olá') || lower.includes('oi') || lower.includes('hey') || lower.includes('hello')) {
      return Promise.resolve({
        answer: 'Olá! Sou o Finn, seu assistente financeiro. Pergunte sobre saldo, gastos, impostos ou qualquer dúvida financeira.',
        conversation_id: 'mock-session',
      });
    }

    return Promise.resolve({
      answer: 'Entendi! Essa funcionalidade estará disponível quando o Finn estiver conectado ao Dify. Posso ajudar com saldo e gastos fictícios por enquanto.',
      conversation_id: 'mock-session',
    });
  }
}
