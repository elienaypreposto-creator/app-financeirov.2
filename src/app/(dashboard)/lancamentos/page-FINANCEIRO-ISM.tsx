"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, Search, Download, Trash, RefreshCw, Calendar, ArrowLeft, Ban, PencilLine, AlertCircle, Loader2, CheckCircle2, XCircle, ChevronDown } from "lucide-react";
import { Select, SelectContent, SelectGroup, SelectLabel, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

export default function LancamentosPage() {
  const [view, setView] = useState<"conciliacao" | "importacao">("conciliacao");
  const [selectedGroup, setSelectedGroup] = useState<any | null>(null);

  // Supabase Auth States
  const [userId, setUserId] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id || null));
  }, [supabase]);

  if (view === "importacao") {
    return <ImportacaoView 
      initialGroup={selectedGroup} 
      onSave={() => { setView("conciliacao"); setSelectedGroup(null); }} 
      onBack={() => { setView("conciliacao"); setSelectedGroup(null); }} 
      userId={userId} 
    />;
  }

  return <ConciliacaoView 
    onImportar={() => setView("importacao")} 
    onEditGroup={(group) => { setSelectedGroup(group); setView("importacao"); }}
    userId={userId} 
  />;
}

// ----------------------------------------------
// Helper: Bank Logo
// ----------------------------------------------
const BankLogo = ({ bank }: { bank: string }) => {
  const map: Record<string, string> = {
    'Santander': '/logos/santander.png',
    'Inter': '/logos/inter.png',
    'Mercado Pago': '/logos/mercadopago.png',
    'Caixa': '/logos/caixa.png',
    'Banco do Brasil': '/logos/bb.png',
    'Itaú': '/logos/itau.png',
    'Bradesco': '/logos/bradesco.png',
    'Nubank': '/logos/nubank.png'
  };
  const src = map[bank] || '/logos/default.png';
  return <img src={src} alt={bank} className="w-5 h-5 rounded-sm object-contain bg-white" onError={(e) => e.currentTarget.style.display = 'none'} />;
}

