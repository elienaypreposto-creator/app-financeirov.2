import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * API Route proxy para o Finn.
 *
 * Autentica o usuário via Supabase, repassa a mensagem ao Dify (ou mock),
 * e devolve a resposta para o frontend.
 *
 * Essa camada existe para:
 * - Validar que o usuário está logado
 * - Injetar o user ID nas chamadas ao Dify
 * - Esconder a API Key do Dify do cliente
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, conversationId } = body; // do frontend

    if (!query) {
      return NextResponse.json({ error: 'Query é obrigatório' }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // Aqui repassamos ao Dify (ou usa o mock se DIFY_API_URL não estiver setado)
    const difyUrl = process.env.DIFY_API_URL || '';
    const difyApiKey = process.env.DIFY_API_KEY || '';

    if (!difyUrl) {
      // Modo mock — o client side já faz fallback, mas esse route também pode
      return NextResponse.json({
        answer: `[MOCK] Recebi: "${query}"`,
        conversation_id: `mock-${user.id}`,
      });
    }

    // Modo real — chama o Dify server-side
    const difyPayload = {
      inputs: { user_id: user.id },
      query,
      response_mode: 'streaming', // Dify Agents ONLY support streaming mode
      user: user.id,
      ...(conversationId ? { conversation_id: conversationId } : {}),
    };

    const response = await fetch(`${difyUrl}/v1/chat-messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${difyApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(difyPayload),
    });

    if (!response.ok) {
      console.error(`Dify API error: ${response.status}`, await response.text());
      return NextResponse.json(
        { error: 'Erro ao processar mensagem' },
        { status: 502 },
      );
    }

    // Como o Dify obriga o uso de 'streaming' para Agentes,
    // precisamos ler o stream (Server-Sent Events) e montar a resposta final.
    const reader = response.body?.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullAnswer = '';
    let finalConversationId = conversationId;

    if (reader) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.replace('data: ', '').trim();
              if (!dataStr) continue;

              try {
                const data = JSON.parse(dataStr);
                if (data.event === 'message' || data.event === 'agent_message') {
                  fullAnswer += data.answer || '';
                }
                if (data.conversation_id) {
                  finalConversationId = data.conversation_id;
                }
              } catch (err) {
                // Ignore parse errors on incomplete chunks
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    }

    return NextResponse.json({
      answer: fullAnswer,
      conversation_id: finalConversationId,
    });
  } catch (error) {
    console.error('Finn API error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
