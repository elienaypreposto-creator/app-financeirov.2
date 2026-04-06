"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Calendar, Info, TrendingUp, Building2, Wallet, FileText, Sparkles, Loader2, ChevronDown, MessageSquare, Send, Bot, UserIcon, ArrowRight, RefreshCcw, AlertTriangle, Download, X, Eye, Heart, Coffee, ShieldCheck, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";

// Export Libraries
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export default function DashboardPage() {
  const supabase = createClient();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("pj");
  
  // Chat AI States
  const [messages, setMessages] = useState<{role: 'user'|'ai', text: string}[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Filter States
  const [selectedYears, setSelectedYears] = useState<number[]>([2026]);
  const [selectedMonths, setSelectedMonths] = useState<number[]>([new Date().getMonth()]); 

  // Data for export
  const [conciliatedData, setConciliatedData] = useState<any[]>([]);

  // Statistics State
  const [statsPJ, setStatsPJ] = useState({ 
    faturamento: 0, 
    rendimentos: 0, 
    despesas: 0, 
    proLabore: 0, 
    das: 0, 
    inss: 0, 
    lucroIsento: 0,
    qtdTotal: 0,
    qtdConcluidos: 0,
    pendenciasNF: 0,
    qtdNFPendentes: 0
  });

  const [statsPF, setStatsPF] = useState({
    rendaPura: 0, // Salários, etc (PF)
    distribuicaoRecebida: 0, // Distribuição da PJ (calculada)
    gastosEssenciais: 0,
    estiloVida: 0,
    investimentos: 0,
    sobra: 0,
    distribuicaoIdeal: 0 // O que a PJ tem disponível para dar
  });

  const [isLoadingStats, setIsLoadingStats] = useState(true);

  const fetchStats = useCallback(async () => {
    setIsLoadingStats(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      setIsLoadingStats(false);
      return;
    }

    const { data: txs, error } = await supabase.from('transactions')
       .select('*')
       .eq('user_id', userData.user.id)
       .eq('ignorado', false)
       .neq('status', 'Pendente');

    if (!error && txs) {
       // PJ Logic
       let faturamento = 0;
       let rendimentos = 0;
       let despesasPJ = 0;
       let pendenciasNF = 0;
       let qtdNFPendentes = 0;

       // PF Logic
       let rendaPuraPF = 0;
       let essencialPF = 0;
       let estiloVidaPF = 0;
       let investimentosPF = 0;

       const filtered = txs.filter((t: any) => {
          const date = new Date(t.data_transacao);
          const m = date.getMonth();
          const y = date.getFullYear();
          return selectedMonths.includes(m) && selectedYears.includes(y);
       });

       const conciliados = filtered.filter(t => t.status === 'Conciliado');
       setConciliatedData(conciliados);

       filtered.forEach((t: any) => {
          if (t.tipo_conta === 'PJ') {
             // PJ calculations
             if (t.valor > 0) {
                if (t.categoria === "Rendimentos") {
                   rendimentos += t.valor;
                } else {
                   faturamento += t.valor;
                   if ((t.categoria === 'Vendas' || t.categoria === 'Serviços Prestados' || t.categoria === 'Serviços') && t.has_invoice === false) {
                     pendenciasNF += t.valor;
                     qtdNFPendentes++;
                   }
                }
             } else if (t.valor < 0) {
                despesasPJ += Math.abs(t.valor);
             }
          } else {
             // PF calculations
             if (t.valor > 0) {
                rendaPuraPF += t.valor;
             } else if (t.valor < 0) {
                const val = Math.abs(t.valor);
                const cat = t.categoria.toLowerCase();
                if (cat.includes("moradia") || cat.includes("saúde") || cat.includes("educação") || cat.includes("transporte") || cat.includes("alimentação") || cat.includes("essencial")) {
                   essencialPF += val;
                } else if (cat.includes("investimento") || cat.includes("aplicação") || cat.includes("poupança")) {
                   investimentosPF += val;
                } else {
                   estiloVidaPF += val;
                }
             }
          }
       });

       // PJ Totals
       const proLabore = faturamento * 0.28;
       const das = faturamento * 0.06;
       const inss = proLabore * 0.11;
       const lucroIsentoPJ = (faturamento + rendimentos) - proLabore - das - inss - despesasPJ;

       setStatsPJ({
         faturamento, rendimentos, despesas: despesasPJ,
         proLabore, das, inss, lucroIsento: lucroIsentoPJ,
         qtdTotal: filtered.length, qtdConcluidos: filtered.length,
         pendenciasNF, qtdNFPendentes
       });

       // PF Totals
       // Consideramos que rendaPuraPF já pode incluir transferências da PJ que caíram na PF.
       const sobra = (rendaPuraPF) - essencialPF - estiloVidaPF - investimentosPF;
       
       setStatsPF({
         rendaPura: rendaPuraPF,
         distribuicaoRecebida: 0, // Difícil saber sem cruzamento manual, mas podemos estimar
         estiloVida: estiloVidaPF,
         investimentos: investimentosPF,
         sobra,
         distribuicaoIdeal: lucroIsentoPJ > 0 ? lucroIsentoPJ : 0,
         gastosEssenciais: essencialPF
       });
    }
    setIsLoadingStats(false);
  }, [supabase, selectedMonths, selectedYears]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleAnalyze = () => {
    setIsAnalyzing(true);
    setTimeout(() => {
      setIsAnalyzing(false);
      setShowResults(true);
    }, 2500);
  };

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    setMessages(prev => [...prev, {role: 'user', text: chatInput}]);
    setChatInput("");
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      let aiReply = activeTab === 'pj' 
        ? `O seu lucro isento disponível na PJ é de R$ ${statsPJ.lucroIsento.toLocaleString("pt-BR")}.`
        : `Na sua vida pessoal, sobrou R$ ${statsPF.sobra.toLocaleString("pt-BR")} este mês.`;
      
      if (activeTab === 'pf' && statsPF.gastosEssenciais > statsPF.rendaPura * 0.5) {
         aiReply += " Notei que seus gastos essenciais estão acima de 50% da sua renda. Tente otimizar custos fixos.";
      }
      setMessages(prev => [...prev, { role: 'ai', text: aiReply }]);
    }, 1500);
  };

  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  const handleExportPDF = () => {
    if (conciliatedData.length === 0) {
      alert("Não há dados conciliados para exportar.");
      return;
    }
    const doc = new jsPDF();
    const period = selectedMonths.map(m => monthNames[m]).join(", ") + " " + selectedYears.join("/");
    doc.setFontSize(18);
    doc.text("Extrato Consolidado - FinControl", 14, 20);
    doc.setFontSize(10);
    doc.text(`Período: ${period}`, 14, 28);
    autoTable(doc, {
      startY: 35,
      head: [["Data", "Desc", "Cat", "Conta", "Valor", "Status"]],
      body: conciliatedData.map(t => [new Date(t.data_transacao).toLocaleDateString(), t.descricao, t.categoria, t.tipo_conta, `R$ ${t.valor.toLocaleString("pt-BR")}`, t.status]),
    });
    doc.save(`FinControl_${new Date().getTime()}.pdf`);
    setIsExportModalOpen(false);
  };

  const handleExportXLSX = () => {
    if (conciliatedData.length === 0) {
      alert("Não há dados conciliados para exportar.");
      return;
    }
    const ws = XLSX.utils.json_to_sheet(conciliatedData.map(t => ({
      "Data": new Date(t.data_transacao).toLocaleDateString(),
      "Descrição": t.descricao,
      "Categoria": t.categoria,
      "Tipo Conta": t.tipo_conta,
      "Valor": t.valor,
      "Status": t.status
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dados");
    XLSX.writeFile(wb, `FinControl_${new Date().getTime()}.xlsx`);
    setIsExportModalOpen(false);
  };

  return (
    <>
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col gap-8 pb-10 px-4 md:px-10 animate-in fade-in duration-700">
      {/* HEADER SECTION: Titulo, Navigation e Filtros em uma única linha refinada */}
      <div className="flex flex-col lg:flex-row justify-between items-center gap-8 mt-6 bg-white/40 p-5 rounded-[3rem] border border-white/60 backdrop-blur-md shadow-xl shadow-slate-200/20">
        <div className="flex flex-col">
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter leading-none">Dashboard Central</h1>
          <p className="text-slate-400 text-[10px] font-bold mt-1.5 uppercase tracking-[0.2em] opacity-80">Gestão integrada do seu CNPJ e do seu CPF</p>
        </div>
        
        <div className="bg-slate-100/40 p-1.5 rounded-[1.8rem] border border-slate-200/50 flex gap-2">
          <TabsList className="bg-transparent border-0 h-auto gap-2">
            <TabsTrigger value="pj" className="px-6 py-2.5 gap-2 flex items-center data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-xl data-[state=active]:shadow-slate-300/40 rounded-[1.4rem] transition-all font-black text-[11px] uppercase tracking-widest text-slate-500">
              <Building2 className="w-3.5 h-3.5" /> Visão Tributária (PJ)
            </TabsTrigger>
            <TabsTrigger value="pf" className="px-6 py-2.5 gap-2 flex items-center data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-xl data-[state=active]:shadow-slate-300/40 rounded-[1.4rem] transition-all font-black text-[11px] uppercase tracking-widest text-slate-500">
              <UserIcon className="w-3.5 h-3.5" /> Visão Pessoal (PF)
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex items-center gap-2 bg-white border border-slate-200/60 p-2 rounded-[1.8rem] shadow-sm">
           <div className="flex flex-col px-4 border-r border-slate-100">
             <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-0.5">Fiscal/Ano</span>
             <DropdownMenu>
               <DropdownMenuTrigger className="flex items-center min-w-[70px] justify-between text-slate-800 text-[11px] font-black hover:text-primary transition-colors focus:outline-none">
                 {selectedYears.length === 1 ? selectedYears[0] : "Anos"} <ChevronDown className="w-3 h-3 opacity-50 ml-2" />
               </DropdownMenuTrigger>
               <DropdownMenuContent className="w-[120px] bg-white border-slate-200 text-slate-700 rounded-xl shadow-2xl">
                  {[2026, 2025, 2024].map(y => (
                    <DropdownMenuCheckboxItem key={y} checked={selectedYears.includes(y)} onCheckedChange={(c) => setSelectedYears(p => c ? [...p, y] : p.filter(i => i !== y))} className="font-bold text-xs">{y}</DropdownMenuCheckboxItem>
                  ))}
               </DropdownMenuContent>
             </DropdownMenu>
           </div>

           <div className="flex flex-col px-4 border-r border-slate-100">
             <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-0.5">Mês Ref.</span>
             <DropdownMenu>
               <DropdownMenuTrigger className="flex items-center min-w-[80px] justify-between text-slate-800 text-[11px] font-black hover:text-primary transition-colors focus:outline-none">
                 {selectedMonths.length === 1 ? monthNames[selectedMonths[0]] : "Múltiplos"} <ChevronDown className="w-3 h-3 opacity-50 ml-2" />
               </DropdownMenuTrigger>
               <DropdownMenuContent className="w-[160px] bg-white border-slate-200 text-slate-700 rounded-xl max-h-[300px] overflow-y-auto shadow-2xl">
                  {monthNames.map((name, i) => (
                    <DropdownMenuCheckboxItem key={i} checked={selectedMonths.includes(i)} onCheckedChange={(c) => setSelectedMonths(p => c ? [...p, i] : p.filter(m => m !== i))} className="font-bold text-xs">{name}</DropdownMenuCheckboxItem>
                  ))}
               </DropdownMenuContent>
             </DropdownMenu>
           </div>

           <Button variant="ghost" size="icon" onClick={() => fetchStats()} className="bg-primary/5 text-primary hover:bg-primary/20 h-10 w-10 rounded-full transition-all"><RefreshCcw className={`w-4 h-4 ${isLoadingStats ? 'animate-spin' : ''}`} /></Button>
        </div>
      </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8 items-stretch">
            {/* COLUNA 1: Receitas e Lucros */}
            <TabsContent value="pj" className="xl:col-span-3 m-0 focus-visible:ring-0">
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                  {/* QUADRO: Receitas PJ */}
                  <Card className="bg-white border-slate-200 shadow-xl rounded-[2.5rem] p-8 flex flex-col justify-between min-h-[350px] border-b-8 border-b-emerald-500/30">
                    <CardHeader className="p-0 pb-6"><CardTitle className="text-sm font-black text-slate-800 flex items-center gap-3"><TrendingUp className="w-5 h-5 text-emerald-500" /> Receitas PJ</CardTitle><CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Faturamento Bruto</CardDescription></CardHeader>
                    <CardContent className="p-0 space-y-8 flex-1 flex flex-col justify-center">
                       <div className="flex justify-between items-center text-sm"><span className="text-slate-500 font-bold uppercase tracking-tighter">Faturamento</span><span className="font-black text-slate-900 text-lg">R$ {statsPJ.faturamento.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
                       <div className="flex justify-between items-center text-sm"><span className="text-slate-500 font-bold uppercase tracking-tighter">Rendimentos</span><span className="font-black text-emerald-500 text-lg">R$ {statsPJ.rendimentos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
                       <div className="flex flex-col gap-1 pt-6 border-t border-slate-50"><span className="text-slate-400 font-black text-[10px] uppercase tracking-[0.2em]">Total Bruto mensal</span><span className="font-black text-emerald-600 text-5xl tracking-tighter">R$ {(statsPJ.faturamento + statsPJ.rendimentos).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
                    </CardContent>
                  </Card>

                  {/* QUADRO: Impostos */}
                  <Card className="bg-white border-slate-200 shadow-xl rounded-[2.5rem] p-8 flex flex-col min-h-[350px]">
                    <CardHeader className="p-0 pb-6"><CardTitle className="text-sm font-black text-slate-800 flex items-center gap-3"><FileText className="w-5 h-5 text-rose-500" /> Impostos</CardTitle><CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Deduções Recomendadas</CardDescription></CardHeader>
                    <CardContent className="p-0 space-y-6 flex-1 flex flex-col justify-center">
                       <div className="flex justify-between items-center text-[10px] font-black border-b border-slate-50 pb-4 text-slate-500"><span>DAS / INSS / LABORE</span><span className="text-rose-600 font-black"> -R$ {(statsPJ.proLabore + statsPJ.das + statsPJ.inss).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
                       <div className="flex justify-between items-center text-[10px] font-black border-b border-slate-50 pb-4 text-slate-500"><span>GASTOS OPERACIONAIS</span><span className="text-rose-600 font-black"> -R$ {statsPJ.despesas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
                       <div className="pt-6"><span className="text-slate-400 font-black text-[10px] uppercase tracking-widest block mb-2">Deduções Totais</span><span className="font-black text-rose-600 text-5xl tracking-tighter">-R$ {(statsPJ.proLabore + statsPJ.das + statsPJ.inss + statsPJ.despesas).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
                    </CardContent>
                  </Card>

                  {/* QUADRO: Lucro Isento PJ (SOLID TEAL) */}
                  <Card className="bg-emerald-600 shadow-2xl shadow-emerald-500/30 border-0 rounded-[2.5rem] p-8 flex flex-col justify-between min-h-[350px] relative overflow-hidden group transition-all hover:scale-[1.01]">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32 transition-transform group-hover:scale-110"></div>
                    <CardHeader className="p-0 pb-4 relative z-10"><CardTitle className="text-md font-black text-emerald-50 flex items-center gap-3"><Wallet className="w-6 h-6 text-white/80" /> Lucro Isento PJ</CardTitle></CardHeader>
                    <CardContent className="p-0 space-y-8 relative z-10 flex-1 flex flex-col justify-center">
                       <div className="flex flex-col gap-1"><span className="text-emerald-100/60 font-black text-[10px] uppercase tracking-[0.2em]">Disponível para saque</span><span className="font-black text-white text-6xl tracking-tighter">R$ {statsPJ.lucroIsento.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
                       <div className="bg-black/10 backdrop-blur-sm p-5 rounded-2xl text-[11px] text-white/90 font-bold leading-relaxed border border-white/5 shadow-2xl shadow-black/10"><p>Valor estimado para retirada como lucros sem tributação pessoal.</p></div>
                    </CardContent>
                  </Card>

                  {/* QUADRO: Relatórios */}
                  <Card className="bg-white border-slate-200 shadow-xl p-8 rounded-[2.5rem] flex flex-col justify-center gap-6 min-h-[350px] group border-b-8 border-b-slate-100 hover:border-b-emerald-500 transition-all">
                    <div className="flex flex-col gap-2">
                       <h4 className="text-slate-900 font-black flex items-center gap-3 text-2xl tracking-tighter"><Download className="w-7 h-7 text-emerald-500" /> Relatórios</h4>
                       <p className="text-slate-400 text-sm font-semibold leading-relaxed">Gere o extrato oficial consolidado para sua contabilidade em segundos.</p>
                    </div>
                    <Button onClick={()=>setIsExportModalOpen(true)} className="bg-emerald-500 hover:bg-emerald-600 text-white font-black w-full uppercase text-xs tracking-widest shadow-2xl shadow-emerald-500/20 transition-all h-14 rounded-2xl active:scale-95">Baixar Relatório do Mes</Button>
                  </Card>
               </div>
            </TabsContent>

            {/* PF SECTION */}
            <TabsContent value="pf" className="xl:col-span-3 m-0 focus-visible:ring-0">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <Card className="bg-white border-slate-200 shadow-xl rounded-[2.5rem] p-8 flex flex-col justify-between min-h-[350px] border-b-8 border-b-emerald-500">
                  <CardHeader className="p-0 pb-2"><CardTitle className="text-xl font-black text-slate-800 flex items-center gap-3"><Wallet className="w-6 h-6 text-emerald-500" /> Renda Pessoal</CardTitle></CardHeader>
                  <CardContent className="p-0 space-y-6 pt-6">
                     <div className="flex justify-between items-center"><span className="text-slate-500 font-black text-[10px] uppercase tracking-widest">Receitas do Mês</span><span className="font-black text-emerald-600 text-4xl tracking-tighter">R$ {(statsPF.rendaPura + statsPF.distribuicaoIdeal).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
                     <div className="bg-slate-50 p-5 rounded-xl flex items-center justify-between text-xs font-bold text-slate-400 border border-slate-100"><span>(Salário + Distribuição PJ)</span><Sparkles className="w-4 h-4 text-emerald-500" /></div>
                  </CardContent>
                </Card>

                <Card className="bg-white border-slate-200 shadow-xl rounded-[2.5rem] p-8 flex flex-col min-h-[350px]">
                  <CardHeader className="p-0 pb-4"><CardTitle className="text-xl font-black text-slate-800 flex items-center gap-3"><ShieldCheck className="w-6 h-6 text-sky-500" /> Essenciais</CardTitle></CardHeader>
                  <CardContent className="p-0 flex-1 flex flex-col justify-center gap-8">
                     <div><span className="text-slate-400 font-black text-[10px] uppercase tracking-widest block mb-2">Gasto total fixo</span><span className="font-black text-rose-600 text-5xl tracking-tighter">R$ {statsPF.gastosEssenciais.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
                     <div className="w-full bg-slate-100 h-3.5 rounded-full overflow-hidden shadow-inner border border-slate-200"><div className={`h-full transition-all duration-1000 ${statsPF.gastosEssenciais > (statsPF.rendaPura + statsPF.distribuicaoIdeal) * 0.5 ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{width: `${Math.min(100, (statsPF.gastosEssenciais / ((statsPF.rendaPura + statsPF.distribuicaoIdeal) || 1)) * 100)}%`}}></div></div>
                  </CardContent>
                </Card>

                <Card className="bg-white border-slate-200 shadow-xl rounded-[2.5rem] p-10 flex flex-col justify-center min-h-[350px] border-b-8 border-b-amber-500 group">
                  <div className="flex flex-col gap-6">
                    <div className="flex items-center gap-5 text-2xl font-black text-slate-800 transition-transform group-hover:scale-105 origin-left"><ShoppingBag className="w-8 h-8 text-amber-500" /> Estilo de Vida</div>
                    <div><span className="text-slate-400 font-black text-[10px] uppercase tracking-widest block mb-1">Lazer e Conforto</span><span className="font-black text-amber-600 text-5xl tracking-tighter">R$ {statsPF.estiloVida.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
                  </div>
                </Card>

                <Card className="bg-slate-900 shadow-2xl shadow-slate-900/20 border-0 rounded-[2.5rem] p-10 flex flex-col justify-center min-h-[350px] relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl -mr-32 -mt-32 transition-transform group-hover:scale-110"></div>
                  <CardHeader className="p-0 pb-6 relative z-10"><CardTitle className="text-xl font-black text-primary flex items-center gap-4"><Sparkles className="w-8 h-8 animate-pulse" /> Sobra Líquida</CardTitle></CardHeader>
                  <CardContent className="p-0 relative z-10">
                     <span className="font-black text-white text-6xl tracking-tighter block mb-6">R$ {statsPF.sobra.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                     <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.3em] opacity-60">Saldo final disponível no CPF</p>
                  </CardContent>
                </Card>
               </div>
            </TabsContent>

            {/* AI CONSULTANT (TALL) */}
            <div className="xl:col-span-1">
              <Card className="bg-white border-slate-200 shadow-2xl h-full min-h-[600px] flex flex-col rounded-[3.5rem] overflow-hidden border-t-8 border-t-primary/80 transition-all hover:shadow-primary/5">
                <CardHeader className="border-b border-slate-50 p-10 pt-12 bg-white flex flex-col items-center text-center"><Bot className="w-12 h-12 text-primary mb-4" /><CardTitle className="text-3xl font-black text-slate-900 tracking-tighter">Consultoria AI</CardTitle><CardDescription className="text-slate-400 font-black uppercase text-[11px] tracking-[0.3em] mt-2">Status: Online</CardDescription></CardHeader>
                <CardContent className="p-8 pt-0 flex-1 flex flex-col overflow-hidden">
                {!showResults && !isAnalyzing && (
                  <div className="flex flex-col items-center justify-center p-8 h-full text-center space-y-6 pt-12">
                     <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-2 shadow-sm"><Bot className="w-8 h-8" /></div>
                     <p className="text-slate-600 text-sm leading-relaxed font-semibold px-4">Analisar o fechamento do seu {activeTab === 'pj' ? 'CNPJ' : 'CPF'} agora?</p>
                     <Button onClick={handleAnalyze} className="bg-primary hover:bg-primary/90 font-bold shadow-xl shadow-primary/20 gap-3 w-full h-14 rounded-xl transition-all hover:scale-[1.02] text-white">Iniciar Diagnóstico</Button>
                  </div>
                )}

                {isAnalyzing && (
                  <div className="flex flex-col items-center justify-center h-full space-y-6 pt-20">
                     <div className="relative"><Loader2 className="w-12 h-12 text-primary animate-spin opacity-40" /><Bot className="w-6 h-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" /></div>
                     <p className="text-primary font-bold animate-pulse text-xs text-center px-8 tracking-widest uppercase">Cruzando dados bancários e tributários...</p>
                  </div>
                )}

                {showResults && (
                  <div className="flex flex-col h-full flex-1 overflow-hidden pt-6">
                     <div className="flex-1 overflow-y-auto space-y-6 pr-3 pb-4 custom-scrollbar">
                        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 space-y-5 shadow-inner text-[13px] leading-relaxed">
                           <h4 className="text-primary font-extrabold flex items-center gap-2 text-sm uppercase tracking-tight"><Sparkles className="w-4 h-4" /> Diagnóstico Inteligente</h4>
                           {activeTab === 'pj' ? (
                             <div className="space-y-4">
                               <p className="border-l-4 border-emerald-500 pl-4 py-1 font-medium bg-emerald-50/50 rounded-r-md"><strong className="text-emerald-800">Cenário Tributário:</strong> Seu lucro isento disponível no CNPJ é saudável (R$ {statsPJ.lucroIsento.toLocaleString("pt-BR")}).</p>
                               <p className="border-l-4 border-rose-500 pl-4 py-1 font-medium bg-rose-50/50 rounded-r-md"><strong className="text-rose-800">Atenção Fiscal:</strong> {statsPJ.pendenciasNF > 0 ? `Detectamos R$ ${statsPJ.pendenciasNF.toLocaleString("pt-BR")} em receitas PJ sem nota fiscal vinculada.` : "Todas as receitas PJ registradas possuem nota fiscal vinculada."}</p>
                             </div>
                           ) : (
                             <div className="space-y-4">
                               <p className="border-l-4 border-sky-500 pl-4 py-1 font-medium bg-sky-50/50 rounded-r-md"><strong className="text-sky-800">Saúde Financeira:</strong> Você terminou o mês com R$ {statsPF.sobra.toLocaleString("pt-BR")} de economia real no CPF.</p>
                               <p className="border-l-4 border-amber-500 pl-4 py-1 font-medium bg-amber-50/50 rounded-r-md"><strong className="text-amber-800">Sugestão:</strong> {statsPF.sobra > 0 ? "Considere alocar a sobra deste mês em investimentos de longo prazo para acelerar sua independência." : "Revise a categoria de Estilo de Vida nos próximos 30 dias."}</p>
                             </div>
                           )}
                        </div>
                        {messages.map((msg, i) => (
                          <div key={i} className={`flex gap-4 text-sm ${msg.role === 'ai' ? '' : 'flex-row-reverse animate-in slide-in-from-right'}`}>
                            {msg.role === 'ai' && <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20 shadow-sm"><Bot className="w-5 h-5" /></div>}
                            <div className={`p-4 rounded-2xl max-w-[85%] shadow-sm leading-relaxed ${msg.role === 'ai' ? 'bg-slate-50 border border-slate-200 text-slate-700 font-medium' : 'bg-primary text-white font-bold shadow-lg shadow-primary/20'}`}>{msg.text}</div>
                          </div>
                        ))}
                        <div ref={messagesEndRef} />
                     </div>
                     <div className="mt-4 bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center gap-3 shrink-0 shadow-inner">
                       <Input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={h => h.key==='Enter'&&handleSendMessage()} placeholder="Tire uma dúvida com a AI..." className="bg-transparent border-0 text-sm focus-visible:ring-0 shadow-none h-10 font-medium placeholder:text-slate-400" />
                       <Button onClick={handleSendMessage} size="icon" className="bg-primary hover:bg-primary/90 rounded-xl h-10 w-10 shrink-0 shadow-lg shadow-primary/20 border-0 transition-all hover:scale-105"><Send className="w-4 h-4 text-white" /></Button>
                     </div>
                  </div>
                )}
              </CardContent>
              </Card>
            </div>
        </div>
    </Tabs>

      {/* MODAL EXPORTAÇÃO */}
      <Dialog open={isExportModalOpen} onOpenChange={setIsExportModalOpen}>
        <DialogContent className="sm:max-w-xl bg-white border-slate-200 text-slate-900 rounded-[3rem] p-10 overflow-hidden shadow-2xl [&>button]:hidden">
          <div className="absolute top-0 right-0 p-8 z-50">
            <button 
              onClick={()=>setIsExportModalOpen(false)} 
              className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-white hover:shadow-lg transition-all active:scale-95"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <DialogHeader><DialogTitle className="flex items-center gap-4 text-emerald-600 text-3xl font-black tracking-tighter"><Download className="w-8 h-8" /> Exportar Consolidado</DialogTitle></DialogHeader>
          
          <div className="space-y-10 pt-10">
             {/* FILTROS NO MODAL */}
             <div className="grid grid-cols-2 gap-6 bg-slate-50/80 p-8 rounded-[2rem] border border-slate-100 shadow-inner">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Ano Fiscal</label>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="flex items-center w-full justify-between bg-white border border-slate-200 text-slate-800 px-5 py-3 rounded-2xl text-xs font-black shadow-sm transition-all hover:border-emerald-500/50">
                      {selectedYears.length === 1 ? selectedYears[0] : "Selecionar"} <ChevronDown className="w-4 h-4 opacity-30" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-[180px] bg-white border-slate-200 text-slate-700 rounded-xl shadow-xl">
                        {[2026, 2025, 2024].map(y => (
                          <DropdownMenuCheckboxItem key={y} checked={selectedYears.includes(y)} onCheckedChange={(c) => setSelectedYears(p => c ? [...p, y] : p.filter(i => i !== y))} className="font-bold text-xs">{y}</DropdownMenuCheckboxItem>
                        ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Mês de Referência</label>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="flex items-center w-full justify-between bg-white border border-slate-200 text-slate-800 px-5 py-3 rounded-2xl text-xs font-black shadow-sm transition-all hover:border-emerald-500/50">
                      {selectedMonths.length === 1 ? monthNames[selectedMonths[0]] : "Múltiplos"} <ChevronDown className="w-4 h-4 opacity-30" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-[180px] bg-white border-slate-200 text-slate-700 rounded-xl max-h-[250px] overflow-y-auto shadow-xl">
                        {monthNames.map((name, i) => (
                          <DropdownMenuCheckboxItem key={i} checked={selectedMonths.includes(i)} onCheckedChange={(c) => setSelectedMonths(p => c ? [...p, i] : p.filter(m => m !== i))} className="font-bold text-xs">{name}</DropdownMenuCheckboxItem>
                        ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
             </div>

             <div className="bg-slate-50/50 p-8 rounded-[2.5rem] border border-slate-100 space-y-8 shadow-sm">
               <div className="flex justify-between items-center px-2"><label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Resumo do Arquivo</label><div className="px-4 py-1.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-widest shadow-sm">{conciliatedData.length} Conciliados</div></div>
               
               <div className="grid grid-cols-2 gap-6">
                  <button onClick={handleExportPDF} className="bg-white border border-slate-100 hover:border-rose-500 p-8 rounded-[2rem] flex flex-col items-center justify-center gap-4 transition-all hover:shadow-2xl hover:-translate-y-1 shadow-sm group">
                    <FileText className="w-10 h-10 text-rose-500 transition-transform group-hover:scale-110" /> 
                    <span className="text-xs font-black text-slate-700 uppercase tracking-widest">PDF</span>
                  </button>
                  <button onClick={handleExportXLSX} className="bg-white border border-slate-100 hover:border-emerald-500 p-8 rounded-[2rem] flex flex-col items-center justify-center gap-4 transition-all hover:shadow-2xl hover:-translate-y-1 shadow-sm group">
                    <TrendingUp className="w-10 h-10 text-emerald-500 transition-transform group-hover:scale-110" /> 
                    <span className="text-xs font-black text-slate-700 uppercase tracking-widest">Excel</span>
                  </button>
               </div>
             </div>

             <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-2xl flex gap-5 items-center shadow-inner">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 shadow-sm"><Info className="w-6 h-6" /></div>
                <p className="text-emerald-700 text-[11px] leading-relaxed font-bold">O sistema vai gerar um arquivo consolidado contendo toda a movimentação bancária (PJ e PF) filtrada acima.</p>
             </div>

             <div className="flex justify-between items-center text-[9px] text-slate-400 font-black uppercase tracking-[0.3em] px-4 opacity-50">
                <span className="flex items-center gap-2 pr-4 border-r border-slate-100"><Eye className="w-4 h-4" /> Relatório V1.2</span>
                <span>Security Protected</span>
             </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