// ==============================================
// VIEW: Arquivos de Conciliação (Tabela Inicial)
// ==============================================
function ConciliacaoView({ onImportar, onEditGroup, userId }: { onImportar: () => void, onEditGroup: (group: any) => void, userId: string | null }) {
  const [dbGroups, setDbGroups] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filtros
  const [filterStatus, setFilterStatus] = useState("Todos");
  const [filterConta, setFilterConta] = useState("Todas");
  const [search, setSearch] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const loadData = async () => {
    setIsLoading(true);
    const supabase = createClient();
    
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) {
      setIsLoading(false);
      return; 
    }

    const { data: txs, error } = await supabase.from('transactions').select('*').eq('user_id', authData.user.id).order('created_at', { ascending: false });
    
    if (txs && !error) {
      const groupsMap: Record<string, any> = {};
      
      txs.forEach((t: any) => {
        const dateKey = t.created_at.split('T')[0];
        const key = `${t.banco}|${t.tipo_conta}|${dateKey}`;
        
        if (!groupsMap[key]) {
          groupsMap[key] = {
            id: key,
            date: new Date(t.created_at).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            bank: t.banco,
            tipo: `Conta ${t.tipo_conta}`,
            minDateStr: t.data_transacao,
            maxDateStr: t.data_transacao,
            conc: 0, ign: 0, pend: 0, total: 0,
            status: "Pendente",
          };
        } else {
          const parse = (s: string) => {
            if (!s) return 0;
            const parts = s.includes('/') ? s.split('/') : s.split('-');
            if (parts.length < 3) return 0;
            const [d, m, y] = parts[0].length === 4 ? [parts[2], parts[1], parts[0]] : [parts[0], parts[1], parts[2]];
            return new Date(Number(y), Number(m) - 1, Number(d)).getTime();
          };
          const current = parse(t.data_transacao);
          const min = parse(groupsMap[key].minDateStr);
          const max = parse(groupsMap[key].maxDateStr);
          if (current > 0 && (min === 0 || current < min)) groupsMap[key].minDateStr = t.data_transacao;
          if (current > 0 && (max === 0 || current > max)) groupsMap[key].maxDateStr = t.data_transacao;
        }
        
        groupsMap[key].total++;
        if (t.ignorado) groupsMap[key].ign++;
        else if (t.status === 'Conciliado') groupsMap[key].conc++;
        else groupsMap[key].pend++;
      });

      const processed = Object.values(groupsMap).map((g: any) => {
        if (g.pend === 0 && g.conc > 0) g.status = "Conciliado";
        else if (g.conc > 0 && g.pend > 0) g.status = "Parcial";
        
        // Formata o período com base nas datas das transações (mínimo e máximo encontrados)
        if (g.minDateStr && g.maxDateStr) {
           g.period = g.minDateStr === g.maxDateStr ? g.minDateStr : `De ${g.minDateStr} à ${g.maxDateStr}`;
        } else {
           g.period = "Sem período";
        }
        
        return g;
      });

      setDbGroups(processed);
    }
    setIsLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleDeleteGroup = async (group: any) => {
    if (!window.confirm(`Tem certeza que deseja excluir as transações importadas do ${group.bank}?`)) return;
    const supabase = createClient();
    const dateKey = group.id.split('|').pop();
    
    const { error } = await supabase.from('transactions').delete()
      .eq('banco', group.bank)
      .eq('tipo_conta', group.tipo.replace('Conta ', ''))
      .gte('created_at', `${dateKey}T00:00:00`)
      .lte('created_at', `${dateKey}T23:59:59.999Z`);
    
    if (error) {
      alert("Erro ao excluir do banco de dados: " + error.message);
    } else {
      loadData();
    }
  };

  const filteredGroups = dbGroups.filter(g => {
    const matchStatus = filterStatus === "Todos" || g.status.toLowerCase() === filterStatus.toLowerCase();
    const matchConta = filterConta === "Todas" || g.tipo.includes(filterConta);
    const matchSearch = g.bank.toLowerCase().includes(search.toLowerCase());
    
    const parts = g.date.split('/');
    const gMonth = parseInt(parts[1]) - 1;
    const gYear = parseInt(parts[2].split(' ')[0]);
    const matchDate = gMonth === selectedMonth && gYear === selectedYear;

    return matchStatus && matchConta && matchSearch && matchDate;
  });

  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto pb-10">
      <div className="bg-white rounded-xl p-8 border border-slate-200 flex justify-between items-center text-slate-900 shadow-md border-b-4 border-b-primary">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Arquivos de conciliação / Lançamentos</h1>
          <p className="text-slate-500 text-sm font-medium mt-1">Gerencie e confira suas importações bancárias</p>
        </div>
        <Button onClick={onImportar} className="bg-primary hover:bg-primary/90 font-bold px-8 h-12 rounded-xl shadow-lg shadow-primary/20 text-white">Importar Extrato</Button>
      </div>

      <div className="flex flex-wrap items-center gap-6 text-sm mt-2 px-1">
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Status</span>
          <Select value={filterStatus} onValueChange={(v: string | null) => setFilterStatus(v || "Todos")}>
            <SelectTrigger className="w-[160px] bg-white border-slate-200 h-10 font-bold text-slate-700 shadow-sm rounded-lg">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-white border-slate-200 text-slate-700">
              <SelectItem value="Todos">Todos</SelectItem>
              <SelectItem value="Pendente">Pendentes</SelectItem>
              <SelectItem value="Parcial">Parciais</SelectItem>
              <SelectItem value="Conciliado">Conciliados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Tipo de Conta</span>
          <Select value={filterConta} onValueChange={(v: string | null) => setFilterConta(v || "Todas")}>
            <SelectTrigger className="w-[160px] bg-white border-slate-200 h-10 font-bold text-slate-700 shadow-sm rounded-lg">
              <SelectValue placeholder="Conta" />
            </SelectTrigger>
            <SelectContent className="bg-white border-slate-200 text-slate-700">
              <SelectItem value="Todas">Todas</SelectItem>
              <SelectItem value="PJ">PJ</SelectItem>
              <SelectItem value="PF">PF</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Mês</span>
          <Select value={selectedMonth.toString()} onValueChange={(v: string | null) => setSelectedMonth(parseInt(v || "0"))}>
             <SelectTrigger className="w-[160px] bg-white border-slate-200 h-10 font-bold text-slate-700 shadow-sm rounded-lg">
               <SelectValue>
                 {monthNames[selectedMonth]}
               </SelectValue>
             </SelectTrigger>
             <SelectContent className="bg-white border-slate-200 text-slate-700 max-h-[300px]">
               {monthNames.map((m, i) => (
                 <SelectItem key={i} value={i.toString()}>{m}</SelectItem>
               ))}
             </SelectContent>
           </Select>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Ano</span>
          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v || "2026"))}>
            <SelectTrigger className="w-[110px] bg-white border-slate-200 h-10 font-bold text-slate-700 shadow-sm rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white border-slate-200 text-slate-700">
              <SelectItem value="2026">2026</SelectItem>
              <SelectItem value="2025">2025</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-end mb-0.5 ml-1">
          <button onClick={loadData} className="px-6 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-primary shadow-sm h-10 transition-all flex items-center gap-2 font-bold text-xs uppercase tracking-wider"><RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Atualizar</button>
        </div>
        
        <div className="relative w-64 ml-auto flex flex-col gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Pesquisa</span>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-4 top-3 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 h-10 text-slate-900 focus:border-primary focus:outline-none font-semibold text-xs shadow-sm" placeholder="Pesquisar Banco..." />
          </div>
        </div>
      </div>

      <div className="border border-slate-200 rounded-2xl overflow-hidden mt-1 bg-white shadow-xl">
        <table className="w-full text-sm text-left text-slate-600">
          <thead className="text-[11px] text-slate-400 uppercase bg-slate-50 border-b border-slate-100 tracking-wider font-extrabold">
            <tr>
              <th className="px-6 py-5">Status</th>
              <th className="px-6 py-5">Ação (Data)</th>
              <th className="px-6 py-5">Banco Origem</th>
              <th className="px-6 py-5">Tipo Conta</th>
              <th className="px-6 py-5">Período</th>
              <th className="px-4 py-5 text-center">Conciliados (OK)</th>
              <th className="px-4 py-5 text-center">Lanç. Pendentes</th>
              <th className="px-6 py-5 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredGroups.map((group) => (
              <tr key={group.id} className="border-b border-slate-50 hover:bg-primary/[0.02] transition-colors group">
                <td className="px-6 py-5 whitespace-nowrap">
                  {group.status === "Conciliado" && <Badge className="bg-emerald-100 text-emerald-700 tracking-widest text-[10px] rounded-lg font-black border-emerald-200 shadow-none">CONCILIADO</Badge>}
                  {group.status === "Parcial" && <Badge className="bg-amber-100 text-amber-700 tracking-widest text-[10px] rounded-lg font-black border-amber-200 shadow-none">PARCIAL</Badge>}
                  {group.status === "Pendente" && <Badge className="bg-slate-100 text-slate-500 tracking-widest text-[10px] rounded-lg font-black border-slate-200 shadow-none">PENDENTE</Badge>}
                </td>
                <td className="px-6 py-3 font-bold text-slate-400 font-mono text-xs">{group.date}</td>
                <td className="px-6 py-3 flex items-center gap-4">
                   <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center p-1.5 transition-transform group-hover:scale-110">
                     <BankLogo bank={group.bank} />
                   </div>
                   <div className="font-extrabold text-slate-800 text-sm tracking-tight">{group.bank}</div>
                </td>
                <td className="px-6 py-3 text-[10px] font-black text-primary tracking-widest">
                  CONTA {group.tipo.replace('Conta ', '').toUpperCase()}
                </td>
                <td className="px-6 py-3 font-mono text-[10px] font-bold text-slate-500 whitespace-nowrap">
                  {group.period}
                </td>
                <td className="px-4 py-3 text-center font-mono">
                   <span className="text-emerald-600 font-extrabold text-md">{group.conc}</span> <span className="text-slate-300 text-[10px] font-bold">/ {group.total}</span>
                </td>
                <td className="px-4 py-3 text-center">
                   {group.pend > 0 ? <span className="bg-rose-50 text-rose-600 border border-rose-100 px-4 py-1.5 rounded-full font-black text-[10px] shadow-sm uppercase">{group.pend} pendentes</span> : <span className="text-slate-300">-</span>}
                </td>
                <td className="px-6 py-3">
                  <div className="flex justify-center gap-4 text-slate-300">
                     <button title="Continuar Classificando" className="bg-slate-50 p-2.5 rounded-xl cursor-pointer hover:bg-primary hover:text-white transition-all shadow-sm border border-slate-100" onClick={() => onEditGroup(group)}><PencilLine className="w-4 h-4" /></button>
                     <button title="Excluir Extrato Inteiro" className="bg-slate-50 p-2.5 rounded-xl cursor-pointer hover:bg-rose-500 hover:text-white transition-all shadow-sm border border-slate-100" onClick={() => handleDeleteGroup(group)}><Trash className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {isLoading && dbGroups.length === 0 && (
           <div className="flex items-center justify-center p-20">
             <Loader2 className="w-10 h-10 animate-spin text-primary opacity-50" />
           </div>
        )}
        {!isLoading && filteredGroups.length === 0 && (
           <div className="flex flex-col items-center justify-center p-20 mb-2 space-y-4">
             <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
               <Calendar className="w-8 h-8" />
             </div>
             <p className="text-slate-400 text-sm font-bold tracking-tight">Nenhuma importação encontrada neste período.</p>
           </div>
        )}
      </div>
    </div>
  );
}

