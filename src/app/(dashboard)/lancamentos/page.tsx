"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, Search, Trash, PencilLine, ArrowLeft, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import * as XLSX from "xlsx";

// ========================================
// TIPOS
// ========================================

interface Transaction {
  id: string;
  date: string;
  desc: string;
  value: number;
  bank: string;
  cat?: string;
  ignored: boolean;
  import_batch_id: string;
}

interface Group {
  id: string;
  date: string;
  bank: string;
  tipo: string;
  minDate: string;
  maxDate: string;
  conc: number;
  ign: number;
  pend: number;
  total: number;
  status: string;
  batchId: string;
  period: string;
}

// ========================================
// FUNÇÕES AUXILIARES
// ========================================

function generateImportBatchId(): string {
  return `batch_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function parseFlexibleDate(dateValue: any): string | null {
  const str = dateValue.toString().trim();
  
  const formats = [
    { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, group: [1, 2, 3] },
    { regex: /^(\d{4})-(\d{1,2})-(\d{1,2})$/, group: [3, 2, 1] },
    { regex: /^(\d{1,2})-(\d{1,2})-(\d{4})$/, group: [1, 2, 3] }
  ];

  for (const fmt of formats) {
    const match = str.match(fmt.regex);
    if (match) {
      const day = String(parseInt(match[fmt.group[0]])).padStart(2, '0');
      const month = String(parseInt(match[fmt.group[1]])).padStart(2, '0');
      const year = match[fmt.group[2]];
      
      const d = new Date(`${year}-${month}-${day}`);
      if (!isNaN(d.getTime())) {
        return `${day}/${month}/${year}`;
      }
    }
  }

  return null;
}

function smartParseXLSX(arrayBuffer: ArrayBuffer, bankName: string): Transaction[] {
  try {
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    if (jsonData.length === 0) return [];

    const firstRow = jsonData[0] as Record<string, any>;
    const colNames = Object.keys(firstRow).map(k => k.toLowerCase().trim());

    const dataColName = colNames.find(name =>
      ['data', 'date', 'data_transacao', 'transaction date'].includes(name)
    );
    const descColName = colNames.find(name =>
      ['descrição', 'description', 'desc', 'histórico', 'memo'].includes(name)
    );
    const valorColName = colNames.find(name =>
      ['valor', 'value', 'amount', 'montant', 'cifra'].includes(name)
    );

    if (!dataColName || !descColName || !valorColName) {
      throw new Error('Colunas obrigatórias não encontradas. Use: Data, Descrição, Valor');
    }

    const batchId = generateImportBatchId();
    const results: Transaction[] = [];

    jsonData.forEach((row: any, idx: number) => {
      const dateStr = row[dataColName];
      const description = row[descColName];
      const valueStr = row[valorColName];

      if (!dateStr || !description || !valueStr) return;

      const parsedDate = parseFlexibleDate(dateStr);
      if (!parsedDate) {
        console.warn(`Data inválida na linha ${idx + 1}: ${dateStr}`);
        return;
      }

      const value = parseFloat(
        valueStr
          .toString()
          .replace(/[^\d,.-]/g, '')
          .replace(/\./g, '')
          .replace(',', '.')
      );

      if (isNaN(value)) {
        console.warn(`Valor inválido na linha ${idx + 1}: ${valueStr}`);
        return;
      }

      results.push({
        id: `tx_${batchId}_${idx}_${Date.now()}`,
        date: parsedDate,
        desc: description.toString().substring(0, 150),
        value,
        bank: bankName,
        ignored: false,
        import_batch_id: batchId
      });
    });

    // Ordenação estável por data
    results.sort((a, b) => {
      const dateA = new Date(a.date.split('/').reverse().join('-'));
      const dateB = new Date(b.date.split('/').reverse().join('-'));
      return dateA.getTime() - dateB.getTime();
    });

    return results;
  } catch (err) {
    console.error('[XLSX Parse Error]', err);
    throw new Error('Erro ao ler arquivo XLSX. Verifique o formato.');
  }
}

function smartParseOFX(ofxText: string, bankName: string): Transaction[] {
  const results: Transaction[] = [];
  const batchId = generateImportBatchId();
  const trnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g;
  let match;

  while ((match = trnRegex.exec(ofxText)) !== null) {
    const block = match[1];

    const amtMatch = block.match(/<TRNAMT>([-\d.]+)/);
    const tVal = amtMatch ? parseFloat(amtMatch[1]) : 0;

    const dtMatch = block.match(/<DTPOSTED>(\d{4})(\d{2})(\d{2})/);
    let tDate = "";
    if (dtMatch) {
      tDate = `${dtMatch[3]}/${dtMatch[2]}/${dtMatch[1]}`;
    }

    const memoMatch = block.match(/<MEMO>([^<]+)/) || block.match(/<NAME>([^<]+)/);
    const tDesc = memoMatch ? memoMatch[1].trim().substring(0, 100) : "Transação Bancária OFX";

    if (tVal !== 0 && tDate) {
      results.push({
        id: `tx_${batchId}_${Math.random().toString(36).substring(2, 9)}`,
        date: tDate,
        desc: tDesc,
        value: tVal,
        bank: bankName,
        ignored: false,
        import_batch_id: batchId
      });
    }
  }

  return results;
}

function downloadTemplateXLSX() {
  const templateData = [
    ['Data', 'Descrição', 'Valor'],
    ['01/04/2026', 'Venda de Produto', 1500.00],
    ['02/04/2026', 'Aluguel do Escritório', -3000.00],
    ['03/04/2026', 'Cashback Cartão', 125.50],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(templateData);
  worksheet['!cols'] = [{ wch: 15 }, { wch: 40 }, { wch: 15 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Transações');

  XLSX.writeFile(workbook, `template_fincontrol_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// ========================================
// MAIN PAGE
// ========================================

export default function LancamentosPage() {
  const [view, setView] = useState<"conciliacao" | "importacao">("conciliacao");
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
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
  const [filterStatus, setFilterStatus] = useState<string | null>("Todos");

  const loadData = async () => {
    setIsLoading(true);
    const supabase = createClient();

    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) {
      setIsLoading(false);
      return;
    }

    const { data: txs, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', authData.user.id)
      .order('created_at', { ascending: false });

    if (txs && !error) {
      const groupsMap: Record<string, Group> = {};

      txs.forEach((t: any) => {
        const batchId = t.import_batch_id || `legacy_${t.banco}_${t.tipo_conta}_${t.created_at.split('T')[0]}`;

        if (!groupsMap[batchId]) {
          groupsMap[batchId] = {
            id: batchId,
            date: new Date(t.created_at).toLocaleDateString('pt-BR'),
            bank: t.banco,
            tipo: `Conta ${t.tipo_conta}`,
            minDate: t.data_transacao,
            maxDate: t.data_transacao,
            conc: 0,
            ign: 0,
            pend: 0,
            total: 0,
            status: "Pendente",
            batchId: batchId,
            period: ""
          };
        } else {
          if (t.data_transacao < groupsMap[batchId].minDate) {
            groupsMap[batchId].minDate = t.data_transacao;
          }
          if (t.data_transacao > groupsMap[batchId].maxDate) {
            groupsMap[batchId].maxDate = t.data_transacao;
          }
        }

        groupsMap[batchId].total++;
        if (t.ignorado) groupsMap[batchId].ign++;
        else if (t.status === 'Conciliado') groupsMap[batchId].conc++;
        else groupsMap[batchId].pend++;
      });

      const processed = Object.values(groupsMap).map((g: Group) => {
        if (g.pend === 0 && g.conc > 0) g.status = "Conciliado";
        else if (g.conc > 0 && g.pend > 0) g.status = "Parcial";

        if (g.minDate && g.maxDate) {
          const parseF = (s: string) => {
            if (!s) return "";
            s = s.split('T')[0].split(' ')[0];
            if (s.includes('-')) {
              const pts = s.split('-');
              if (pts[0].length === 4) {
                const year = pts[0].slice(-2);
                return `${pts[2]}/${pts[1]}/${year}`;
              }
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

  useEffect(() => {
    loadData();
  }, []);

  const handleDeleteGroup = async (group: Group) => {
    if (!window.confirm(`Tem certeza que deseja excluir este lote?`)) return;

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('import_batch_id', group.batchId);

      if (error) {
        alert('Erro ao excluir: ' + error.message);
      } else {
        setDbGroups(prev => prev.filter(g => g.id !== group.id));
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir as transações.');
    }
  };

  const filteredGroups = dbGroups.filter(g => {
    const matchStatus = filterStatus === "Todos" || g.status.toLowerCase() === filterStatus.toLowerCase();
    return matchStatus;
  });

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto pb-10">
      <div className="bg-white rounded-2xl p-6 border-b-4 border-b-emerald-500 flex justify-between items-center shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tighter">Arquivos de conciliação</h1>
          <p className="text-slate-400 text-xs font-bold mt-1 tracking-wide">Gerencie suas importações bancárias</p>
        </div>
        <Button onClick={onImportar} className="bg-emerald-500 hover:bg-emerald-600 shadow-md font-bold text-white rounded-xl h-11 px-6">
          Importar Extrato
        </Button>
      </div>

      <div className="flex items-end gap-4 text-sm">
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</label>
          <Select value={filterStatus} onValueChange={(value: string | null) => setFilterStatus(value)}>
  ...
</Select>
            <SelectTrigger className="w-[140px] bg-white border-slate-200 h-10 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="Todos">Todos</SelectItem>
              <SelectItem value="Pendente">Pendentes</SelectItem>
              <SelectItem value="Parcial">Parciais</SelectItem>
              <SelectItem value="Conciliado">Conciliados</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-xl">
        <table className="w-full text-sm text-left text-slate-700">
          <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 border-b">
            <tr>
              <th className="px-6 py-5 w-[140px]">Status</th>
              <th className="px-6 py-5">DATA IMPORTAÇÃO</th>
              <th className="px-6 py-5">Banco</th>
              <th className="px-6 py-5">Tipo Conta</th>
              <th className="px-6 py-5 min-w-[160px] text-center">Período</th>
              <th className="px-6 py-5 text-center">Conciliados</th>
              <th className="px-6 py-5 text-center">Pendentes</th>
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
                <td className="px-6 py-4 text-[10px] font-black text-emerald-600">
                  CONTA {group.tipo.replace('Conta ', '')}
                </td>
                <td className="px-6 py-4 text-center font-bold text-slate-700">{group.period}</td>
                <td className="px-6 py-4 text-center">
                  <span className="text-emerald-600 font-bold">{group.conc}</span> / {group.total}
                </td>
                <td className="px-6 py-4 text-center">
                  {group.pend > 0 ? (
                    <span className="bg-rose-100 text-rose-600 px-3 py-1 rounded-full text-[10px] font-black">
                      {group.pend}
                    </span>
                  ) : (
                    <span className="text-slate-300">-</span>
                  )}
                </td>
                <td className="px-6 py-4 text-center flex justify-center gap-2">
                  <span
                    className="cursor-pointer p-2 hover:bg-emerald-500 hover:text-white rounded transition"
                    onClick={() => onEditGroup(group)}
                  >
                    <PencilLine className="w-4 h-4" />
                  </span>
                  <span
                    className="cursor-pointer p-2 hover:bg-rose-500 hover:text-white rounded transition"
                    onClick={() => handleDeleteGroup(group)}
                  >
                    <Trash className="w-4 h-4" />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ========================================
// IMPORTAÇÃO VIEW
// ========================================

function ImportacaoView({ 
  onSave, 
  onBack, 
  userId 
}: { 
  onSave: () => void; 
  onBack: () => void; 
  userId: string | null; 
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedBank, setSelectedBank] = useState("Santander");
  const [selectedConta, setSelectedConta] = useState("PJ");
  const [isSaving, setIsSaving] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      let parsed: Transaction[] = [];

      if (file.name.toLowerCase().endsWith('.xlsx')) {
        parsed = smartParseXLSX(arrayBuffer, selectedBank);
      } else if (file.name.toLowerCase().endsWith('.ofx')) {
        const text = await file.text();
        parsed = smartParseOFX(text, selectedBank);
      }

      if (parsed.length > 0) {
        setTransactions(parsed);
      }
    } catch (err) {
      alert('Erro ao ler arquivo: ' + (err as Error).message);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeleteTransaction = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
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
        status: t.cat ? 'Conciliado' : 'Pendente',
        import_batch_id: t.import_batch_id
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

  return (
    <div className="flex flex-col gap-6 max-w-6xl w-full mx-auto pb-20">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack} className="text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Importação de arquivo</h1>
        </div>
      </div>

      <Card className="bg-white border-slate-200 shadow-xl rounded-2xl">
        <CardContent className="pt-6 pb-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div
            className="flex items-center gap-4 cursor-pointer flex-1 bg-slate-50 p-4 border border-dashed border-emerald-500/40 rounded-xl"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-8 h-8 text-emerald-600" />
            <div>
              <h2 className="font-bold text-emerald-600 text-xl">Upload</h2>
              <p className="text-sm text-slate-500">Escolha .xlsx ou .ofx</p>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".xlsx,.ofx"
            onChange={handleFileChange}
          />
          <Button
            onClick={downloadTemplateXLSX}
            variant="outline"
            className="border-emerald-500 text-emerald-600"
          >
            📥 Template
          </Button>
        </CardContent>
      </Card>

      {transactions.length > 0 && (
        <>
          <h2 className="text-lg font-bold text-emerald-600 flex items-center gap-2">
            <Search className="w-4 h-4" /> {transactions.length} Transações
          </h2>

          <div className="border border-slate-200 rounded-2xl overflow-x-auto bg-white shadow-xl">
            <table className="w-full text-sm text-left text-slate-700">
              <thead className="text-[10px] text-slate-400 font-black bg-slate-50 border-b">
                <tr>
                  <th className="px-4 py-4 w-[100px]">Data</th>
                  <th className="px-4 py-4 flex-grow min-w-[300px]">Descrição</th>
                  <th className="px-4 py-4 min-w-[120px]">Valor</th>
                  <th className="px-4 py-4 min-w-[80px] text-center">Deletar</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">{t.date}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800 truncate" title={t.desc}>
                      {t.desc}
                    </td>
                    <td className={`px-4 py-3 font-bold whitespace-nowrap ${t.value > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      R$ {Math.abs(t.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className="cursor-pointer text-slate-400 hover:text-rose-600"
                        onClick={() => handleDeleteTransaction(t.id)}
                      >
                        <Trash className="w-4 h-4" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
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
  );
}
