"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Calendar, Info, TrendingUp, Building2, UserIcon, Sparkles, Loader2, ChevronDown, Send, Bot, Download, X, Eye, ShieldCheck, ArrowUpRight, Zap, LayoutDashboard, Database, CreditCard, RefreshCcw, Target, ListChecks, PieChart as PieChartIcon } from "lucide-react";
import { useControl } from "@/contexts/ControlContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";
import { ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

// Export Libraries
import * as XLSX from "xlsx";

export default function DashboardPage() {
  const supabase = createClient();
  const { viewMode, setViewMode, controleTipo } = useControl();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiInsights, setAiInsights] = useState<string | null>(null);

  // Filter States
  const [selectedYears, setSelectedYears] = useState<number[]>([]); 
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]); 
  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  // Data States
  const [isLoading, setIsLoading] = useState(true);

  // PJ Financial Data
  const [pjStats, setPjStats] = useState({
    faturamentoAnual: 0,
    faturamentoMensal: 0,
    despesasOperacionais: 0,
    lucroIsento: 0,
    transferenciaSegura: 0,
    meiLimit: 81000,
    meiProgress: 0
  });

  // PF Financial Data
  const [pfStats, setPfStats] = useState({
    incomeData: [] as { name: string, value: number, percentage: number }[],
    totalIncome: 0,
    essenciais: 0,
    lazer: 0,
    investimentos: 0,
    sobraLiquida: 0,
    topCategories: [] as { name: string, value: number, percentage: number }[]
  });

  const incomeColors = ["#00A878", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#10B981"];

  // Fetch profile logic moved to context

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

  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase.from('transactions')
      .select('*')
      .eq('user_id', userData.user.id)
      .eq('ignorado', false);

    if (!error && data) {
      processFinancials(data);
    }
    setIsLoading(false);
  }, [supabase, selectedMonths, selectedYears]);

  const processFinancials = (txs: any[]) => {
    const filtered = txs.filter(t => {
      const d = parseTrDate(t.data_transacao);
      const m = d.getMonth();
      const y = d.getFullYear();
      const monthMatch = selectedMonths.length === 0 || selectedMonths.includes(m);
      const yearMatch = selectedYears.length === 0 || selectedYears.includes(y);
      return monthMatch && yearMatch;
    });

    let fatMensal = 0;
    let despOp = 0;
    
    // Process PJ (Business)
    filtered.filter(t => (t.tipo_conta || "").toUpperCase().includes('PJ') && t.natureza !== 'Transferência').forEach(t => {
      if (t.natureza === 'Receita') fatMensal += t.valor;
      else if (t.natureza === 'Despesa') despOp += Math.abs(t.valor);
      else if (t.valor > 0) fatMensal += t.valor; // Fallback
      else despOp += Math.abs(t.valor); // Fallback
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
    
    setPjStats({
      faturamentoAnual: fatAnualAcumulado,
      faturamentoMensal: fatMensal,
      despesasOperacionais: despOp,
      lucroIsento: realLucroIsento,
      transferenciaSegura: realLucroIsento,
      meiLimit: 81000,
      meiProgress: (fatAnualAcumulado / 81000) * 100
    });

    let totalIncomePF = 0;
    let essenciais = 0;
    let lazer = 0;
    let investimentos = 0;
    const incomeCatMap: Record<string, number> = {};
    const expenseCatMap: Record<string, number> = {};

    if (realLucroIsento > 0) {
      incomeCatMap["Distrib. Lucro PJ"] = realLucroIsento;
      totalIncomePF += realLucroIsento;
    }

    // Process PF (Personal)
    filtered.filter(t => (t.tipo_conta || "").toUpperCase().includes('PF') && t.natureza !== 'Transferência').forEach(t => {
      if (t.natureza === 'Receita' || (t.valor > 0 && !t.natureza)) {
        const cat = t.categoria || "Outras Rendas";
        incomeCatMap[cat] = (incomeCatMap[cat] || 0) + t.valor;
        totalIncomePF += t.valor;
      } else if (t.natureza === 'Despesa' || (t.valor < 0 && !t.natureza)) {
        const val = Math.abs(t.valor);
        const cat = (t.categoria || "Diversos");
        
        expenseCatMap[cat] = (expenseCatMap[cat] || 0) + val;

        const lowerCat = cat.toLowerCase();
        if (lowerCat.includes("moradia") || lowerCat.includes("saúde") || lowerCat.includes("alimentação") || lowerCat.includes("mercado") || lowerCat.includes("luz") || lowerCat.includes("internet") || lowerCat.includes("essencial")) essenciais += val;
        else if (lowerCat.includes("investimento") || lowerCat.includes("aplicação") || lowerCat.includes("poupança") || lowerCat.includes("corretora") || lowerCat.includes("previdência")) investimentos += val;
        else lazer += val;
      }
    });

    const incomeFinalData = Object.entries(incomeCatMap).map(([name, value]) => ({
      name,
      value,
      percentage: totalIncomePF > 0 ? (value / totalIncomePF) * 100 : 0
    })).sort((a, b) => b.value - a.value);

    const totalSpent = essenciais + lazer + investimentos;
    const topCategories = Object.entries(expenseCatMap)
      .map(([name, value]) => ({ 
        name, 
        value, 
        percentage: totalSpent > 0 ? (value / totalSpent) * 100 : 0 
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    setPfStats({
      incomeData: incomeFinalData,
      totalIncome: totalIncomePF,
      essenciais,
      lazer,
      investimentos,
      sobraLiquida: totalIncomePF - essenciais - lazer - investimentos,
      topCategories
    });
  };

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleAnalyse = () => {
    setIsAnalyzing(true);
    setAiInsights(null);
    setTimeout(() => {
      setIsAnalyzing(false);
      if (viewMode === "pj") {
        setAiInsights(`Seu faturamento acumulado de ${formatBRL(pjStats.faturamentoAnual)} está sob controle. Considerando a média mensal, você atingirá ${Math.round(pjStats.meiProgress)}% do limite MEI este ano.`);
      } else {
        setAiInsights(`Sua renda total este mês é de ${formatBRL(pfStats.totalIncome)}. A maior parte vem de "${pfStats.incomeData[0]?.name || ' fontes diretas'}". Sua economia real após gastos é de ${formatBRL(pfStats.sobraLiquida)}.`);
      }
    }, 2000);
  };

  const formatBRL = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const balanceData = [
    { name: "S1", balance: pfStats.sobraLiquida * 0.7 },
    { name: "S2", balance: pfStats.sobraLiquida * 0.9 },
    { name: "S3", balance: pfStats.sobraLiquida * 0.85 },
    { name: "S4", balance: pfStats.sobraLiquida }
  ];

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 30;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill={incomeColors[index % incomeColors.length]} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="text-[10px] font-black uppercase tracking-tighter">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F9FA] text-slate-900 font-sans">
      <Tabs value={viewMode} onValueChange={(val) => setViewMode(val as any)} className="w-full flex flex-col min-h-screen">
        <div className="px-6 md:px-10 py-8 bg-[#F8F9FA] flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter leading-none">Dashboard Central</h1>
            <p className="text-slate-400 text-[10px] font-bold mt-2 uppercase tracking-widest opacity-70">Gestão integrada do seu CNPJ e do seu CPF</p>
          </div>
          
          <TabsList className="bg-slate-100/50 p-1 rounded-full flex border border-slate-200/50 h-auto overflow-x-auto max-w-full">
            {(controleTipo === 'pj' || controleTipo === 'both' || !controleTipo) && (
              <TabsTrigger value="pj" className="px-4 md:px-6 py-2.5 gap-3 flex items-center bg-transparent border-0 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-md rounded-full transition-all font-black text-[9px] md:text-[10px] uppercase tracking-widest text-slate-400 hover:text-slate-600">
                <Building2 className="w-4 h-4" /> Visão Tributária (PJ)
              </TabsTrigger>
            )}
            {(controleTipo === 'pf' || controleTipo === 'both' || !controleTipo) && (
              <TabsTrigger value="pf" className="px-4 md:px-6 py-2.5 gap-3 flex items-center bg-transparent border-0 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-md rounded-full transition-all font-black text-[9px] md:text-[10px] uppercase tracking-widest text-slate-400 hover:text-slate-600">
                <UserIcon className="w-4 h-4" /> Visão Pessoal (PF)
              </TabsTrigger>
            )}
          </TabsList>
          
          <div className="flex items-center gap-0 bg-white border border-slate-200 p-1.5 rounded-full shadow-sm">
             <div className="flex flex-col px-4 border-r border-slate-100">
               <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-0.5">Fiscal/Ano</span>
               <DropdownMenu>
                 <DropdownMenuTrigger className="flex items-center min-w-[70px] justify-between text-slate-800 text-xs font-black hover:text-emerald-600 transition-colors focus:outline-none">
                   {selectedYears.length === 0 ? "Anos" : selectedYears.length === 1 ? selectedYears[0] : "Vários"} <ChevronDown className="w-3 h-3 opacity-30 ml-2" />
                 </DropdownMenuTrigger>
                 <DropdownMenuContent className="w-[120px] bg-white border-slate-200 text-slate-700 rounded-xl shadow-2xl">
                    {[2026, 2025, 2024].map(y => (
                      <DropdownMenuCheckboxItem key={y} checked={selectedYears.includes(y)} onCheckedChange={(c) => setSelectedYears(p => c ? [...p, y] : p.filter(i => i !== y))} className="font-bold text-xs">{y}</DropdownMenuCheckboxItem>
                    ))}
                 </DropdownMenuContent>
               </DropdownMenu>
             </div>

             <div className="flex flex-col px-4">
               <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-0.5">Mês Ref.</span>
               <DropdownMenu>
                 <DropdownMenuTrigger className="flex items-center min-w-[100px] justify-between text-slate-800 text-xs font-black hover:text-emerald-600 transition-colors focus:outline-none">
                   {selectedMonths.length === 0 ? "Todos" : selectedMonths.length === 1 ? monthNames[selectedMonths[0]] : "Múltiplos"} <ChevronDown className="w-3 h-3 opacity-30 ml-2" />
                 </DropdownMenuTrigger>
                 <DropdownMenuContent className="w-[160px] bg-white border-slate-200 text-slate-700 rounded-xl max-h-[300px] overflow-y-auto shadow-2xl">
                    {monthNames.map((name, i) => (
                      <DropdownMenuCheckboxItem key={i} checked={selectedMonths.includes(i)} onCheckedChange={(c) => setSelectedMonths(p => c ? [...p, i] : p.filter(idx => idx !== i))} className="font-bold text-xs">{name}</DropdownMenuCheckboxItem>
                    ))}
                 </DropdownMenuContent>
               </DropdownMenu>
             </div>

             <Button variant="ghost" size="icon" onClick={() => fetchTransactions()} className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 h-9 w-9 rounded-full transition-all ml-1"><RefreshCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /></Button>
          </div>
        </div>

        <main className="flex-1 flex flex-col xl:flex-row overflow-hidden relative">
          <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar space-y-10">
            <TabsContent value="pj" className="space-y-10 mt-0 focus-visible:ring-0">
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-10">
                <Card className="bg-white border-0 shadow-[0_20px_50px_rgba(0,0,0,0.04)] rounded-[2.5rem] p-8 md:p-10 flex flex-col justify-between group overflow-hidden relative border-t-4 border-emerald-500 transition-all hover:shadow-emerald-500/10">
                  <CardHeader className="p-0 mb-8">
                    <CardTitle className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-3">
                      <Target className="w-4 h-4 text-emerald-500" /> Termômetro de Limite MEI
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="flex flex-col md:flex-row justify-between items-end mb-6 gap-4">
                      <div>
                        <p className="text-4xl md:text-5xl font-black text-slate-800 tracking-tighter">{formatBRL(pjStats.faturamentoAnual)}</p>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Acumulado Real</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-slate-800">{formatBRL(pjStats.meiLimit)}</p>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Teto Anual</p>
                      </div>
                    </div>
                    <div className="relative w-full h-5 bg-slate-100 rounded-full overflow-hidden shadow-inner mb-2">
                       <div className={`h-full transition-all duration-1000 ease-out shadow-lg ${pjStats.meiProgress > 85 ? 'bg-rose-500' : 'bg-[#00A878]'}`} style={{ width: `${Math.min(100, pjStats.meiProgress)}%` }} />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-[#00A878] to-[#008f66] text-white shadow-[0_20px_50px_rgba(0,168,120,0.3)] rounded-[2.5rem] p-8 md:p-10 flex flex-col justify-between relative overflow-hidden group border-0 transition-all hover:scale-[1.02]">
                  <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:scale-110 transition-transform"><Building2 className="w-40 h-40" /></div>
                  <CardHeader className="p-0 mb-6 relative z-10">
                    <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80 flex items-center gap-3">
                      <ShieldCheck className="w-5 h-5 text-white" /> Transferência Segura
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 relative z-10">
                    <h3 className="text-4xl md:text-6xl font-black tracking-tighter leading-none mb-4">{formatBRL(pjStats.transferenciaSegura)}</h3>
                    <p className="text-xs font-bold opacity-80 mb-10 max-w-[280px] leading-relaxed">Valor que pode ser transferido para a conta PF com <span className="bg-white/20 px-2 py-0.5 rounded-md text-white">0% de IRPF</span>.</p>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-white border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2.5rem] overflow-hidden border-b-4 border-slate-100">
                <CardHeader className="p-10 border-b border-slate-50 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-3">
                      <Database className="w-4 h-4 text-emerald-500" /> Cálculo de Lucro PJ
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                    <table className="w-full text-sm min-w-[600px]">
                      <thead>
                        <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                          <th className="px-10 py-5 text-left">Indicador</th>
                          <th className="px-10 py-5 text-right">Valor</th>
                          <th className="px-10 py-5 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        <tr><td className="px-10 py-6 font-bold">Receita Bruta</td><td className="px-10 py-6 text-right font-black">{formatBRL(pjStats.faturamentoMensal)}</td><td className="px-10 py-6 text-right"><span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">RECEITA</span></td></tr>
                        <tr><td className="px-10 py-6 font-bold text-slate-600">(-) Despesas</td><td className="px-10 py-6 text-right font-black text-rose-500">-{formatBRL(pjStats.despesasOperacionais)}</td><td className="px-10 py-6 text-right"><span className="bg-rose-50 text-rose-600 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">DESPESA</span></td></tr>
                        <tr><td className="px-10 py-6 font-bold text-slate-600">(-) Impostos</td><td className="px-10 py-6 text-right font-black text-rose-500">-{formatBRL(pjStats.faturamentoMensal * 0.34)}</td><td className="px-10 py-6 text-right"><span className="bg-slate-100 text-slate-400 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">IMPOSTOS</span></td></tr>
                        <tr className="bg-[#00A878]/[0.02]"><td className="px-10 py-8 font-black text-base">Lucro Disponível</td><td className="px-10 py-8 text-right font-black text-[#00A878] text-2xl">{formatBRL(pjStats.lucroIsento)}</td><td className="px-10 py-8 text-right"><span className="bg-[#00A878] text-white px-3 py-1 rounded-full text-[10px] font-black shadow-lg">LUCRO REAL</span></td></tr>
                      </tbody>
                    </table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="pf" className="space-y-10 mt-0 focus-visible:ring-0">
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-10">
                 {/* COMPOSIÇÃO DE RENDA TOTAL */}
                 <Card className="bg-white border-0 shadow-[0_20px_50px_rgba(0,0,0,0.04)] rounded-[2.5rem] p-8 md:p-10 flex flex-col min-h-[500px] border-t-4 border-slate-100">
                    <CardHeader className="p-0 mb-4">
                      <CardTitle className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-3">
                        <PieChartIcon className="w-4 h-4 text-emerald-500" /> Composição de Renda Total
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 flex-1 flex flex-col items-center">
                       <div className="w-full h-72 relative">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie 
                                data={pfStats.incomeData} 
                                cx="50%" 
                                cy="50%" 
                                innerRadius={70} 
                                outerRadius={90} 
                                paddingAngle={5} 
                                dataKey="value" 
                                stroke="none"
                                label={renderCustomizedLabel}
                                labelLine={true}
                              >
                                {pfStats.incomeData.map((entry, index) => <Cell key={`cell-${index}`} fill={incomeColors[index % incomeColors.length]} />)}
                              </Pie>
                              <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontWeight: 'bold' }} />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Geral</p>
                             <p className="text-2xl font-black text-slate-800 tracking-tighter">{formatBRL(pfStats.totalIncome)}</p>
                          </div>
                       </div>
                       
                       {/* Lista de Categorias de Renda */}
                       <div className="w-full mt-10 space-y-4">
                          {pfStats.incomeData.length > 0 ? pfStats.incomeData.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-100 transition-all hover:bg-slate-50">
                               <div className="flex items-center gap-3">
                                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: incomeColors[idx % incomeColors.length] }}></div>
                                  <div>
                                     <p className="text-xs font-black text-slate-700 uppercase tracking-tight">{item.name}</p>
                                     <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{item.percentage.toFixed(1)}% do total</p>
                                  </div>
                               </div>
                               <p className="text-sm font-black text-slate-800">{formatBRL(item.value)}</p>
                            </div>
                          )) : (
                            <div className="text-center py-10 opacity-30 italic text-xs font-bold uppercase tracking-widest">Aguardando dados de renda...</div>
                          )}
                       </div>
                    </CardContent>
                 </Card>

                 <Card className="bg-white border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2.5rem] p-10 flex flex-col border-t-4 border-slate-100">
                    <CardHeader className="p-0 mb-8">
                      <CardTitle className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-3">
                        <ListChecks className="w-4 h-4 text-emerald-500" /> Top Categorias de Despesa
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 flex-1 flex flex-col gap-8">
                       {pfStats.topCategories.length > 0 ? pfStats.topCategories.map((cat, idx) => (
                         <div key={idx} className="space-y-3">
                            <div className="flex justify-between items-end">
                               <div><p className="font-black text-slate-800 text-sm">{cat.name}</p><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Participação: {Math.round(cat.percentage)}%</p></div>
                               <p className="text-sm font-black text-slate-700">{formatBRL(cat.value)}</p>
                            </div>
                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
                               <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${cat.percentage}%` }} />
                            </div>
                         </div>
                       )) : (
                         <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40">
                            <Info className="w-10 h-10 mb-4" />
                            <p className="text-sm font-bold uppercase tracking-widest">Nenhuma despesa<br/>classificada para o período</p>
                         </div>
                       )}
                    </CardContent>
                 </Card>
               </div>

               <Card className="bg-white border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2.5rem] p-10 border-b-4 border-slate-100">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
                    <div>
                        <CardTitle className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-3 mb-3">
                          <TrendingUp className="w-4 h-4 text-emerald-500" /> Evolução de Saldo Líquido
                        </CardTitle>
                        <p className="text-5xl font-black text-slate-800 tracking-tighter">{formatBRL(pfStats.sobraLiquida)}</p>
                        <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Saldo pós despesas e transferências</p>
                    </div>
                  </div>
                  <div className="w-full h-64 mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={balanceData}>
                        <defs><linearGradient id="colorPF" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00A878" stopOpacity={0.15}/><stop offset="95%" stopColor="#00A878" stopOpacity={0}/></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                        <XAxis dataKey="name" hide />
                        <YAxis hide />
                        <Tooltip />
                        <Area type="monotone" dataKey="balance" stroke="#00A878" strokeWidth={5} fillOpacity={1} fill="url(#colorPF)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
               </Card>
            </TabsContent>
          </div>

          <aside className="w-full xl:w-[420px] p-6 lg:p-10 shrink-0 bg-[#F1F3F5]/40">
            <div className="h-full bg-white/40 backdrop-blur-3xl border border-white/60 shadow-[0_20px_50px_rgba(0,0,0,0.05)] rounded-[3rem] flex flex-col overflow-hidden relative border-t-4 border-emerald-500/20">
              <div className="p-10 text-center flex flex-col items-center border-b border-white/50">
                <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-[#00A878] rounded-[2rem] flex items-center justify-center text-white mb-6 shadow-2xl shadow-emerald-500/40 animate-in zoom-in duration-500"><Bot className="w-10 h-10" /></div>
                <h2 className="text-3xl font-black text-slate-800 tracking-tighter mb-2">FinControl AI</h2>
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div><p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Análise Ativa</p></div>
              </div>
              <div className="flex-1 px-8 flex flex-col justify-center items-center py-10">
                {!aiInsights && !isAnalyzing && (
                  <div className="text-center space-y-10">
                     <p className="text-slate-500 font-bold text-sm leading-relaxed px-6 italic font-sans italic">"Otimize seu lucro e reduza impostos com o diagnóstico em tempo real."</p>
                     <button onClick={handleAnalyse} className="group relative bg-slate-900 hover:bg-black text-white rounded-full px-12 h-16 font-black text-xs uppercase tracking-widest flex items-center gap-3 overflow-hidden shadow-xl transition-all hover:scale-105 active:scale-95">
                       <span className="relative z-10 flex items-center gap-3">Analisar Lançamentos <Sparkles className="w-4 h-4 text-emerald-400" /></span>
                     </button>
                  </div>
                )}
                {isAnalyzing && (
                  <div className="flex flex-col items-center justify-center space-y-8">
                    <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Cruzando bases PJ e PF...</p>
                  </div>
                )}
                {aiInsights && !isAnalyzing && (
                  <div className="w-full flex flex-col gap-6 animate-in slide-in-from-bottom-8">
                     <div className="bg-white/80 border border-slate-100 p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden">
                        <h4 className="text-[#00A878] font-black text-[10px] uppercase tracking-[0.4em] mb-6">Insights Gerados</h4>
                        <p className="text-slate-700 text-[14px] leading-relaxed font-bold italic">"{aiInsights}"</p>
                     </div>
                     <Button variant="ghost" onClick={() => setAiInsights(null)} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-emerald-500 transition-colors">Nova Análise</Button>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </main>
      </Tabs>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap');
        body { font-family: 'Outfit', sans-serif; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 20px; }
      `}</style>
    </div>
  );
}