// ==============================================
// VIEW: Importação e Classificação de Transações
// ==============================================

export type Transaction = {
  id: string;
  date: string;
  desc: string;
  value: number; 
  bank: string;
  cat?: string;
  ignored: boolean;
  has_invoice?: boolean;
  invoice_number?: string;
};

type ParsedStatement = {
  transactions: Transaction[];
  period?: string;
};

function smartParseCSV(csvText: string, bankName: string): ParsedStatement {
  const separator = csvText.includes(';') ? ';' : ',';
  let lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
  const results: Transaction[] = [];
  let detectedPeriod = "";

  // Tenta achar período no cabeçalho (ex: Período: 01/02/2026 a 28/02/2026)
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const line = lines[i].toUpperCase();
    if (line.includes('PERÍODO') || line.includes('PERIODO') || line.includes('DATA INICIAL')) {
      const match = lines[i].match(/(\d{2}\/\d{2}\/\d{4})/g);
      if (match && match.length >= 2) {
        detectedPeriod = `De ${match[0]} à ${match[1]}`;
      } else if (match && match.length === 1) {
        detectedPeriod = match[0];
      }
    }
  }
  
  // Detecção de Mercado Pago
  let mpHeaderIndex = -1;
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    if (lines[i].includes('RELEASE_DATE') && lines[i].includes('TRANSACTION_NET_AMOUNT')) {
      mpHeaderIndex = i;
      break;
    }
  }

  if (mpHeaderIndex !== -1) {
    const headers = lines[mpHeaderIndex].split(separator).map(h => h.replace(/"/g, '').trim().toUpperCase());
    const dataLines = lines.slice(mpHeaderIndex + 1);
    
    const dateIdx = headers.indexOf('RELEASE_DATE');
    const descIdx = headers.indexOf('TRANSACTION_TYPE');
    const valIdx = headers.indexOf('TRANSACTION_NET_AMOUNT');

    dataLines.forEach(line => {
      const cols = line.split(separator).map(c => c.replace(/"/g, '').trim());
      if (cols.length <= Math.max(dateIdx, descIdx, valIdx)) return;
      const tDate = cols[dateIdx];
      const tDesc = cols[descIdx];
      let rawVal = cols[valIdx];
      let cleanNum = rawVal.replace(/\./g, '').replace(',', '.');
      let tVal = parseFloat(cleanNum);
      if (tDate && tDesc && !isNaN(tVal) && tVal !== 0) {
        results.push({ id: Math.random().toString(36).substring(2, 9), date: tDate, desc: tDesc, value: tVal, bank: bankName, ignored: false });
      }
    });
    return { transactions: results, period: detectedPeriod };
  }

  // Fallback Genérico
  lines.forEach(line => {
    const cols = line.split(separator).map(c => c.replace(/"/g, '').trim());
    if (cols.length < 3) return;
    let tDate = "", tDesc = "", tVal = 0;
    for (let col of cols) {
       if (!tDate && (col.match(/^\d{2}\/\d{2}\/\d{4}$/) || col.match(/^\d{4}-\d{2}-\d{2}$/))) tDate = col;
       else if (tVal === 0 && col.match(/^-?[\d.,]+$/) && col.length < 15 && /[1-9]/.test(col)) {
         let cleanNum = col.replace(/\./g, '').replace(',', '.');
         let num = parseFloat(cleanNum);
         if (!isNaN(num)) tVal = num;
       } 
       else if (!tDesc && col.length > 5 && isNaN(Number(col.replace(',', '.')))) tDesc = col.substring(0, 100);
    }
    if (tDesc && tVal !== 0) {
      results.push({ id: Math.random().toString(36).substring(2, 9), date: tDate || new Date().toLocaleDateString('pt-BR'), desc: tDesc, value: tVal, bank: bankName, ignored: false });
    }
  });
  return { transactions: results, period: detectedPeriod };
}

function smartParseOFX(ofxText: string, bankName: string): ParsedStatement {
  const results: Transaction[] = [];
  let detectedPeriod = "";

  // Extrai DTSTART e DTEND do OFX
  const dtStart = ofxText.match(/<DTSTART>(\d{4})(\d{2})(\d{2})/);
  const dtEnd = ofxText.match(/<DTEND>(\d{4})(\d{2})(\d{2})/);
  if (dtStart && dtEnd) {
    detectedPeriod = `De ${dtStart[3]}/${dtStart[2]}/${dtStart[1]} à ${dtEnd[3]}/${dtEnd[2]}/${dtEnd[1]}`;
  }

  const blocks = ofxText.split('<STMTTRN>');
  blocks.shift();
  blocks.forEach(block => {
    const amtMatch = block.match(/<TRNAMT>([-?\d.,]+)/);
    let tVal = 0;
    if (amtMatch) {
      let rawVal = amtMatch[1];
      let cleanVal = rawVal.replace(',', '.'); 
      tVal = parseFloat(cleanVal);
    }
    const dtMatch = block.match(/<DTPOSTED>(\d{4})(\d{2})(\d{2})/);
    let tDate = dtMatch ? `${dtMatch[3]}/${dtMatch[2]}/${dtMatch[1]}` : "";
    let memoMatch = block.match(/<MEMO>([^<\r\n]+)/);
    let nameMatch = block.match(/<NAME>([^<\r\n]+)/);
    let tDesc = (memoMatch ? memoMatch[1] : (nameMatch ? nameMatch[1] : "Transação OFX")).trim();
    tDesc = tDesc.replace(/&amp;/g, '&').substring(0, 100);

    if (tVal !== 0 && tDate) {
       results.push({ id: Math.random().toString(36).substring(2, 9), date: tDate, desc: tDesc, value: tVal, bank: bankName, ignored: false });
    }
  });
  return { transactions: results, period: detectedPeriod };
}

function ImportacaoView({ onSave, onBack, userId, initialGroup }: { onSave: () => void, onBack: () => void, userId: string | null, initialGroup?: any }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  
  const [isNewCategoryModalOpen, setNewCategoryModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatType, setNewCatType] = useState("saida");
  const [isSaving, setIsSaving] = useState(false);
  const [registeredAccounts, setRegisteredAccounts] = useState<any[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedBank, setSelectedBank] = useState("");
  const [selectedConta, setSelectedConta] = useState("PJ");

  useEffect(() => {
    async function fetchAccounts() {
      setLoadingAccounts(true);
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        const { data, error } = await supabase.from('bank_accounts').select('*').eq('user_id', authData.user.id);
        if (data && !error && data.length > 0) {
          setRegisteredAccounts(data);
          if (!selectedBank) {
            setSelectedBank(data[0].name);
            setSelectedConta(data[0].type || "PJ");
          }
        }
      }
      setLoadingAccounts(false);
    }
    fetchAccounts();
  }, [supabase]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (transactions.length > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [transactions]);

  const [categorias, setCategorias] = useState({
    entradas: ["Aportes", "Cashback", "Empréstimos", "Rendimentos", "Serviços Prestados", "Vendas"].sort(),
    saidas: ["Aluguel", "Despesas Pessoais", "Equipamentos", "Impostos", "Lazer", "Marketing", "Taxas Bancárias"].sort()
  });

  const loadCategories = async () => {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return;
    const { data, error } = await supabase.from('categories').select('*').eq('user_id', authData.user.id);
    if (data && !error && data.length > 0) {
      setCategorias({
        entradas: data.filter((c: any) => c.type === 'entrada').map((c: any) => c.name).sort(),
        saidas: data.filter((c: any) => c.type === 'saida').map((c: any) => c.name).sort()
      });
    }
  };

  useEffect(() => { loadCategories(); }, []);

  const [statementPeriod, setStatementPeriod] = useState("");

  useEffect(() => {
    if (initialGroup) {
      const loadInitial = async () => {
        const { data } = await supabase.from('transactions')
          .select('*')
          .eq('user_id', userId)
          .eq('banco', initialGroup.bank)
          .eq('tipo_conta', initialGroup.tipo.replace('Conta ', ''))
          .order('created_at', { ascending: false });
        
        if (data && data.length > 0) {
          const dateKey = initialGroup.id.split('|').pop();
          const filtered = data.filter(t => t.created_at.startsWith(dateKey));
          setTransactions(filtered.map((t: any) => {
             let cleanDesc = t.descricao;
             let period = "";
             if (t.descricao && t.descricao.startsWith('[')) {
                const match = t.descricao.match(/^\[(.*?)\]\s?(.*)/);
                if (match) {
                  period = match[1];
                  cleanDesc = match[2];
                }
             }
             if (period) setStatementPeriod(period);

             return {
                id: t.id, date: t.data_transacao, desc: cleanDesc, value: Number(t.valor), bank: t.banco, cat: t.categoria, ignored: t.ignorado,
                has_invoice: t.has_invoice, invoice_number: t.invoice_number
             };
          }));
          setSelectedBank(initialGroup.bank);
          setSelectedConta(initialGroup.tipo.replace('Conta ', ''));
        }
      };
      loadInitial();
    }
  }, [initialGroup, userId, supabase]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (registeredAccounts.length === 0) return alert("Cadastre uma conta bancária primeiro.");
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      let parsed = file.name.toLowerCase().endsWith('.ofx') ? smartParseOFX(text, selectedBank) : smartParseCSV(text, selectedBank);
      if (parsed.transactions.length > 0) {
        setTransactions(parsed.transactions);
        if (parsed.period) setStatementPeriod(parsed.period);
      }
      else alert("Arquivo inválido.");
    } catch(err) { alert("Erro ao ler arquivo."); }
  };

  const handleCategoryChange = (val: string | null, id: string) => {
    if (!val) return;
    if (val === "NEW_CATEGORY") { setNewCategoryModalOpen(true); return; }
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, cat: val } : t));
  };

  const handleNFChange = (val: boolean, id: string) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, has_invoice: val, invoice_number: val ? t.invoice_number : undefined } : t));
  };

  const handleNFNumberChange = (num: string, id: string) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, invoice_number: num } : t));
  };

  const handleSaveNewCategory = async () => {
    if (!newCatName.trim()) return;
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return;
    const { error } = await supabase.from('categories').insert([{ user_id: authData.user.id, name: newCatName, type: newCatType }]);
    if (!error) loadCategories();
    setNewCategoryModalOpen(false); setNewCatName("");
  };

  const submitToDatabase = async () => {
    if (transactions.length === 0) return onSave();
    setIsSaving(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const currentUserId = sessionData.session?.user?.id;
    if (!currentUserId) { setIsSaving(false); return alert("Sessão expirada."); }

    const { data: existing } = await supabase.from('transactions').select('data_transacao, valor, descricao').eq('user_id', currentUserId).eq('banco', selectedBank);
    const toSave = transactions.filter(t => {
      if (t.id && t.id.length > 20 && t.id.includes('-')) return true;
      const isDuplicate = existing?.some(ex => ex.data_transacao === t.date && Number(ex.valor) === t.value && ex.descricao === t.desc);
      return !isDuplicate;
    });

    if (toSave.length === 0 && transactions.length > 0) { setIsSaving(false); return alert("Transações já importadas."); }

    const payload = toSave.map(t => {
      const isConc = (!!t.cat || t.ignored);
      // Persistência do período no campo descrição via prefixo [DD/MM-DD/MM]
      const finalDesc = statementPeriod ? `[${statementPeriod}] ${t.desc}` : t.desc;
      
      const item: any = {
        user_id: currentUserId, banco: selectedBank, tipo_conta: selectedConta, data_transacao: t.date, descricao: finalDesc || "Sem Descrição",
        valor: t.value, tipo: t.value >= 0 ? 'entrada' : 'saida', categoria: t.cat || null, ignorado: t.ignored,
        status: isConc ? 'Conciliado' : 'Pendente',
        has_invoice: t.has_invoice ?? null,
        invoice_number: t.invoice_number || null
      };
      if (t.id && t.id.length > 20 && t.id.includes('-')) item.id = t.id;
      return item;
    });

    const { error } = await supabase.from('transactions').upsert(payload, { onConflict: 'id' });
    setIsSaving(false);
    if (error) alert("Erro Supabase: " + error.message);
    else onSave();
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  const allReady = transactions.length > 0 && transactions.every(t => !!t.cat || t.ignored);

  return (
    <div className="flex flex-col gap-6 max-w-7xl w-full mx-auto pb-20">
      <input type="file" ref={fileInputRef} className="hidden" accept=".csv,.ofx" onChange={handleFileChange} />
      
      <Dialog open={isNewCategoryModalOpen} onOpenChange={setNewCategoryModalOpen}>
        <DialogContent className="sm:max-w-md bg-white border-slate-200 text-slate-900 rounded-3xl">
          <DialogHeader><DialogTitle className="font-extrabold text-slate-900">Criar Nova Categoria</DialogTitle></DialogHeader>
          <div className="space-y-6 pt-4">
             <div className="space-y-2"><label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Nome da Categoria</label><input type="text" value={newCatName} onChange={e=>setNewCatName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:border-primary outline-none font-semibold shadow-inner" placeholder="Ex: Assinaturas Digitais" /></div>
             <div className="flex gap-8 px-1">
               <label className="flex items-center gap-3 cursor-pointer text-sm font-extrabold text-slate-700"><input type="radio" checked={newCatType === "entrada"} onChange={()=>setNewCatType("entrada")} className="accent-emerald-500 w-4 h-4" /> Entrada</label>
               <label className="flex items-center gap-3 cursor-pointer text-sm font-extrabold text-slate-700"><input type="radio" checked={newCatType === "saida"} onChange={()=>setNewCatType("saida")} className="accent-rose-500 w-4 h-4" /> Saída</label>
             </div>
             <Button onClick={handleSaveNewCategory} className="w-full font-bold h-12 rounded-xl shadow-lg shadow-primary/20 bg-primary text-white hover:bg-primary/90">Salvar e Aplicar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex items-center gap-6">
        <Button variant="ghost" size="icon" onClick={() => (transactions.length > 0 && confirm("Sair sem salvar?")) ? onBack() : transactions.length === 0 ? onBack() : null} className="text-slate-400 hover:text-primary bg-white border border-slate-200 rounded-xl w-12 h-12 shadow-sm">
           <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight leading-none">Classificação de extrato importado</h1>
          <p className="text-slate-500 text-sm font-medium">Leitura inteligente e classificação assistida</p>
        </div>
      </div>

      <Card className="bg-white border-slate-200 shadow-xl relative overflow-visible rounded-2xl border-l-4 border-l-primary/60">
        <CardContent className="pt-8 pb-8 flex flex-col md:flex-row items-center justify-between gap-10 z-10 relative px-8">
           <div className="flex items-center gap-6 cursor-pointer hover:bg-slate-50 transition-all flex-1 bg-slate-50/50 p-6 border border-dashed border-primary/30 rounded-2xl group shadow-inner" onClick={()=>fileInputRef.current?.click()}>
             <div className="p-4 bg-primary/10 text-primary rounded-2xl shadow-sm transition-transform group-hover:scale-110"><Upload className="w-8 h-8" /></div>
             <div><h2 className="font-black text-slate-800 text-xl tracking-tight">Upload do Arquivo</h2><p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1 opacity-70">Arraste ou clique para enviar CSV/OFX</p></div>
           </div>
           
           <div className="flex gap-8 items-center">
             <div className="flex flex-col gap-2">
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Conta de Destino</span>
               <Select value={selectedBank} onValueChange={(v) => { setSelectedBank(v || ""); const acc = registeredAccounts.find(a=>a.name===v); if(acc) setSelectedConta(acc.type||"PJ"); }}>
                 <SelectTrigger className="w-[220px] bg-white border-slate-200 text-slate-700 h-11 font-black shadow-sm rounded-xl"><SelectValue placeholder="Escolha a Conta" /></SelectTrigger>
                 <SelectContent className="bg-white border-slate-200 text-slate-700">{registeredAccounts.map(acc => <SelectItem key={acc.id} value={acc.name} className="font-bold">{acc.name} ({acc.account})</SelectItem>)}</SelectContent>
               </Select>
             </div>
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Identificação</span>
               <div className="h-11 px-6 flex items-center justify-center bg-primary/5 text-primary border border-primary/20 rounded-xl font-black text-sm tracking-[0.2em] shadow-sm">{selectedConta.toUpperCase()}</div>
             </div>
           </div>
        </CardContent>
      </Card>

      <div className="mt-2">
         {transactions.length > 0 && <div className="border border-slate-200 rounded-3xl overflow-hidden bg-white flex flex-col shadow-2xl">
              <table className="w-full text-sm text-left text-slate-600">
                <thead className="text-[10px] text-slate-400 font-black uppercase tracking-widest bg-slate-50/50 border-b border-slate-100">
                   <tr>
                     <th className="px-6 py-4 w-12 text-center">OK</th>
                     <th className="px-6 py-4">Data</th>
                     <th className="px-6 py-4">Histórico / Descrição</th>
                     <th className="px-6 py-4 text-right">Valor</th>
                     <th className="px-6 py-4 text-center">Nota Fiscal (PJ)</th>
                     <th className="px-6 py-4">Categoria</th>
                     <th className="px-6 py-4 text-center">Ações</th>
                   </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => {
                    const isChecked = !!t.cat || t.ignored;
                    const isPJRevenue = selectedConta === "PJ" && t.value > 0 && (t.cat === "Vendas" || t.cat === "Serviços Prestados" || t.cat === "Serviços");
                    
                    return (
                    <tr key={t.id} className={`border-b border-slate-50 transition-colors ${t.ignored ? 'opacity-30 grayscale bg-slate-50' : 'hover:bg-primary/[0.01]'} ${isChecked && !t.ignored ? 'bg-primary/[0.03]' : ''}`}>
                      <td className="px-6 py-4 text-center"><input type="checkbox" checked={isChecked} readOnly className="accent-primary w-4 h-4 cursor-not-allowed opacity-60" /></td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-400 font-mono text-[11px] font-bold">{t.date}</td>
                      <td className="px-6 py-4 font-bold text-slate-700 max-w-[220px] truncate tracking-tight" title={t.desc}>{t.desc}</td>
                      <td className={`px-6 py-4 font-black whitespace-nowrap text-right text-md ${t.value > 0 ? "text-emerald-500" : "text-rose-500"}`}>{formatCurrency(t.value)}</td>
                      
                      <td className="px-6 py-4">
                         {isPJRevenue ? (
                            <div className="flex flex-col gap-2 items-center">
                               <div className="flex items-center gap-3">
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Possui NF?</span>
                                  <button onClick={()=>handleNFChange(true, t.id)} className={`p-1.5 rounded-lg transition-all ${t.has_invoice === true ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}><CheckCircle2 className="w-3.5 h-3.5" /></button>
                                  <button onClick={()=>handleNFChange(false, t.id)} className={`p-1.5 rounded-lg transition-all ${t.has_invoice === false ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}><XCircle className="w-3.5 h-3.5" /></button>
                               </div>
                               {t.has_invoice && (
                                  <Input value={t.invoice_number || ""} onChange={e=>handleNFNumberChange(e.target.value, t.id)} className="h-8 text-[11px] bg-slate-50 border-slate-200 w-28 text-center font-black rounded-lg focus-visible:ring-primary shadow-inner" placeholder="Nº da Nota" />
                               )}
                               {t.has_invoice === false && (
                                  <span className="text-[9px] text-rose-600 font-black animate-pulse flex items-center gap-1"><AlertCircle className="w-3 h-3" /> NOTA PENDENTE</span>
                               )}
                            </div>
                         ) : <span className="text-slate-300 block text-center font-bold">●</span>}
                      </td>

                      <td className="px-6 py-4">
                         <Select value={t.cat || ""} onValueChange={(val) => handleCategoryChange(val, t.id)} disabled={isChecked && !t.ignored}>
                           <SelectTrigger className={`w-[220px] h-10 bg-white border-slate-200 font-black shadow-sm rounded-xl ${t.value > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                             <SelectValue placeholder="Classificar..." />
                           </SelectTrigger>
                           <SelectContent className="max-h-[300px] bg-white border-slate-200 text-slate-700 rounded-xl shadow-2xl">
                             {t.value >= 0 ? (
                                <SelectGroup>
                                  <SelectLabel className="text-emerald-500 tracking-widest uppercase text-[10px] font-black py-3">Entradas</SelectLabel>
                                  {categorias.entradas.map(c => <SelectItem key={c} value={c} className="font-bold py-2">{c}</SelectItem>)}
                                </SelectGroup>
                             ) : (
                                <SelectGroup>
                                  <SelectLabel className="text-rose-500 tracking-widest uppercase text-[10px] font-black py-3">Saídas</SelectLabel>
                                  {categorias.saidas.map(c => <SelectItem key={c} value={c} className="font-bold py-2">{c}</SelectItem>)}
                                </SelectGroup>
                             )}
                             <div className="h-px bg-slate-100 my-2" />
                             <SelectItem value="NEW_CATEGORY" className="text-primary font-black py-3">➕ Criar Nova...</SelectItem>
                           </SelectContent>
                         </Select>
                      </td>
                      <td className="px-6 py-4">
                         <div className="flex justify-center gap-5 text-slate-300">
                           <PencilLine className="w-4 h-4 cursor-pointer hover:text-primary transition-all hover:scale-110" onClick={() => setTransactions(prev=>prev.map(tr=>tr.id===t.id?{...tr, cat:undefined}:tr))} />
                           <Ban className={`w-4 h-4 cursor-pointer transition-all hover:scale-110 ${t.ignored ? 'text-rose-500 pb-0.5' : 'hover:text-rose-500'}`} onClick={() => setTransactions(prev=>prev.map(tr=>tr.id===t.id?{...tr, ignored:!tr.ignored}:tr))} />
                         </div>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
           </div>}
         
         {transactions.length > 0 && (
            <div className="flex justify-end mt-10">
               <Button onClick={submitToDatabase} disabled={isSaving} className={`${allReady ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-primary shadow-primary/20'} text-white font-black px-12 h-16 text-xl shadow-2xl rounded-2xl transition-all hover:-translate-y-1 flex gap-4 active:scale-95 border-0`}>
                 {isSaving && <Loader2 className="w-6 h-6 animate-spin" />}
                 {allReady ? '✔ Concluir e Salvar Tudo' : '💾 Salvar Lançamentos'}
               </Button>
            </div>
         )}
      </div>
    </div>
  );
}
