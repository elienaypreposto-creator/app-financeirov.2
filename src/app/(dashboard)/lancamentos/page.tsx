"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, Download, Trash, ArrowLeft, Ban, PencilLine, Loader2, LayoutDashboard, RefreshCw, Search, ChevronDown } from "lucide-react";
import { Select, SelectContent, SelectGroup, SelectLabel, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

// ========================================
// TYPES
// ========================================

export type Transaction = {
  id: string;
  date: string;
  desc: string;
  value: number;
  bank: string;
  cat?: string;
  ignored: boolean;
  batch_id?: string;
  temp_timestamp?: string;
};

type Group = {
  id: string;
  date: string;
  bank: string;
  tipo: string;
  period: string;
  minDate: string;
  maxDate: string;
  conc: number;
  ign: number;
  pend: number;
  total: number;
  status: string;
  batch_id?: string;
  fullCreatedAt?: string;
};

// ========================================
// HELPER FUNCTIONS
// ========================================

function formatDateForPeriod(dateStr: string): string {
  if (!dateStr) return "-";
  const parts = dateStr.split(/[\/-]/);
  if (parts.length === 3) {
    let day: string, month: string, yearFull: string;
    if (parts[0].length === 4) {
      // yyyy-mm-dd
      yearFull = parts[0];
      month = parts[1];
      day = parts[2];
    } else {
      // dd/mm/yyyy
      day = parts[0];
      month = parts[1];
      yearFull = parts[2];
    }
    const yearShort = yearFull.slice(-2);
    return `${day}/${month}/${yearShort}`;
  }
  return dateStr;
}

function parseDateToTimestamp(dateStr: string): number {
  if (!dateStr) return 0;
  const parts = dateStr.split(/[\/\-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).getTime();
    return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).getTime();
  }
  return 0;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function downloadTemplateXLSX() {
  const template = [
    { Data: "01/03/2026", Historico: "PIX RECEBIDO CLIENTE", Valor: 1500.00 },
    { Data: "02/03/2026", Historico: "PAGAMENTO FORNECEDOR", Valor: -350.00 },
  ];
  const ws = XLSX.utils.json_to_sheet(template);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Modelo");
  XLSX.writeFile(wb, "Modelo_Extrato_FinControl.xlsx");
}

// ========================================
// CSV / OFX / XLSX PARSERS
// ========================================

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
      } else if (tVal === 0 && col.match(/^-?[\d.,]+$/) && col.length < 15 && /[1-9]/.test(col)) {
        const cleanNum = col.replace(/\./g, '').replace(',', '.');
        const num = parseFloat(cleanNum);
        if (!isNaN(num)) tVal = num;
      } else if (!tDesc && col.length > 5 && isNaN(Number(col))) {
        tDesc = col.substring(0, 50);
      }
    }

    if (!tDate && cols[0]) tDate = cols[0];
    if (!tDesc && cols[1]) tDesc = cols[1];
    if (tVal === 0 && cols[2]) tVal = parseFloat(cols[2].replace(/\./g, '').replace(',', '.')) || 0;

    if (tDesc && tVal !== 0) {
      results.push({ id: Math.random().toString(), date: tDate || new Date().toLocaleDateString('pt-BR'), desc: tDesc, value: tVal, bank: bankName, ignored: false });
    }
  });

  return results;
}

function smartParseOFX(ofxText: string, bankName: string): Transaction[] {
  const results: Transaction[] = [];
  const trnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g;
  let match;

  while ((match = trnRegex.exec(ofxText)) !== null) {
    const block = match[1];
    const amtMatch = block.match(/<TRNAMT>([-\d.]+)/);
    const tVal = amtMatch ? parseFloat(amtMatch[1]) : 0;
    const dtMatch = block.match(/<DTPOSTED>(\d{4})(\d{2})(\d{2})/);
    let tDate = "";
    if (dtMatch) tDate = `${dtMatch[3]}/${dtMatch[2]}/${dtMatch[1]}`;
    const memoMatch = block.match(/<MEMO>([^<]+)/) || block.match(/<NAME>([^<]+)/);
    const tDesc = memoMatch ? memoMatch[1].trim().substring(0, 80) : "Transação Bancária OFX";

    if (tVal !== 0 && tDate) {
      results.push({ id: Math.random().toString(36).substring(2, 9), date: tDate, desc: tDesc, value: tVal, bank: bankName, ignored: false });
    }
  }

  return results.sort((a, b) => {
    const p = (d: string) => { const [day, month, year] = d.split('/').map(Number); return new Date(year, month - 1, day).getTime(); };
    return p(a.date) - p(b.date);
  });
}

