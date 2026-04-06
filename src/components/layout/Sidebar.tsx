"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FileText, LayoutDashboard, Plus, Edit2, Check, X, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";

type BankAccount = { id: string, name: string, type: string, agency: string, account: string };

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Form states
  const [tipo, setTipo] = useState("pf");
  const [bankName, setBankName] = useState("Caixa");
  const [agency, setAgency] = useState("");
  const [account, setAccount] = useState("");

  const supabase = createClient();

  useEffect(() => {
    setMounted(true);
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return;

    const { data, error } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('user_id', authData.user.id);
    
    if (data && !error) {
       setAccounts(data.map((a: any) => ({
         id: a.id,
         name: a.name,
         type: a.type,
         agency: a.agency,
         account: a.account
       })));
    } else {
       const saved = localStorage.getItem("@fincontrol_accounts");
       if (saved) setAccounts(JSON.parse(saved));
    }
  };

  const saveToSupabase = async (newAccount: Omit<BankAccount, 'id'>) => {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return;

    const { error } = await supabase.from('bank_accounts').insert([{
      ...newAccount,
      user_id: authData.user.id
    }]);

    if (!error) {
       loadAccounts();
       alert("Conta bancária cadastrada com sucesso!");
    } else {
       alert("Erro ao cadastrar conta: " + error.message);
    }
  };

  const updateAccount = async (id: string, updated: Omit<BankAccount, 'id'>) => {
    const { error } = await supabase.from('bank_accounts').update(updated).eq('id', id);
    if (!error) {
      loadAccounts();
    } else {
      alert("Erro ao atualizar conta no banco: " + error.message);
    }
  };

  const deleteFromSupabase = async (id: string) => {
    const { error } = await supabase.from('bank_accounts').delete().eq('id', id);
    if (!error) {
      loadAccounts();
    } else {
      alert("Erro ao excluir conta no banco: " + error.message);
    }
  };

  const handleSaveAccount = () => {
    if (!bankName || !agency || !account) return;

    if (editingId) {
      updateAccount(editingId, { name: bankName, type: tipo, agency, account });
      setEditingId(null);
    } else {
      saveToSupabase({ name: bankName, type: tipo, agency, account });
    }

    setIsOpen(false);
    resetForm();
  };

  const handleDeleteAccount = (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta conta?")) {
       deleteFromSupabase(id);
       setIsOpen(false);
    }
  };

  const resetForm = () => {
    setTipo("pf");
    setBankName("Caixa");
    setAgency("");
    setAccount("");
    setEditingId(null);
  };

  const openEdit = (acc: BankAccount) => {
    setTipo(acc.type);
    setBankName(acc.name);
    setAgency(acc.agency);
    setAccount(acc.account);
    setEditingId(acc.id);
    setIsOpen(true);
  };

  const handleNavigation = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    // Intercepta navegação Next.js para proteger contra perda de progresso
    // @ts-ignore
    if (window.hasUnsavedChanges) {
      const confirmLeave = window.confirm("Você tem Lançamentos não salvos!\nSe você sair desta tela, todo o progresso atual será perdido.\nCancele e clique em 'Salvar Rascunho' caso queira continuar depois.\n\nDeseja descartar as alterações e sair?");
      if (!confirmLeave) {
        e.preventDefault();
      }
    }
  };

  const navItems = [
    { name: "Lançamentos", path: "/lancamentos", icon: <FileText className="w-4 h-4" />, subtitle: "Fluxo de Caixa" },
    { name: "Dashboard Tributário", path: "/dashboard", icon: <LayoutDashboard className="w-4 h-4" />, subtitle: "Os Cálculos" },
  ];

  if (!mounted) return null;

  return (
    <aside className="w-64 bg-white border-r border-slate-100 flex flex-col h-full shrink-0">
      {/* Logo Area */}
      <div className="bg-white w-full py-8 mt-4 flex items-center justify-center relative border-b border-slate-50 shrink-0">
         <img src="/logo.png" alt="FinControl" className="w-[180px] object-contain" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-4 mt-8">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              href={item.path}
              onClick={(e) => handleNavigation(e, item.path)}
              className={`flex items-start gap-4 px-5 py-3.5 mx-3 rounded-[1.2rem] transition-all ${isActive ? 'bg-emerald-50 text-emerald-600 shadow-sm' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'}`}
            >
              <div className="mt-1">{item.icon}</div>
              <div className="flex flex-col">
                <span className="text-[13px] font-black">{item.name}</span>
                <span className={`text-[10px] uppercase tracking-widest ${isActive ? 'text-emerald-500/70' : 'text-slate-300'}`}>{item.subtitle}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Footer / Contas Configuradas */}
      <div className="p-6 mt-auto border-t border-slate-100 bg-white">
        <div className="flex justify-between items-center mb-4">
           <h3 className="text-[10px] font-black text-slate-400 tracking-[0.2em] uppercase">Contas Configuradas</h3>
           <Dialog open={isOpen} onOpenChange={(val) => { setIsOpen(val); if(!val) resetForm(); }}>
             <DialogTrigger className="text-primary hover:text-primary/70 bg-primary/10 p-1.5 rounded-md transition-colors" title="Nova Conta" onClick={resetForm}>
                 <Plus className="w-4 h-4" />
             </DialogTrigger>
             <DialogContent className="sm:max-w-md bg-white border-slate-200 text-slate-800 shadow-xl rounded-2xl">
               <DialogHeader>
                 <DialogTitle className="text-slate-800 font-black">{editingId ? "Editar Conta Bancária" : "Nova Conta Bancária"}</DialogTitle>
               </DialogHeader>
               <div className="space-y-4 pt-4">
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-slate-700">
                    <input type="radio" name="tipo" value="pf" checked={tipo === 'pf'} onChange={e => setTipo(e.target.value)} className="accent-primary w-4 h-4" /> CONTA PF
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-slate-700">
                    <input type="radio" name="tipo" value="pj" checked={tipo === 'pj'} onChange={e => setTipo(e.target.value)} className="accent-primary w-4 h-4" /> CONTA PJ
                  </label>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-500">Banco</label>
                  <select value={bankName} onChange={e => setBankName(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm text-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all">
                    <option>Banco do Brasil</option>
                    <option>Caixa</option>
                    <option>Itaú</option>
                    <option>Bradesco</option>
                    <option>Santander</option>
                    <option>Inter</option>
                    <option>Mercado Pago</option>
                    <option>Nubank</option>
                  </select>
                </div>
                 <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1.5">
                     <label className="text-sm font-semibold text-slate-500">Agência</label>
                     <input type="text" value={agency} onChange={e=>setAgency(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all" placeholder="0000" />
                   </div>
                   <div className="space-y-1.5">
                     <label className="text-sm font-semibold text-slate-500">Conta Corrente/Poupança</label>
                     <input type="text" value={account} onChange={e=>setAccount(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all" placeholder="00000-0" />
                   </div>
                 </div>
                 <div className="flex justify-between items-center mt-6">
                   {editingId ? (
                      <button type="button" onClick={() => handleDeleteAccount(editingId)} className="text-rose-500 hover:text-rose-400 text-sm font-bold flex items-center gap-2 px-3">
                         <Trash2 className="w-4 h-4" /> Excluir
                      </button>
                   ) : <div />}
                   <button type="button" onClick={handleSaveAccount} className="bg-emerald-500 text-white font-bold p-2.5 px-6 rounded-xl hover:bg-emerald-600 transition-colors shadow-md">
                     {editingId ? "Atualizar Conta" : "Cadastrar Nova Conta"}
                   </button>
                 </div>
               </div>
             </DialogContent>
           </Dialog>
        </div>
        
        <div className="space-y-3">
          {accounts.map(acc => (
            <div key={acc.id} className="flex justify-between items-center text-sm group hover:bg-slate-50 p-1.5 -mx-1.5 rounded-lg transition-colors cursor-default border border-transparent hover:border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-white border border-slate-100 rounded-lg flex items-center justify-center p-0.5 shadow-sm">
                  {/* Ícones dinâmicos pelo nome do banco adaptáveis */}
                  <img src={`/logos/${acc.name.toLowerCase().replace(' ', '').replace('ô', 'o')}.png`} alt={acc.name} className="w-5 h-5 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement!.innerHTML = '<span class="text-xs font-bold text-slate-800">' + acc.name.substring(0,2).toUpperCase() + '</span>'; }} />
                </div>
                <div className="flex flex-col">
                  <span className="text-slate-700 font-extrabold text-[11px] truncate max-w-[100px]">{acc.name}</span>
                  <span className="text-[9px] font-semibold text-slate-400 tracking-wider">{acc.agency} | {acc.account}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <span className={`font-bold text-[10px] px-1.5 py-0.5 rounded uppercase ${acc.type === 'pf' ? 'text-emerald-400 bg-emerald-400/10' : 'text-blue-400 bg-blue-400/10'}`}>{acc.type}</span>
                <button onClick={() => openEdit(acc)} className="text-slate-500 hover:text-primary transition-all pb-0.5" title="Editar">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
          {accounts.length === 0 && (
             <p className="text-xs text-slate-500 text-center italic mt-4">Nenhuma conta cadastrada</p>
          )}
        </div>
      </div>
    </aside>
  );
}
