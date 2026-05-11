import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Função para dar parse na data igual ao frontend
const parseTrDate = (dateStr: string) => {
  if (!dateStr) return new Date();
  if (typeof dateStr === 'string' && dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const [d, m, y] = parts.map(Number);
      return new Date(y, m - 1, d);
    }
  }
  return new Date(dateStr);
};

const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const authHeader = request.headers.get('Authorization');

    // Validação de Segurança Simples: Dify deve mandar um Bearer token
    // No Dify, você vai configurar o header: Authorization: Bearer dify-finn-secret
    const secret = process.env.FINN_TOOL_SECRET || 'dify-finn-secret';
    if (!authHeader || authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Acesso negado (Token inválido)' }, { status: 401 });
    }

    if (!userId) {
      return NextResponse.json({ error: 'userId é obrigatório' }, { status: 400 });
    }

    // Para chamadas Server-to-Server, precisamos da Service Role Key para ler os dados do usuário,
    // ou se o seu banco estiver com RLS desativado, a ANON KEY funciona.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Busca todas as transações do usuário
    const { data: txs, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('ignorado', false);

    if (error) {
      console.error("Erro no Supabase:", error);
      return NextResponse.json({ error: 'Erro ao buscar dados no Supabase' }, { status: 500 });
    }

    if (!txs || txs.length === 0) {
      return NextResponse.json({ message: 'Nenhuma transação encontrada para este usuário.' }, { status: 200 });
    }

    // --- LÓGICA COPIADA DO FRONTEND ---
    let fatMensal = 0;
    let despOp = 0;
    
    // Process PJ
    txs.filter(t => (t.tipo_conta || "").toUpperCase().includes('PJ') && t.natureza !== 'Transferência').forEach(t => {
      if (t.natureza === 'Receita') fatMensal += t.valor;
      else if (t.natureza === 'Despesa') despOp += Math.abs(t.valor);
      else if (t.valor > 0) fatMensal += t.valor; 
      else despOp += Math.abs(t.valor); 
    });

    const currentYear = new Date().getFullYear();
    const fatAnualAcumulado = txs.filter(t => 
      (t.tipo_conta || "").toUpperCase().includes('PJ') && 
      (t.natureza === 'Receita' || (t.valor > 0 && !t.natureza)) && 
      t.natureza !== 'Transferência' &&
      parseTrDate(t.data_transacao).getFullYear() === currentYear
    ).reduce((acc, t) => acc + t.valor, 0); 

    const proLabore = fatMensal * 0.28;
    const dasInss = fatMensal * 0.06;
    const lucroIsento = (fatMensal) - proLabore - despOp - dasInss;
    const realLucroIsento = lucroIsento > 0 ? lucroIsento : 0;
    
    const pjStats = {
      faturamentoAnual: fatAnualAcumulado,
      faturamentoMensal: fatMensal,
      despesasOperacionais: despOp,
      lucroIsento: realLucroIsento,
      limiteMeiAtingido: Math.round((fatAnualAcumulado / 81000) * 100) + '%'
    };

    let totalIncomePF = 0;
    let essenciais = 0;
    let lazer = 0;
    let investimentos = 0;

    // Process PF
    txs.filter(t => (t.tipo_conta || "").toUpperCase().includes('PF') && t.natureza !== 'Transferência').forEach(t => {
      if (t.natureza === 'Receita' || (t.valor > 0 && !t.natureza)) {
        totalIncomePF += t.valor;
      } else if (t.natureza === 'Despesa' || (t.valor < 0 && !t.natureza)) {
        const val = Math.abs(t.valor);
        const cat = (t.categoria || "Diversos").toLowerCase();
        
        if (cat.includes("moradia") || cat.includes("saúde") || cat.includes("alimentação") || cat.includes("mercado") || cat.includes("luz") || cat.includes("internet") || cat.includes("essencial")) essenciais += val;
        else if (cat.includes("investimento") || cat.includes("aplicação") || cat.includes("poupança") || cat.includes("corretora") || cat.includes("previdência")) investimentos += val;
        else lazer += val;
      }
    });

    const pfStats = {
      rendaTotal: totalIncomePF,
      gastosEssenciais: essenciais,
      gastosComLazer: lazer,
      investimentos: investimentos,
      sobraLiquidaNoMes: totalIncomePF - essenciais - lazer - investimentos
    };

    // Retorna o JSON amigável para o Dify
    return NextResponse.json({
      status: 'sucesso',
      usuarioId: userId,
      resumo_pj: pjStats,
      resumo_pf: pfStats,
      mensagem_para_a_ia: "Estes são os dados consolidados do usuário. Use esses números para responder perguntas sobre o caixa dele."
    });

  } catch (error) {
    console.error('API Metricas Error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