function smartParseXLSX(data: any[], bankName: string): Transaction[] {
  const results: Transaction[] = [];

  data.forEach((row: any) => {
    let tDate = "", tDesc = "", tVal = 0;

    if (row.Data || row.data || row.DATA) tDate = row.Data || row.data || row.DATA;
    if (row.Descricao || row.descricao || row.Historico || row.desc) tDesc = row.Descricao || row.descricao || row.Historico || row.desc;
    if (row.Valor || row.valor || row.VALOR || row.Quantia) tVal = parseFloat(String(row.Valor || row.valor || row.VALOR || row.Quantia).replace(/\./g, "").replace(",", "."));

    const values = Object.values(row);
    if (!tDate) tDate = String(values[0]);
    if (!tDesc) tDesc = String(values[1]);
    if (tVal === 0) tVal = parseFloat(String(values[2]).replace(/\./g, "").replace(",", ".")) || 0;

    if (tDesc && tVal !== 0) {
      results.push({ id: Math.random().toString(36).substring(2, 9), date: tDate, desc: tDesc, value: tVal, bank: bankName, ignored: false });
    }
  });

  return results.sort((a, b) => {
    const p = (d: string) => {
      if (!d || typeof d !== 'string') return 0;
      const parts = d.split(/[\/\-]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).getTime();
        return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).getTime();
      }
      return 0;
    };
    return p(a.date) - p(b.date);
  });
}

// ========================================
// MAIN PAGE
// ========================================

export default function LancamentosPage() {
  const [view, setView] = useState<"conciliacao" | "importacao">("conciliacao");
  const [selectedGroup, setSelectedGroup] = useState<any | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id || null));
  }, [supabase]);

  if (view === "importacao") {
    return (
      <ImportacaoView
        onSave={() => { setView("conciliacao"); setSelectedGroup(null); }}
        onBack={() => { setView("conciliacao"); setSelectedGroup(null); }}
        userId={userId}
        initialGroup={selectedGroup}
      />
    );
  }

  return (
    <ConciliacaoView
      onImportar={() => setView("importacao")}
      onEditGroup={(group: Group) => { setSelectedGroup(group); setView("importacao"); }}
      userId={userId}
    />
  );
}

// ========================================
// CONCILIAÇÃO VIEW
// ========================================

