"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, Search, Download, Trash, RefreshCw, Calendar, ArrowLeft, Ban, PencilLine, AlertCircle, Loader2, ChevronDown } from "lucide-react";
import { Select, SelectContent, SelectGroup, SelectLabel, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";

export default function LancamentosPage() {
  const [view, setView] = useState<"conciliacao" | "importacao">("conciliacao");
  const [selectedGroup, setSelectedGroup] = useState<any | null>(null);

  // Supabase Auth States
  const [userId, setUserId] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id || null));
  }, []);

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
    'Banco do Brasil': '/logos/bb.png', // Or 'BB'
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
  const [selectedMonths, setSelectedMonths] = useState<number[]>([new Date().getMonth()]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  const loadData = async () => {
    setIsLoading(true);
    const supabase = createClient();
    
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) {
      setIsLoading(false);
      return; 
    }

    const { data: txs, error } = await supabase.from('transactions').select('*').order('created_at', { ascending: false });
    
    if (txs && !error) {
      // Grouping by logical import batches (Using banco, tipo_conta, and DATE of created_at)
      const groupsMap: Record<string, any> = {};
      
      txs.forEach((t: any) => {
        const dateKey = t.created_at.split('T')[0];
        const key = `${t.banco}|${t.tipo_conta}|${dateKey}`;
        
        if (!groupsMap[key]) {
          groupsMap[key] = {
            id: key,
            date: new Date(t.created_at).toLocaleDateString('pt-BR'),
            bank: t.banco,
            tipo: `Conta ${t.tipo_conta}`,
            minDate: t.data_transacao,
            maxDate: t.data_transacao,
            conc: 0, ign: 0, pend: 0, total: 0,
            status: "Pendente",
          };
        } else {
          if (t.data_transacao < groupsMap[key].minDate) groupsMap[key].minDate = t.data_transacao;
          if (t.data_transacao > groupsMap[key].maxDate) groupsMap[key].maxDate = t.data_transacao;
        }
        
        groupsMap[key].total++;
        if (t.ignorado) groupsMap[key].ign++;
        else if (t.status === 'Conciliado') groupsMap[key].conc++;
        else groupsMap[key].pend++;
      });

      const processed = Object.values(groupsMap).map(g => {
        if (g.pend === 0 && g.conc > 0) g.status = "Conciliado";
        else if (g.conc > 0 && g.pend > 0) g.status = "Parcial";

        // Formatar período robusto com ano (dd/mm/aa)
        if (g.minDate && g.maxDate) {
           const parseF = (s: string) => {
              if (!s) return "";
              s = s.split('T')[0].split(' ')[0];
              if (s.includes('-')) {
                 const pts = s.split('-');
                 if (pts[0].length === 4) {
                   // YYYY-MM-DD -> dd/mm/aa
                   const year = pts[0].slice(-2);
                   return `${pts[2]}/${pts[1]}/${year}`;
                 }
                 // DD-MM-YYYY -> dd/mm/aa
                 const year = pts[2].slice(-2);
                 return `${pts[0]}/${pts[1]}/${year}`;
              } else if (s.includes('/')) {
                 const pts = s.split('/');
                 if (pts[0].length === 4) {
                   // YYYY/MM/DD -> dd/mm/aa
                   const year = pts[0].slice(-2);
                   return `${pts[2]}/${pts[1]}/${year}`;
                 }
                 // DD/MM/YYYY -> dd/mm/aa
                 const year = pts[2].slice(-2);
                 return `${pts[0]}/${pts[1]}/${year}`;
              }
              return s;
           };
           const pMin = parseF(g.minDate);
           const pMax = parseF(g.maxDate);
           g.period = pMin === pMax ? pMin : `${pMin} a ${pMax}`;
        } else {
           g.period = "-";
        }
        return g;
      });

      setDbGroups(processed);
    }
    setIsLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  
  const handleDeleteGroup = async (group: any) => {
    if (!window.confirm(`Tem certeza que deseja excluir as transações importadas do ${group.bank}?`)) return;
    
    setIsDeleting(group.id);
    
    try {
      const supabase = createClient();
      const dateKey = group.id.split('|').pop();
      const tipoValue = group.tipo.replace('Conta ', '');
      
      // Deletar transações usando filtros mais precisos
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('banco', group.bank)
        .eq('tipo_conta', tipoValue)
        .gte('created_at', `${dateKey}T00:00:00`)
        .lt('created_at', `${dateKey}T23:59:59.999999`);
      
      if (error) {
        console.error('[v0] Erro ao deletar:', error);
        alert('Erro ao excluir as transações. Tente novamente.');
      } else {
        // Remover do estado local imediatamente para feedback visual rápido
        setDbGroups(prev => prev.filter(g => g.id !== group.id));
      }
    } catch (err) {
      console.error('[v0] Erro ao deletar:', err);
      alert('Erro ao excluir as transações. Tente novamente.');
    } finally {
      setIsDeleting(null);
    }
  };

  const filteredGroups = dbGroups.filter(g => {
    const matchStatus = filterStatus === "Todos" || g.status.toLowerCase() === filterStatus.toLowerCase();
    const matchConta = filterConta === "Todas" || g.tipo.includes(filterConta);
    const matchSearch = g.bank.toLowerCase().includes(search.toLowerCase());
    
    // Simple date match (extract day/month/year from g.date "DD/MM/YYYY")
    const parts = g.date.split('/');
    const gMonth = parseInt(parts[1]) - 1;
    const gYear = parseInt(parts[2]);
    const matchDate = (selectedMonths.length === 0 || selectedMonths.includes(gMonth)) && gYear === selectedYear;

    return matchStatus && matchConta && matchSearch && matchDate;
  });

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto pb-10">
      <div className="bg-white rounded-2xl p-6 border-b-4 border-b-emerald-500 flex justify-between items-center shadow-sm">
        <div>
           <h1 className="text-2xl font-black text-slate-800 tracking-tighter">Arquivos de conciliação / Lançamentos</h1>
           <p className="text-slate-400 text-xs font-bold mt-1 tracking-wide">Gerencie e confira suas importações bancárias</p>
        </div>
        <Button onClick={onImportar} className="bg-emerald-500 hover:bg-emerald-600 shadow-md font-bold text-white rounded-xl h-11 px-6">Importar Extrato</Button>
      </div>

      <div className="flex items-end gap-4 text-sm mt-4 overflow-x-auto pb-2">
         <div className="flex flex-col gap-2">
           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Status</label>
           <Select value={filterStatus} onValueChange={(v: string | null) => setFilterStatus(v || "Todos")}>
             <SelectTrigger className="w-[140px] bg-white border-slate-200 h-10 rounded-xl text-slate-700 font-bold focus:ring-emerald-500">
               <SelectValue placeholder="Status" />
             </SelectTrigger>
             <SelectContent className="bg-white border-slate-200 rounded-xl">
               <SelectItem value="Todos" className="font-bold">Todos</SelectItem>
               <SelectItem value="Pendente" className="font-bold">Pendentes</SelectItem>
               <SelectItem value="Parcial" className="font-bold">Parciais</SelectItem>
               <SelectItem value="Conciliado" className="font-bold">Conciliados</SelectItem>
             </SelectContent>
           </Select>
         </div>

         <div className="flex flex-col gap-2">
           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Tipo de Conta</label>
           <Select value={filterConta} onValueChange={(v: string | null) => setFilterConta(v || "Todas")}>
             <SelectTrigger className="w-[140px] bg-white border-slate-200 h-10 rounded-xl text-slate-700 font-bold focus:ring-emerald-500">
               <SelectValue placeholder="Conta" />
             </SelectTrigger>
             <SelectContent className="bg-white border-slate-200 rounded-xl">
               <SelectItem value="Todas" className="font-bold">Todas</SelectItem>
               <SelectItem value="PJ" className="font-bold">Contas PJ</SelectItem>
               <SelectItem value="PF" className="font-bold">Contas PF</SelectItem>
             </SelectContent>
           </Select>
         </div>
         
         <div className="flex flex-col gap-2">
           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Mês</label>
           <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center w-[140px] justify-between text-slate-700 text-xs font-bold bg-white border border-slate-200 h-10 px-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm transition-all">
                {selectedMonths.length === 1 ? monthNames[selectedMonths[0]] : selectedMonths.length > 1 ? "Múltiplos" : "Todos"} <ChevronDown className="w-3 h-3 opacity-50" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[160px] bg-white border-slate-200 text-slate-700 rounded-xl max-h-[300px] overflow-y-auto shadow-2xl">
                 {monthNames.map((name, i) => (
                   <DropdownMenuCheckboxItem key={i} checked={selectedMonths.includes(i)} onCheckedChange={(c) => setSelectedMonths(p => c ? [...p, i] : p.filter(m => m !== i))} className="font-bold text-xs">{name}</DropdownMenuCheckboxItem>
                 ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Ano</label>
            <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v || "2026"))}>
              <SelectTrigger className="w-[100px] bg-white border-slate-200 h-10 rounded-xl text-slate-700 font-bold focus:ring-emerald-500">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent className="bg-white border-slate-200 rounded-xl">
                <SelectItem value="2026" className="font-bold">2026</SelectItem>
                <SelectItem value="2025" className="font-bold">2025</SelectItem>
              </SelectContent>
            </Select>
          </div>
         
         <button onClick={loadData} className="ml-2 h-10 px-5 bg-white border border-slate-200 hover:border-emerald-500 hover:text-emerald-600 rounded-xl text-emerald-500 font-bold shadow-sm transition-all flex items-center gap-2 tracking-wide disabled:opacity-50"><RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} /> ATUALIZAR</button>
         
         <div className="flex flex-col gap-2 ml-auto">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Pesquisa</label>
            <div className="relative w-64">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} className="w-full h-10 bg-white border border-slate-200 rounded-xl pl-9 pr-4 text-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none font-medium shadow-sm transition-all" placeholder="Pesquisar Banco..." />
            </div>
         </div>
      </div>

      <div className="border border-slate-100 rounded-2xl overflow-hidden mt-4 bg-white shadow-xl">
        <table className="w-full text-sm text-left text-slate-700">
          <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-6 py-5 w-[140px]">Status</th>
              <th className="px-6 py-5">DATA</th>
              <th className="px-6 py-5">Banco Origem</th>
              <th className="px-6 py-5">Tipo Conta</th>
              <th className="px-6 py-5 min-w-[160px] text-center">Período</th>
              <th className="px-6 py-5 text-center">Conciliados (OK)</th>
              <th className="px-6 py-5 text-center text-slate-400">Lanç. Pendentes</th>
              <th className="px-6 py-5 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredGroups.map((group) => (
              <tr key={group.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  {group.status === "Conciliado" && <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 tracking-widest text-[10px] font-black rounded-full px-3 py-1 shadow-none">CONCILIADO</Badge>}
                  {group.status === "Parcial" && <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 tracking-widest text-[10px] font-black rounded-full px-3 py-1 shadow-none">PARCIAL</Badge>}
                  {group.status === "Pendente" && <Badge className="bg-slate-100 text-slate-500 hover:bg-slate-200 tracking-widest text-[10px] font-black rounded-full px-3 py-1 shadow-none border border-slate-200">PENDENTE</Badge>}
                </td>
                <td className="px-6 py-4 font-bold text-slate-500 text-xs">{group.date}</td>
                <td className="px-6 py-4 flex items-center gap-3">
                   <div className="p-1.5 bg-white border border-slate-100 rounded-lg shadow-sm">
                     <BankLogo bank={group.bank} />
                   </div>
                   <div className="font-extrabold text-slate-800 text-sm">{group.bank}</div>
                </td>
                <td className="px-6 py-4 text-[10px] font-black text-emerald-600 tracking-widest">
                  CONTA {group.tipo.replace('Conta ', '').toUpperCase()}
                </td>
                <td className="px-6 py-4 text-center font-extrabold text-slate-700">
                  {group.period}
                </td>
                <td className="px-6 py-4 text-center font-bold">
                   <span className="text-emerald-600">{group.conc}</span> <span className="text-slate-300 text-xs">/ {group.total}</span>
                </td>
                <td className="px-6 py-4 text-center">
                   {group.pend > 0 ? <span className="bg-rose-100 text-rose-600 px-3 py-1.5 rounded-full font-black text-[10px] tracking-widest">{group.pend} PENDENTES</span> : <span className="text-slate-300">-</span>}
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-center gap-3 text-slate-400">
                     <span title="Continuar Classificando" className="bg-slate-100 border border-slate-200 p-2 rounded-lg cursor-pointer hover:bg-emerald-500 hover:text-white hover:border-emerald-500 transition-all" onClick={() => onEditGroup(group)}><PencilLine className="w-4 h-4" /></span>
                     <span 
                       title="Excluir Extrato Inteiro" 
                       className={`bg-slate-100 border border-slate-200 p-2 rounded-lg cursor-pointer hover:bg-rose-500 hover:text-white hover:border-rose-500 transition-all ${isDeleting === group.id ? 'opacity-50 pointer-events-none' : ''}`} 
                       onClick={() => handleDeleteGroup(group)}
                     >
                       {isDeleting === group.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash className="w-4 h-4" />}
                     </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {/* Empty States / Loading below the table header */}
        {isLoading && dbGroups.length === 0 && (
           <div className="flex items-center justify-center p-12">
             <Loader2 className="w-8 h-8 animate-spin text-primary" />
           </div>
        )}
        {!isLoading && filteredGroups.length === 0 && (
           <div className="flex items-center justify-center p-12 mb-2">
             <div className="bg-slate-50 border border-slate-200 rounded-xl px-8 py-5 text-slate-500 text-sm font-medium">
               Nenhuma transação. Importe um ficheiro acima.
             </div>
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
  id: string;      // generated locally pending save
  date: string;
  desc: string;
  value: number; 
  bank: string;
  cat?: string;
  ignored: boolean;
};

// Advanced Heuristic CSV Parser to support arbitrary Banks
function smartParseCSV(csvText: string, bankName: string): Transaction[] {
  const separator = csvText.includes(';') ? ';' : ',';
  const lines = csvText.split('\n').filter(l => l.trim().length > 5);
  const results: Transaction[] = [];
  
  lines.forEach(line => {
    const cols = line.split(separator).map(c => c.replace(/"/g, '').trim());
    if (cols.length < 3) return;
    
    let tDate = "", tDesc = "", tVal = 0;
    
    for (let col of cols) {
       if (!tDate && (col.match(/^\d{2}\/\d{2}\/\d{4}$/) || col.match(/^\d{4}-\d{2}-\d{2}$/))) {
         tDate = col;
       } 
       else if (tVal === 0 && col.match(/^-?[\d.,]+$/) && col.length < 15 && /[1-9]/.test(col)) {
         let cleanNum = col.replace(/\./g, '').replace(',', '.');
         let num = parseFloat(cleanNum);
         if (!isNaN(num)) tVal = num;
       } 
       else if (!tDesc && col.length > 5 && isNaN(Number(col))) {
         tDesc = col.substring(0, 50);
       }
    }
    
    if (!tDate && cols[0]) tDate = cols[0];
    if (!tDesc && cols[1]) tDesc = cols[1];
    if (tVal === 0 && cols[2]) tVal = parseFloat(cols[2].replace(/\./g, '').replace(',', '.')) || 0;

    if (tDesc && tVal !== 0) {
      results.push({
        id: Math.random().toString(),
        date: tDate || new Date().toLocaleDateString('pt-BR'),
        desc: tDesc,
        value: tVal,
        bank: bankName,
        ignored: false,
      });
    }
  });
  
  return results;
}

// Ultra-fast OFX Parser via Regex Text Matching
function smartParseOFX(ofxText: string, bankName: string): Transaction[] {
  const results = [];
  
  // O OFX separa cada transação em blocos <STMTTRN>
  // Como nem todo OFX usa quebra de linha certinha, vamos procurar via captura global
  const trnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g;
  let match;
  
  while ((match = trnRegex.exec(ofxText)) !== null) {
    const block = match[1];
    
    // Captura Valor: <TRNAMT>-1200.50
    const amtMatch = block.match(/<TRNAMT>([-\d.]+)/);
    const tVal = amtMatch ? parseFloat(amtMatch[1]) : 0;
    
    // Captura Data: <DTPOSTED>20260317...
    const dtMatch = block.match(/<DTPOSTED>(\d{4})(\d{2})(\d{2})/);
    let tDate = "";
    if (dtMatch) {
      tDate = `${dtMatch[3]}/${dtMatch[2]}/${dtMatch[1]}`; // Padrão Brasileiro DD/MM/YYYY
    }
    
    // Captura Descrição: Primeiro tenta MEMO, depois NAME
    const memoMatch = block.match(/<MEMO>([^<]+)/) || block.match(/<NAME>([^<]+)/);
    const tDesc = memoMatch ? memoMatch[1].trim().substring(0, 50) : "Transação Bancária OFX";
    
    if (tVal !== 0 && tDate) {
       results.push({
        id: Math.random().toString(36).substring(2, 9),
        date: tDate,
        desc: tDesc,
        value: tVal,
        bank: bankName,
        ignored: false,
      });
    }
  }
  
  return results;
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

  // Load bank accounts
  useEffect(() => {
    async function fetchAccounts() {
      setLoadingAccounts(true);
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        const { data, error } = await supabase.from('bank_accounts').select('*').eq('user_id', authData.user.id);
        if (data && !error && data.length > 0) {
          setRegisteredAccounts(data);
          setSelectedBank(data[0].name);
          setSelectedConta(data[0].type || "PJ");
        } else {
          // Fallback para localStorage caso o Supabase falhe ou esteja vazio
          const saved = localStorage.getItem("@fincontrol_accounts");
          if (saved) {
             const localAccs = JSON.parse(saved);
             setRegisteredAccounts(localAccs);
             if (localAccs.length > 0) {
               setSelectedBank(localAccs[0].name);
               setSelectedConta(localAccs[0].type || "PJ");
             }
          }
        }
      }
      setLoadingAccounts(false);
    }
    fetchAccounts();
  }, []);

  // Listener nativo para avisar se o cara tentar fechar ou atualizar a aba do navegador
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ''; // Exibe o alerta padrão do navegador
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Removemos do global tbm na desmontagem
      // @ts-ignore
      window.hasUnsavedChanges = false;
    };
  }, []);

  const [categorias, setCategorias] = useState({
    entradas: ["Aportes", "Cashback", "Empréstimos", "Rendimentos", "Serviços Prestados", "Vendas"].sort(),
    saidas: ["Aluguel", "Despesas Pessoais", "Equipamentos", "Impostos", "Lazer", "Marketing", "Taxas Bancárias"].sort()
  });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return;

    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', authData.user.id);
    
    if (data && !error && data.length > 0) {
      const cats = {
        entradas: data.filter((c: any) => c.type === 'entrada').map((c: any) => c.name).sort(),
        saidas: data.filter((c: any) => c.type === 'saida').map((c: any) => c.name).sort()
      };
      setCategorias(cats);
    }
  };

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
          // Filter by the same day to match the grouping logic
          const dateKey = initialGroup.id.split('|').pop();
          const filtered = data.filter(t => t.created_at.startsWith(dateKey));
          
          setTransactions(filtered.map((t: any) => ({
             id: t.id,
             date: t.data_transacao,
             desc: t.descricao,
             value: Number(t.valor),
             bank: t.banco,
             cat: t.categoria,
             ignored: t.ignorado
          })));
          setSelectedBank(initialGroup.bank);
          setSelectedConta(initialGroup.tipo.replace('Conta ', ''));
        }
      };
      loadInitial();
    }
  }, [initialGroup, userId]);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedBank, setSelectedBank] = useState("Santander");
  const [selectedConta, setSelectedConta] = useState("PJ");

  const handleFileUploadClick = () => {
    if(fileInputRef.current) fileInputRef.current.click();
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (registeredAccounts.length === 0) {
      alert("Por favor, cadastre uma conta bancária primeiro.");
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      let parsed: Transaction[] = [];
      
      // Automatic Switch: OFX vs CSV
      if (file.name.toLowerCase().endsWith('.ofx')) {
        parsed = smartParseOFX(text, selectedBank);
      } else {
        parsed = smartParseCSV(text, selectedBank);
      }
      
      if (parsed.length > 0) {
        // Verificar duplicatas antes de adicionar
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          const { data: existing } = await supabase.from('transactions')
            .select('data_transacao, valor, descricao')
            .eq('user_id', authData.user.id)
            .eq('banco', selectedBank);

          if (existing && existing.length > 0) {
            // Marcar transações que já existem
            let duplicateCount = 0;
            const filteredParsed = parsed.filter(t => {
              const isDuplicate = existing.some(ex => 
                ex.data_transacao === t.date && 
                Number(ex.valor) === t.value && 
                ex.descricao === t.desc
              );
              if (isDuplicate) duplicateCount++;
              return !isDuplicate;
            });

            if (duplicateCount > 0) {
              if (filteredParsed.length === 0) {
                alert(`Todas as ${duplicateCount} transações deste extrato já foram importadas anteriormente para esta conta.`);
                // Limpa o input para permitir selecionar o mesmo arquivo novamente
                if (fileInputRef.current) fileInputRef.current.value = '';
                return;
              } else {
                alert(`Atenção: ${duplicateCount} transação(ões) já conciliada(s) anteriormente foram removidas.\n\nRestam ${filteredParsed.length} transações novas para classificar.`);
              }
            }
            setTransactions(filteredParsed);
          } else {
            setTransactions(parsed);
          }
        } else {
          setTransactions(parsed);
        }
      } else {
        alert("O extrato não possui colunas ou tags reconhecíveis. Verifique se é um arquivo CSV ou OFX bancário válido.");
      }
    } catch(err) {
      console.error(err);
      alert("Erro ao ler arquivo.");
    }
    
    // Limpa o input para permitir selecionar o mesmo arquivo novamente se necessário
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Efeito para avisar ao tentar fechar aba
  useEffect(() => {
    const handleUnload = (e: BeforeUnloadEvent) => {
      if (transactions.length > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [transactions]);

  // Sincroniza flag global para o Sidebar interceptar cliques no Menu
  useEffect(() => {
    // @ts-ignore
    window.hasUnsavedChanges = transactions.length > 0;
    return () => {
      // @ts-ignore
      window.hasUnsavedChanges = false;
    };
  }, [transactions]);

  const handleCategoryChange = (val: string | null, id: string) => {
    if (!val) return;
    if (val === "NEW_CATEGORY") {
       setNewCategoryModalOpen(true);
       return;
    }
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, cat: val } : t));
  };

  const handleSaveNewCategory = async () => {
    if (!newCatName.trim()) return;
    
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return;

    const { error } = await supabase.from('categories').insert([{
      user_id: authData.user.id,
      name: newCatName,
      type: newCatType
    }]);

    if (!error) {
       loadCategories();
    } else {
      // Fallback local se a tabela não existir
      setCategorias(prev => {
        const clone = { ...prev };
        if (newCatType === "entrada") clone.entradas = [...clone.entradas, newCatName].sort();
        else clone.saidas = [...clone.saidas, newCatName].sort();
        return clone;
      });
    }

    setNewCategoryModalOpen(false);
    setNewCatName("");
  };

  const clearCategory = (id: string) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, cat: undefined } : t));
  };

  const toggleIgnore = (id: string) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, ignored: !t.ignored } : t));
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // ----- DB SAVE OPERATION -----
  const submitToDatabase = async () => {
    if (transactions.length === 0) return onSave();
    
    setIsSaving(true);
    
    // Tenta pegar a sessão de forma mais robusta
    const { data: sessionData } = await supabase.auth.getSession();
    let currentUserId = sessionData.session?.user?.id;
    
    if (!currentUserId) {
       const { data } = await supabase.auth.getUser();
       if (data?.user?.id) currentUserId = data.user.id;
    }
    
    if (!currentUserId) {
       setIsSaving(false);
       return alert("Usuário não autenticado. Por favor, faça login novamente.");
    }

    // Verificação de Duplicados antes de salvar
    const { data: existing } = await supabase.from('transactions')
      .select('data_transacao, valor, descricao')
      .eq('user_id', currentUserId)
      .eq('banco', selectedBank);

    const toSave = transactions.filter(t => {
      // Se já tem ID de UUID, é uma edição, então permitimos
      if (t.id && t.id.length > 20 && t.id.includes('-')) return true;
      
      // Se é novo, checamos se já existe um igual (data, valor, descrição)
      const isDuplicate = existing?.some(ex => 
        ex.data_transacao === t.date && 
        Number(ex.valor) === t.value && 
        ex.descricao === t.desc
      );
      return !isDuplicate;
    });

    if (toSave.length === 0 && transactions.length > 0) {
      setIsSaving(false);
      return alert("Todas estas transações já foram importadas anteriormente.");
    }

    const payload = toSave.map(t => {
      const item: any = {
        user_id: currentUserId,
        banco: selectedBank,
        tipo_conta: selectedConta,
        data_transacao: t.date,
        descricao: t.desc || "Sem Descrição",
        valor: t.value,
        tipo: t.value >= 0 ? 'entrada' : 'saida',
        categoria: t.cat || null,
        ignorado: t.ignored,
        status: (!!t.cat || t.ignored) ? 'Conciliado' : 'Pendente'
      };
      
      if (t.id && t.id.length > 20 && t.id.includes('-')) {
        item.id = t.id;
      }
      return item;
    });

    const { error } = await supabase.from('transactions').upsert(payload, { onConflict: 'id' });
    
    setIsSaving(false);
    if (error) {
      alert("Erro ao salvar no banco de dados: " + error.message);
    } else {
      onSave(); // Retorna pra view inicial e recarrega
    }
  };

  const handleIntentBack = () => {
    if (transactions.length === 0) {
      onBack();
      return;
    }
    if (window.confirm("Você possui lançamentos não salvos!\nDeseja SALVAR como rascunho antes de sair?")) {
       submitToDatabase();
    } else if (window.confirm("Atenção! Ao sair sem salvar, todos os dados importados deste arquivo serão PERDIDOS.\n\nTem certeza que deseja DESCARTAR TUDO e sair?")) {
       // @ts-ignore
       window.hasUnsavedChanges = false;
       onBack();
    }
  };

  const allReady = transactions.length > 0 && transactions.every(t => !!t.cat || t.ignored);

  return (
    <div className="flex flex-col gap-6 max-w-5xl w-full mx-auto pb-20">
      <input type="file" ref={fileInputRef} className="hidden" accept=".csv,.ofx" onChange={handleFileChange} />
      
      {/* Modal Nova Categoria */}
      <Dialog open={isNewCategoryModalOpen} onOpenChange={setNewCategoryModalOpen}>
        <DialogContent className="sm:max-w-md bg-white border-slate-200 text-slate-800 shadow-xl rounded-2xl">
          <DialogHeader><DialogTitle className="text-slate-800 font-black">Nova Categoria</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
             <div className="space-y-1.5">
               <label className="text-sm font-semibold text-slate-500">Nome da Categoria</label>
               <input type="text" value={newCatName} onChange={e=>setNewCatName(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm text-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all" placeholder="Ex: Combustível" />
             </div>
             <div className="flex gap-6 pt-2 pb-2">
               <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-700">
                 <input type="radio" name="cat_tipo" value="entrada" checked={newCatType === "entrada"} onChange={e=>setNewCatType(e.target.value)} className="accent-emerald-500 w-4 h-4 cursor-pointer" /> Entrada
               </label>
               <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-700">
                 <input type="radio" name="cat_tipo" value="saida" checked={newCatType === "saida"} onChange={e=>setNewCatType(e.target.value)} className="accent-rose-500 w-4 h-4 cursor-pointer" /> Saída
               </label>
             </div>
             <Button onClick={handleSaveNewCategory} className="w-full mt-2 font-bold bg-emerald-500 hover:bg-emerald-600 text-white">Salvar Categoria</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={handleIntentBack} className="text-slate-500 hover:text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 shadow-sm">
           <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Importação de arquivo</h1>
          <p className="text-slate-500 text-sm">Realize a leitura inteligente do extrato bancário</p>
        </div>
      </div>

      <Card className="bg-white border-slate-200 shadow-xl overflow-visible relative rounded-2xl">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none z-0"></div>
        <CardContent className="pt-6 pb-6 flex flex-col md:flex-row items-center justify-between gap-6 z-10 relative">
           <div className="flex items-center gap-4 cursor-pointer hover:opacity-80 transition-opacity flex-1 bg-slate-50 p-4 border border-dashed border-emerald-500/40 rounded-xl" onClick={handleFileUploadClick}>
             <div className="p-3 bg-emerald-500/20 text-emerald-600 rounded-lg shadow-sm">
                <Upload className="w-8 h-8" />
             </div>
             <div>
                <h2 className="font-bold text-emerald-600 text-xl">Upload do Arquivo</h2>
                <p className="text-sm text-slate-500 leading-tight">Escolha um extrato em `.csv` ou `.ofx`. A IA lerá tudo instantaneamente.</p>
             </div>
           </div>
           
           {!loadingAccounts && registeredAccounts.length === 0 && (
             <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-6 text-center rounded-xl border-2 border-dashed border-rose-500/50">
                <AlertCircle className="w-12 h-12 text-rose-500 mb-2" />
                <h3 className="text-xl font-bold text-slate-800">Nenhuma Conta Cadastrada</h3>
                <p className="text-slate-500 mb-4 max-w-sm">Você precisa cadastrar pelo menos uma conta bancária no menu lateral (CONTAS CONFIGURADAS) antes de importar extratos.</p>
                <Button onClick={onBack} variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-50">Voltar</Button>
             </div>
           )}

           <div className="flex gap-4 items-center">
             <div className="flex flex-col gap-1.5">
               <span className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Banco Origem</span>
               <Select value={selectedBank} onValueChange={(v: string | null) => {
                  const val = v || "";
                  setSelectedBank(val);
                  const acc = registeredAccounts.find(a => a.name === val);
                  if (acc) setSelectedConta(acc.type || "PJ");
                }}>
                 <SelectTrigger className="w-[200px] bg-white border-slate-200 text-slate-800 h-10 font-bold rounded-xl focus:ring-emerald-500">
                   <SelectValue placeholder="Escolha a Conta" />
                 </SelectTrigger>
                 <SelectContent className="bg-white border-slate-200 rounded-xl">
                   {registeredAccounts.map(acc => (
                     <SelectItem key={acc.id} value={acc.name} className="font-semibold text-slate-700">
                       {acc.name} ({acc.account})
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>

             <div className="flex flex-col gap-1.5">
               <span className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Identificação</span>
                <div className="h-10 px-4 flex items-center justify-center bg-white text-emerald-600 border border-slate-200 rounded-xl font-black text-sm tracking-widest min-w-[70px] shadow-sm">
                  {selectedConta.toUpperCase()}
                </div>
             </div>
           </div>
        </CardContent>
      </Card>

      <div className="mt-2">
         {transactions.length > 0 && (
           <h2 className="text-lg font-bold text-emerald-600 flex items-center gap-2 mb-4">
             <Search className="w-4 h-4" /> {transactions.length} Transações Lidas pela IA
           </h2>
         )}

         {transactions.length > 0 && (
           <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white flex flex-col shadow-xl">
             <table className="w-full text-sm text-left text-slate-700">
               <thead className="text-[10px] text-slate-400 font-black uppercase tracking-widest bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-4 w-10 text-center">OK</th>
                    <th className="px-4 py-4">Data Ref.</th>
                    <th className="px-4 py-4">Histórico / Descrição</th>
                    <th className="px-4 py-4">Cifras</th>
                    <th className="px-4 py-4">Plano de Contas</th>
                    <th className="px-4 py-4 text-center">Ignorar</th>
                  </tr>
               </thead>
               <tbody>
                 {transactions.map((t) => {
                   const isChecked = !!t.cat || t.ignored;
                   return (
                   <tr key={t.id} className={`border-b border-slate-100 transition-colors ${t.ignored ? 'opacity-30 grayscale bg-slate-50' : 'hover:bg-slate-50/50'} ${isChecked && !t.ignored ? 'bg-emerald-50/30' : ''}`}>
                     <td className="px-4 py-3 text-center">
                        <input type="checkbox" checked={isChecked} readOnly className="accent-emerald-500 w-4 h-4 cursor-not-allowed opacity-80" />
                     </td>
                     <td className="px-4 py-3 whitespace-nowrap text-slate-500 font-mono text-xs">{t.date}</td>
                     <td className="px-4 py-3 font-semibold text-slate-800 max-w-[200px] truncate" title={t.desc}>{t.desc}</td>
                     <td className={`px-4 py-3 font-bold whitespace-nowrap text-right ${t.value > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {formatCurrency(t.value)}
                     </td>
                     <td className="px-4 py-3">
                        <Select value={t.cat || ""} onValueChange={(val) => handleCategoryChange(val, t.id)} disabled={isChecked && !t.ignored}>
                          <SelectTrigger className={`w-[220px] bg-white border-slate-200 font-semibold shadow-sm transition-colors rounded-xl ${t.value > 0 ? 'text-emerald-600' : 'text-rose-600'} disabled:opacity-100 disabled:select-none`}>
                            <SelectValue placeholder="Selecionar Categoria" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px] bg-white border-slate-200 rounded-xl">
                            {t.value >= 0 ? (
                               <SelectGroup>
                                 <SelectLabel className="text-emerald-600 tracking-widest uppercase text-[10px]">Entradas</SelectLabel>
                                 {categorias.entradas.map(c => <SelectItem key={c} value={c} className="font-semibold text-slate-700">{c}</SelectItem>)}
                               </SelectGroup>
                            ) : (
                               <SelectGroup>
                                 <SelectLabel className="text-rose-600 tracking-widest uppercase text-[10px]">Saídas</SelectLabel>
                                 {categorias.saidas.map(c => <SelectItem key={c} value={c} className="font-semibold text-slate-700">{c}</SelectItem>)}
                               </SelectGroup>
                            )}
                            <div className="h-px bg-slate-100 my-1" />
                            <SelectItem value="NEW_CATEGORY" className="text-emerald-600 font-bold">+ Nova Categoria...</SelectItem>
                          </SelectContent>
                        </Select>
                     </td>
                     <td className="px-4 py-3">
                        <div className="flex justify-center gap-4">
                          <span title="Limpar Categoria / Editar"><PencilLine className="w-4 h-4 cursor-pointer text-slate-400 hover:text-emerald-600 transition-colors" onClick={() => clearCategory(t.id)} /></span>
                          <span title={t.ignored ? "Restaurar Linha" : "Remover do Cálculo"}><Ban className={`w-4 h-4 cursor-pointer transition-colors ${t.ignored ? 'text-rose-500 outline outline-rose-500/20 rounded border border-rose-500 bg-rose-500/10' : 'text-slate-400 hover:text-rose-500'}`} onClick={() => toggleIgnore(t.id)} /></span>
                        </div>
                     </td>
                   </tr>
                 )})}
               </tbody>
             </table>
           </div>
         )}
         
         {transactions.length > 0 && (
           <div className="flex justify-end mt-8">
              {allReady ? (
                 <Button onClick={submitToDatabase} disabled={isSaving} className="bg-[#5cb85c] hover:bg-[#4ea052] text-white font-bold px-10 h-14 text-lg shadow-xl shadow-emerald-500/20 rounded-xl transition-all hover:-translate-y-1 active:scale-95 flex gap-3">
                   {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : '✔'} Concluir e Salvar no Banco
                 </Button>
              ) : (
                 <Button onClick={submitToDatabase} disabled={isSaving} className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-8 h-12 text-md shadow-lg shadow-amber-500/20 rounded-xl transition-all active:scale-95 flex gap-2">
                   {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : '💾'} Salvar
                 </Button>
              )}
           </div>
         )}
      </div>
    </div>
  );
}