function ConciliacaoView({
  onImportar,
  onEditGroup,
  userId
}: {
  onImportar: () => void;
  onEditGroup: (group: Group) => void;
  userId: string | null;
}) {
  const [dbGroups, setDbGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [exportGroup, setExportGroup] = useState<any | null>(null);
  const [filterStatus, setFilterStatus] = useState("Todos");
  const [filterConta, setFilterConta] = useState("Todas");
  const [search, setSearch] = useState("");
  const monthNames = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));

  const loadData = async () => {
    setIsLoading(true);
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) { setIsLoading(false); return; }

    const { data: txs, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', authData.user.id)
      .order('created_at', { ascending: false });

    if (txs && !error) {
      const groupsMap: Record<string, any> = {};

      txs.forEach((t: any) => {
        const key = t.batch_id || t.created_at;
        if (!groupsMap[key]) {
          groupsMap[key] = {
            id: key, date: new Date(t.created_at).toLocaleDateString('pt-BR'),
            bank: t.banco, tipo: `Conta ${t.tipo_conta}`,
            minDate: t.data_transacao, maxDate: t.data_transacao,
            conc: 0, ign: 0, pend: 0, total: 0, status: "Pendente",
            batch_id: t.batch_id, fullCreatedAt: t.created_at
          };
        } else {
          if (!groupsMap[key].minDate || t.data_transacao < groupsMap[key].minDate) groupsMap[key].minDate = t.data_transacao;
          if (!groupsMap[key].maxDate || t.data_transacao > groupsMap[key].maxDate) groupsMap[key].maxDate = t.data_transacao;
        }
        groupsMap[key].total++;
        if (t.ignorado) groupsMap[key].ign++;
        else if (t.status === 'Conciliado') groupsMap[key].conc++;
        else groupsMap[key].pend++;
      });

      const processed = Object.values(groupsMap).map((g: any) => {
        if (g.pend === 0 && g.conc > 0) g.status = "Conciliado";
        else if (g.conc > 0 && g.pend > 0) g.status = "Parcial";
        const pMin = formatDateForPeriod(g.minDate);
        const pMax = formatDateForPeriod(g.maxDate);
        g.period = pMin === pMax ? pMin : `${pMin} a ${pMax}`;
        return g;
      }).sort((a, b) => parseDateToTimestamp(b.maxDate) - parseDateToTimestamp(a.maxDate));

      setDbGroups(processed);
    }
    setIsLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleDeleteGroup = async (group: any) => {
    if (!window.confirm(`Tem certeza que deseja excluir as transações importadas do ${group.bank}?`)) return;
    try {
      const supabase = createClient();
      let query = supabase.from('transactions').delete();
      if (group.batch_id) {
        query = query.eq('batch_id', group.batch_id);
      } else if (group.fullCreatedAt) {
        query = query.eq('created_at', group.fullCreatedAt);
      } else {
        const dateKey = group.id.split('|').pop();
        query = query.eq('banco', group.bank).eq('tipo_conta', group.tipo.replace('Conta ', '')).like('created_at', `${dateKey}%`);
      }
      const { error } = await query;
      if (error) alert('Erro ao excluir: ' + error.message);
      else setDbGroups(prev => prev.filter(g => g.id !== group.id));
    } catch (err) {
      alert('Erro ao excluir as transações.');
    }
  };

  const handleExport = async (group: any, format: 'PDF' | 'XLSX') => {
    const supabase = createClient();
    let query = supabase.from('transactions').select('*').eq('user_id', userId).eq('banco', group.bank).eq('ignorado', false);

    if (group.batch_id) query = query.eq('batch_id', group.batch_id);
    else if (group.fullCreatedAt) query = query.eq('created_at', group.fullCreatedAt);
    else {
      const dateKey = group.id.split('|').pop();
      query = query.like('created_at', `${dateKey}%`);
    }

    const { data } = await query.order('data_transacao', { ascending: true });
    if (!data || data.length === 0) return alert("Nenhum dado para exportar");

    const bankDetails = `${group.bank} (${group.tipo.toUpperCase()})`;
    const period = group.period;

    if (format === 'XLSX') {
      const worksheetData = data.map(t => ({
        "DATA REF.": t.data_transacao,
        "HISTÓRICO / DESCRIÇÃO": t.descricao,
        "Valor (R$)": t.valor,
        "PLANO DE CONTAS": t.categoria || "Pendente"
      }));
      const ws = XLSX.utils.json_to_sheet(worksheetData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Extrato");
      XLSX.writeFile(wb, `Extrato_${group.bank}_${period.replace(/\s/g, '_')}.xlsx`);
    } else {
      const doc = new jsPDF();

      try {
        doc.addImage("/logo.png", "PNG", 85, 10, 40, 20);
      } catch (e) {
        doc.setTextColor(0, 168, 120);
        doc.setFontSize(24);
        doc.setFont("helvetica", "bold");
        doc.text("FinControl", 105, 25, { align: 'center' });
      }

      doc.setTextColor(15, 23, 42);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Relatório de importação de Extrato", 105, 45, { align: 'center' });

      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(14, 52, 182, 18, 4, 4, 'FD');

      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`Banco Origem:`, 20, 59);
      doc.text(`Período:`, 20, 65);

      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.text(bankDetails, 45, 59);
      doc.text(period, 35, 65);

      autoTable(doc, {
        startY: 78,
        head: [['DATA REF.', 'HISTÓRICO / DESCRIÇÃO', 'Valor (R$)', 'PLANO DE CONTAS']],
        body: data.map(t => [
          t.data_transacao,
          t.descricao,
          { content: t.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), styles: { textColor: t.valor < 0 ? [239, 68, 68] : [0, 168, 120] } },
          t.categoria || "Pendente"
        ]),
        headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold', halign: 'left', cellPadding: 4 },
        bodyStyles: { fontSize: 8, textColor: [71, 85, 105], fontStyle: 'normal', cellPadding: 3 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 25, halign: 'center' },
          1: { cellWidth: 'auto', halign: 'left' },
          2: { cellWidth: 35, halign: 'center', fontStyle: 'bold' },
          3: { cellWidth: 45, halign: 'left' }
        },
        margin: { left: 14, right: 14 },
        didParseCell: (hookData) => {
          if (hookData.section === 'head' && hookData.column.index === 2) {
            hookData.cell.styles.halign = 'center';
          }
        }
      });

      doc.save(`Extrato_${group.bank}_${period.replace(/\s/g, '_')}.pdf`);
    }
  };

  const filteredGroups = dbGroups.filter(g => {
    const matchStatus = filterStatus === "Todos" || g.status.toLowerCase() === filterStatus.toLowerCase();
    const matchConta = filterConta === "Todas" || g.tipo.toUpperCase().includes(filterConta.toUpperCase());
    const matchSearch = !search || g.bank.toLowerCase().includes(search.toLowerCase());
    const matchMonth = selectedMonths.length === 0 || (() => {
      // Extract month from period (format: dd/mm/yy)
      const periodStart = g.minDate || "";
      const parts = periodStart.split(/[-\/]/);
      if (parts.length === 3) {
        const month = parts[0].length === 4 ? Number(parts[1]) : Number(parts[1]);
        return selectedMonths.includes(month);
      }
      return true;
    })();
    return matchStatus && matchConta && matchSearch && matchMonth;
  });

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => String(currentYear - i));

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto pb-10">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border-b-4 border-b-emerald-500 flex justify-between items-center shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tighter">Arquivos de conciliação / Lançamentos</h1>
          <p className="text-slate-400 text-xs font-bold mt-1 tracking-wide">Gerencie e confira suas importações bancárias</p>
        </div>
        <Button onClick={onImportar} className="bg-emerald-500 hover:bg-emerald-600 shadow-md font-bold text-white rounded-full h-11 px-7">
          Importar Extrato
        </Button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm px-5 py-4 flex flex-wrap items-end gap-4">

        {/* STATUS */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</label>
          <Select value={filterStatus} onValueChange={(val) => setFilterStatus(val || "Todos")}>
            <SelectTrigger className="w-[140px] bg-slate-50 border-slate-200 h-10 rounded-xl font-semibold text-slate-700 text-sm focus:ring-emerald-500">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white rounded-xl shadow-xl border-slate-200">
              <SelectItem value="Todos">Todos</SelectItem>
              <SelectItem value="Pendente">Pendentes</SelectItem>
              <SelectItem value="Parcial">Parciais</SelectItem>
              <SelectItem value="Conciliado">Conciliados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* TIPO DE CONTA */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo de Conta</label>
          <Select value={filterConta} onValueChange={(val) => setFilterConta(val || "Todas")}>
            <SelectTrigger className="w-[140px] bg-slate-50 border-slate-200 h-10 rounded-xl font-semibold text-slate-700 text-sm focus:ring-emerald-500">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white rounded-xl shadow-xl border-slate-200">
              <SelectItem value="Todas">Todas</SelectItem>
              <SelectItem value="PF">PF</SelectItem>
              <SelectItem value="PJ">PJ</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* MÊS — multi-select */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mês</label>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center justify-between w-[140px] bg-slate-50 border border-slate-200 h-10 rounded-xl px-3 text-sm font-semibold text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors">
              <span className="truncate">
                {selectedMonths.length === 0
                  ? "Todos"
                  : selectedMonths.length === 1
                  ? monthNames[selectedMonths[0] - 1]
                  : `${selectedMonths.length} meses`}
              </span>
              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-white border-slate-200 rounded-xl shadow-xl p-1 w-[160px]">
              <DropdownMenuCheckboxItem
                checked={selectedMonths.length === 0}
                onCheckedChange={() => setSelectedMonths([])}
                className="font-semibold text-slate-500 text-sm rounded-lg"
              >
                Todos os meses
              </DropdownMenuCheckboxItem>
              {monthNames.map((m, i) => (
                <DropdownMenuCheckboxItem
                  key={i}
                  checked={selectedMonths.includes(i + 1)}
                  onCheckedChange={(checked) => {
                    setSelectedMonths(prev =>
                      checked ? [...prev, i + 1] : prev.filter(x => x !== i + 1)
                    );
                  }}
                  className="font-semibold text-slate-700 text-sm rounded-lg"
                >
                  {m}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* ANO */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ano</label>
          <Select value={selectedYear} onValueChange={(val) => setSelectedYear(val || String(new Date().getFullYear()))}>
            <SelectTrigger className="w-[140px] bg-slate-50 border-slate-200 h-10 rounded-xl font-semibold text-slate-700 text-sm focus:ring-emerald-500">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white rounded-xl shadow-xl border-slate-200">
              {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* ATUALIZAR */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black text-transparent uppercase tracking-widest select-none">_</label>
          <Button onClick={loadData} variant="outline" className="h-10 w-[140px] border-emerald-500 text-emerald-600 hover:bg-emerald-50 font-black rounded-xl gap-2 uppercase tracking-widest text-[11px]">
            <RefreshCw className="w-4 h-4" /> Atualizar
          </Button>
        </div>

        {/* PESQUISA */}
        <div className="ml-auto flex flex-col gap-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pesquisa</label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Pesquisar Banco..."
              className="pl-9 pr-4 h-10 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 bg-slate-50 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 w-[200px] transition-colors hover:border-slate-300"
            />
          </div>
        </div>

      </div>

      <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-xl">
        <table className="w-full text-sm text-left text-slate-700">
          <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 border-b">
            <tr>
              <th className="px-6 py-5 w-[140px]">Status</th>
              <th className="px-6 py-5">Data Importação</th>
              <th className="px-6 py-5">Banco</th>
              <th className="px-6 py-5">Tipo Conta</th>
              <th className="px-6 py-5 text-center">Período</th>
              <th className="px-6 py-5 text-center">Conciliados (OK)</th>
              <th className="px-6 py-5 text-center">Lanç. Pendentes</th>
              <th className="px-6 py-5 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredGroups.map((group) => (
              <tr key={group.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                <td className="px-6 py-4">
                  <Badge className={`text-[10px] font-black rounded-full px-3 py-1 ${
                    group.status === "Conciliado" ? "bg-emerald-100 text-emerald-700" :
                    group.status === "Parcial" ? "bg-amber-100 text-amber-700" :
                    "bg-slate-100 text-slate-500"
                  }`}>
                    {group.status.toUpperCase()}
                  </Badge>
                </td>
                <td className="px-6 py-4 font-bold text-slate-500 text-xs">{group.date}</td>
                <td className="px-6 py-4 font-bold text-slate-800">{group.bank}</td>
                <td className="px-6 py-4 text-[10px] font-black text-emerald-600">{group.tipo.replace('Conta ', '').toUpperCase()}</td>
                <td className="px-6 py-4 text-center font-bold text-slate-700">{group.period}</td>
                <td className="px-6 py-4 text-center">
                  <span className="text-emerald-600 font-bold">{group.conc}</span> / {group.total}
                </td>
                <td className="px-6 py-4 text-center">
                  {group.pend > 0 ? (
                    <span className="bg-rose-100 text-rose-600 px-3 py-1 rounded-full text-[10px] font-black">{group.pend}</span>
                  ) : (
                    <span className="text-slate-300">-</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-center gap-3">
                    <Button variant="ghost" size="icon" title="Download Extrato"
                      onClick={() => { setExportGroup(group); setIsDownloadModalOpen(true); }}
                      className="bg-slate-100 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 rounded-full w-9 h-9 transition-all">
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Continuar Classificando"
                      onClick={() => onEditGroup(group)}
                      className="bg-slate-900 text-white hover:bg-emerald-600 rounded-full w-9 h-9 transition-all shadow-md">
                      <PencilLine className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Excluir Extrato"
                      onClick={() => handleDeleteGroup(group)}
                      className="bg-slate-900 text-white hover:bg-rose-500 rounded-full w-9 h-9 transition-all shadow-md">
                      <Trash className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {isLoading && (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        )}
        {!isLoading && filteredGroups.length === 0 && (
          <div className="flex items-center justify-center p-12 mb-2">
            <div className="bg-slate-50 border border-slate-100 rounded-2xl px-10 py-6 text-slate-400 text-xs font-black uppercase tracking-widest shadow-inner">
              Nenhuma transação. Importe um extrato acima.
            </div>
          </div>
        )}
      </div>

      {/* Modal Download */}
      <Dialog open={isDownloadModalOpen} onOpenChange={setIsDownloadModalOpen}>
        <DialogContent className="sm:max-w-md bg-white border-slate-200 text-slate-800 shadow-2xl rounded-[2rem] p-8">
          <DialogHeader className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-4">
              <Download className="w-8 h-8" />
            </div>
            <DialogTitle className="text-2xl font-black text-slate-800 tracking-tighter">Exportar Extrato</DialogTitle>
            <p className="text-slate-400 text-sm font-medium mt-1">Escolha o formato ideal para enviar ao seu contador</p>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 mt-8">
            <button
              onClick={() => { handleExport(exportGroup, 'PDF'); setIsDownloadModalOpen(false); }}
              className="flex flex-col items-center gap-4 p-6 bg-slate-50 border border-slate-100 rounded-3xl hover:border-emerald-500 hover:bg-emerald-50 transition-all group"
            >
              <div className="p-3 bg-white border border-slate-200 rounded-xl group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                <Download className="w-6 h-6" />
              </div>
              <div>
                <p className="font-black text-slate-800 text-sm">Relatório PDF</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Refinado / Visual</p>
              </div>
            </button>

            <button
              onClick={() => { handleExport(exportGroup, 'XLSX'); setIsDownloadModalOpen(false); }}
              className="flex flex-col items-center gap-4 p-6 bg-slate-50 border border-slate-100 rounded-3xl hover:border-emerald-500 hover:bg-emerald-50 transition-all group"
            >
              <div className="p-3 bg-white border border-slate-200 rounded-xl group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                <LayoutDashboard className="w-6 h-6" />
              </div>
              <div>
                <p className="font-black text-slate-800 text-sm">Planilha XLSX</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Dados / Excel</p>
              </div>
            </button>
          </div>

          <div className="mt-6 text-center">
            <Button variant="ghost" onClick={() => setIsDownloadModalOpen(false)} className="text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-600">Cancelar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ========================================
// IMPORTAÇÃO VIEW
// ========================================

function ImportacaoView({ onSave, onBack, userId, initialGroup }: { onSave: () => void; onBack: () => void; userId: string | null; initialGroup?: any }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const [isNewCategoryModalOpen, setNewCategoryModalOpen] = useState(false);
  const [isManageCatsOpen, setManageCatsOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatType, setNewCatType] = useState("saida");
  const [isSaving, setIsSaving] = useState(false);
  const [fullCategories, setFullCategories] = useState<any[]>([]);
  const [registeredAccounts, setRegisteredAccounts] = useState<any[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedBank, setSelectedBank] = useState("Santander");
  const [selectedConta, setSelectedConta] = useState("PJ");
  const [catSearch, setCatSearch] = useState("");
  const [categorias, setCategorias] = useState({ entradas: [] as string[], saidas: [] as string[] });
  const [hasUnsavedDialogOpen, setHasUnsavedDialogOpen] = useState(false);

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
        }
      }
      setLoadingAccounts(false);
    }
    fetchAccounts();
  }, []);

  const loadCategories = async () => {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return;
    const { data, error } = await supabase.from('categories').select('*').eq('user_id', authData.user.id);
    if (data && !error) {
      setFullCategories(data);
      setCategorias({
        entradas: data.filter((c: any) => c.type === 'entrada').map((c: any) => c.name).sort(),
        saidas: data.filter((c: any) => c.type === 'saida').map((c: any) => c.name).sort()
      });
    }
  };

  useEffect(() => { loadCategories(); }, []);

  // Load initial group if editing
  useEffect(() => {
    if (initialGroup && userId) {
      const loadInitial = async () => {
        const { data } = await supabase.from('transactions')
          .select('*')
          .eq('user_id', userId)
          .eq('banco', initialGroup.bank)
          .eq('tipo_conta', initialGroup.tipo.replace('Conta ', ''))
          .order('created_at', { ascending: false });

        if (data && data.length > 0) {
          const dateKey = initialGroup.id.split('|').pop();
          const filtered = data.filter((t: any) => t.created_at.startsWith(dateKey));
          setTransactions(filtered.map((t: any) => ({
            id: t.id, date: t.data_transacao, desc: t.descricao,
            value: Number(t.valor), bank: t.banco, cat: t.categoria, ignored: t.ignorado
          })));
          setSelectedBank(initialGroup.bank);
          setSelectedConta(initialGroup.tipo.replace('Conta ', ''));
        }
      };
      loadInitial();
    }
  }, [initialGroup, userId]);

  // Warn before unload
  useEffect(() => {
    const handleUnload = (e: BeforeUnloadEvent) => {
      if (transactions.length > 0) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [transactions]);

  const handleIntentBack = () => {
    if (transactions.length > 0) {
      setHasUnsavedDialogOpen(true);
    } else {
      onBack();
    }
  };

  const handleFileUploadClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      let parsed: Transaction[] = [];
      const batchTimestamp = new Date().toISOString();

      if (file.name.toLowerCase().endsWith('.ofx')) {
        const text = await file.text();
        parsed = smartParseOFX(text, selectedBank);
      } else if (file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls')) {
        const XLSXLib = await import('xlsx');
        const buffer = await file.arrayBuffer();
        const workbook = XLSXLib.read(buffer);
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSXLib.utils.sheet_to_json(worksheet);
        parsed = smartParseXLSX(jsonData, selectedBank);
      } else {
        const text = await file.text();
        parsed = smartParseCSV(text, selectedBank);
      }

      if (parsed.length > 0) {
        parsed = parsed.map(t => ({ ...t, temp_timestamp: batchTimestamp }));

        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          const { data: existing } = await supabase.from('transactions')
            .select('data_transacao, valor, descricao')
            .eq('user_id', authData.user.id)
            .eq('banco', selectedBank);

          if (existing && existing.length > 0) {
            let duplicateCount = 0;
            const filteredParsed = parsed.filter(t => {
              const isDuplicate = existing.some(ex =>
                ex.data_transacao === t.date && Number(ex.valor) === t.value && ex.descricao === t.desc
              );
              if (isDuplicate) duplicateCount++;
              return !isDuplicate;
            });

            if (duplicateCount > 0) {
              if (filteredParsed.length === 0) {
                alert(`Todas as ${duplicateCount} transações deste extrato já foram importadas anteriormente.`);
                if (fileInputRef.current) fileInputRef.current.value = '';
                return;
              } else {
                alert(`Atenção: ${duplicateCount} transação(ões) já existentes foram removidas.`);
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
        alert("O extrato não possui dados válidos. Verifique se é um arquivo CSV, OFX ou XLSX bancário.");
      }
    } catch (err) {
      alert('Erro ao ler arquivo: ' + (err as Error).message);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCategoryChange = (val: string | null, id: string) => {
    if (!val) return;
    if (val === "MANAGE_CATEGORIES") { setManageCatsOpen(true); return; }
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, cat: val } : t));
  };

  const clearCategory = (id: string) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, cat: undefined } : t));
  };

  const toggleIgnore = (id: string) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, ignored: !t.ignored } : t));
  };

  const submitToDatabase = async () => {
    if (transactions.length === 0) return onSave();
    setIsSaving(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) throw new Error("Não autenticado");

      const payload = transactions.map(t => ({
        user_id: authData.user.id,
        banco: selectedBank,
        tipo_conta: selectedConta,
        data_transacao: t.date,
        descricao: t.desc,
        valor: t.value,
        categoria: t.cat || null,
        ignorado: t.ignored,
        status: (!!t.cat || t.ignored) ? 'Conciliado' : 'Pendente',
        created_at: t.temp_timestamp || new Date().toISOString()
      }));

      const { error } = await supabase.from('transactions').insert(payload);
      if (error) throw error;
      onSave();
    } catch (err) {
      alert("Erro: " + (err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNewCategory = async () => {
    const normalized = newCatName.trim();
    if (!normalized) return;
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) return;
    const { error } = await supabase.from('categories').insert({ name: normalized, type: newCatType, user_id: authData.user.id });
    if (!error) { setNewCatName(""); setNewCategoryModalOpen(false); loadCategories(); }
    else alert("Erro ao salvar: " + error.message);
  };

  const handleEditCategory = async (cat: any) => {
    const newName = prompt("Novo nome para a categoria:", cat.name);
    if (!newName || newName === cat.name) return;
    const { error } = await supabase.from('categories').update({ name: newName }).eq('id', cat.id);
    if (!error) loadCategories();
    else alert("Erro ao editar: " + error.message);
  };

  const handleDeleteCategory = async (cat: any) => {
    if (!confirm(`Deseja excluir a categoria "${cat.name}"?`)) return;
    const { error } = await supabase.from('categories').delete().eq('id', cat.id);
    if (!error) loadCategories();
    else alert("Erro ao excluir: " + error.message);
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl w-full mx-auto pb-20">

      {/* Modal Nova Categoria */}
      <Dialog open={isNewCategoryModalOpen} onOpenChange={setNewCategoryModalOpen}>
        <DialogContent className="sm:max-w-md bg-white border-slate-200 text-slate-800 shadow-2xl rounded-2xl">
          <DialogHeader><DialogTitle className="text-slate-800 font-black">Nova Categoria</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-500">Nome da Categoria</label>
              <input type="text" value={newCatName} onChange={e => setNewCatName(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-semibold"
                placeholder="Ex: Combustível" />
            </div>
            <div className="flex gap-6 pt-2 pb-2">
              <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-slate-700">
                <input type="radio" name="cat_tipo" value="entrada" checked={newCatType === "entrada"} onChange={e => setNewCatType(e.target.value)} className="accent-emerald-500 w-4 h-4 cursor-pointer" /> Entrada
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-slate-700">
                <input type="radio" name="cat_tipo" value="saida" checked={newCatType === "saida"} onChange={e => setNewCatType(e.target.value)} className="accent-rose-500 w-4 h-4 cursor-pointer" /> Saída
              </label>
            </div>
            <Button onClick={handleSaveNewCategory} className="w-full mt-2 font-bold bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl h-11">Salvar Categoria</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Gerenciar Categorias */}
      <Dialog open={isManageCatsOpen} onOpenChange={setManageCatsOpen}>
        <DialogContent className="sm:max-w-xl bg-white border-slate-200 text-slate-800 shadow-2xl rounded-2xl max-h-[80vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 border-b border-slate-50">
            <DialogTitle className="text-slate-800 font-black flex justify-between items-center">
              Gerenciar Categorias
              <Button onClick={() => { setManageCatsOpen(false); setNewCategoryModalOpen(true); }} className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 font-bold h-8 text-[10px] tracking-widest px-3">➕ NOVA</Button>
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto p-6 space-y-8 flex-1">
            <div>
              <h4 className="text-[10px] font-black text-emerald-500 tracking-widest uppercase mb-4">Categorias de Entrada</h4>
              <div className="grid grid-cols-1 gap-2">
                {fullCategories.filter(c => c.type === 'entrada').map(c => (
                  <div key={c.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100 group">
                    <span className="font-bold text-slate-700">{c.name}</span>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" onClick={() => handleEditCategory(c)} className="h-8 w-8 text-slate-400 hover:text-emerald-600 hover:bg-white"><PencilLine className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteCategory(c)} className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-white"><Trash className="w-4 h-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-[10px] font-black text-rose-500 tracking-widest uppercase mb-4">Categorias de Saída</h4>
              <div className="grid grid-cols-1 gap-2">
                {fullCategories.filter(c => c.type === 'saida').map(c => (
                  <div key={c.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100 group">
                    <span className="font-bold text-slate-700">{c.name}</span>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" onClick={() => handleEditCategory(c)} className="h-8 w-8 text-slate-400 hover:text-emerald-600 hover:bg-white"><PencilLine className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteCategory(c)} className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-white"><Trash className="w-4 h-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Confirmação de Saída */}
      <Dialog open={hasUnsavedDialogOpen} onOpenChange={setHasUnsavedDialogOpen}>
        <DialogContent className="sm:max-w-sm bg-white rounded-2xl shadow-2xl">
          <DialogHeader><DialogTitle className="text-slate-800 font-black">Sair sem salvar?</DialogTitle></DialogHeader>
          <p className="text-slate-500 text-sm">Há transações não salvas. Deseja sair e perder as alterações?</p>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setHasUnsavedDialogOpen(false)} className="flex-1">Cancelar</Button>
            <Button onClick={onBack} className="flex-1 bg-rose-500 hover:bg-rose-600 text-white">Sair</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={handleIntentBack}
          className="text-slate-500 hover:text-slate-800 bg-white border border-slate-200 hover:border-slate-300 shadow-sm rounded-full w-9 h-9">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tighter">Importação de arquivo</h1>
          <p className="text-slate-400 text-xs font-bold mt-1 tracking-wide">Realize a leitura inteligente do extrato bancário</p>
        </div>
      </div>

      {/* Upload Card */}
      <Card className="bg-white shadow-sm border border-slate-200 rounded-2xl">
        <CardContent className="pt-6 pb-6 flex flex-col md:flex-row items-center gap-6">
          {/* Upload area */}
          <div
            className="flex items-center gap-4 cursor-pointer hover:bg-emerald-50/50 transition-all flex-1 bg-white p-5 border-2 border-dashed border-emerald-400/40 rounded-2xl"
            onClick={handleFileUploadClick}
          >
            <div className="p-3 bg-emerald-50 text-emerald-500 rounded-xl">
              <Upload className="w-7 h-7" />
            </div>
            <div>
              <h2 className="font-extrabold text-slate-800 text-lg tracking-tight">Upload do Arquivo</h2>
              <p className="text-xs font-medium text-slate-400 mt-0.5">Escolha um extrato em `.csv` ou `.ofx`. A IA lerá tudo instantaneamente.</p>
            </div>
          </div>
          <input ref={fileInputRef} type="file" className="hidden" accept=".csv,.ofx,.xlsx,.xls" onChange={handleFileChange} />

          {/* Bank/Account Selectors */}
          <div className="flex items-center gap-4 shrink-0">
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Banco Origem</span>
              <Select value={selectedBank} onValueChange={(v) => {
                const val = v || "";
                setSelectedBank(val);
                const acc = registeredAccounts.find((a: any) => a.name === val);
                if (acc) setSelectedConta(acc.type || "PJ");
              }}>
                <SelectTrigger className="w-[170px] bg-white border-slate-200 text-slate-700 h-10 font-semibold rounded-xl">
                  <SelectValue placeholder="Escolha a Conta" />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200 rounded-xl">
                  {registeredAccounts.map((acc: any) => (
                    <SelectItem key={acc.id} value={acc.name} className="font-semibold text-slate-700">
                      {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Identificação</span>
              <div className="h-10 px-6 flex items-center justify-center bg-slate-50 text-emerald-600 border border-slate-200 rounded-xl font-black text-sm tracking-widest min-w-[60px]">
                {selectedConta.toUpperCase()}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <div className="mt-2">
        {transactions.length > 0 && (
          <h2 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-4 tracking-tighter">
            <Badge className="bg-emerald-500 text-white font-black rounded-lg h-6 px-2">{transactions.length}</Badge> Transações Lidas pelo Sistema
          </h2>
        )}

        {transactions.length > 0 && (
          <>
            <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white flex flex-col shadow-xl">
              <table className="w-full text-sm text-left text-slate-700">
                <thead className="bg-[#FAFBFD] border-b border-slate-100">
                  <tr className="text-left">
                    <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest w-10 text-center">OK</th>
                    <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[100px]">Data</th>
                    <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Descrição</th>
                    <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right w-[140px]">Valor (R$)</th>
                    <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[240px]">Categoria</th>
                    <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-[120px]">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => {
                    const isChecked = !!t.cat || t.ignored;
                    return (
                      <tr key={t.id} className={`border-b border-slate-50 transition-colors ${t.ignored ? 'opacity-30 grayscale bg-slate-50' : 'hover:bg-slate-50/50'} ${isChecked && !t.ignored ? 'bg-emerald-50/30' : ''}`}>
                        <td className="px-4 py-4 text-center">
                          <input type="checkbox" checked={isChecked} readOnly className="accent-emerald-500 w-4 h-4 cursor-not-allowed opacity-80" />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-slate-400 font-bold text-xs">{t.date}</td>
                        <td className="px-4 py-4 font-bold text-slate-800" title={t.desc}>{t.desc}</td>
                        <td className={`px-4 py-4 font-black whitespace-nowrap text-right ${t.value > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                          {formatCurrency(t.value)}
                        </td>
                        <td className="px-4 py-4">
                          <Select value={t.cat || ""} onValueChange={(val) => handleCategoryChange(val, t.id)} disabled={isChecked && !t.ignored}>
                            <SelectTrigger className={`w-full bg-white border-slate-200 font-bold rounded-xl shadow-sm transition-all h-10 ${t.value > 0 ? 'text-emerald-600' : 'text-rose-600'} disabled:opacity-100 focus:ring-emerald-500`}>
                              <SelectValue placeholder="Selecionar Categoria" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px] bg-white border-slate-200 rounded-xl shadow-2xl p-0 overflow-hidden">
                              <div className="p-2 sticky top-0 bg-white z-20 border-b border-slate-50">
                                <Input
                                  placeholder="🔍 Buscar..."
                                  value={catSearch}
                                  onChange={(e) => setCatSearch(e.target.value)}
                                  onKeyDown={(e) => e.stopPropagation()}
                                  className="h-8 text-[10px] font-bold border-slate-100 focus:ring-emerald-500 bg-slate-50"
                                />
                              </div>
                              <div className="overflow-y-auto max-h-[250px]">
                                {t.value >= 0 ? (
                                  <SelectGroup>
                                    <SelectLabel className="text-emerald-400 tracking-widest uppercase text-[10px] px-2 py-1.5">Entradas</SelectLabel>
                                    {categorias.entradas
                                      .filter(c => c.toLowerCase().includes(catSearch.toLowerCase()))
                                      .map(c => <SelectItem key={c} value={c} className="font-bold text-slate-700">{c}</SelectItem>)
                                    }
                                    {categorias.entradas.filter(c => c.toLowerCase().includes(catSearch.toLowerCase())).length === 0 && (
                                      <div className="px-2 py-4 text-[10px] text-slate-400 font-bold text-center italic">Nenhuma encontrada</div>
                                    )}
                                  </SelectGroup>
                                ) : (
                                  <SelectGroup>
                                    <SelectLabel className="text-rose-400 tracking-widest uppercase text-[10px] px-2 py-1.5">Saídas</SelectLabel>
                                    {categorias.saidas
                                      .filter(c => c.toLowerCase().includes(catSearch.toLowerCase()))
                                      .map(c => <SelectItem key={c} value={c} className="font-bold text-slate-700">{c}</SelectItem>)
                                    }
                                    {categorias.saidas.filter(c => c.toLowerCase().includes(catSearch.toLowerCase())).length === 0 && (
                                      <div className="px-2 py-4 text-[10px] text-slate-400 font-bold text-center italic">Nenhuma encontrada</div>
                                    )}
                                  </SelectGroup>
                                )}
                                <div className="h-px bg-slate-50 my-1" />
                                <SelectItem value="MANAGE_CATEGORIES" className="text-emerald-600 font-black text-[10px] tracking-widest uppercase">⚙ Gerenciar Categorias</SelectItem>
                              </div>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex justify-center gap-3">
                            <span title="Limpar Categoria" className="p-2 bg-slate-100 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg cursor-pointer transition-all" onClick={() => clearCategory(t.id)}>
                              <PencilLine className="w-4 h-4" />
                            </span>
                            <span title={t.ignored ? "Restaurar Linha" : "Ignorar p/ Cálculo"} className={`p-2 rounded-lg cursor-pointer transition-all ${t.ignored ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-400 hover:text-rose-500 hover:bg-rose-50'}`} onClick={() => toggleIgnore(t.id)}>
                              <Ban className="w-4 h-4" />
                            </span>
                            <span title="Excluir Transação" className="p-2 bg-slate-100 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-all" onClick={() => {
                              if (confirm("Remover esta transação do extrato?")) {
                                setTransactions(prev => prev.filter(item => item.id !== t.id));
                              }
                            }}>
                              <Trash className="w-4 h-4" />
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end mt-4">
              <Button
                onClick={submitToDatabase}
                disabled={isSaving}
                className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-10"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : '✔'} Salvar
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
