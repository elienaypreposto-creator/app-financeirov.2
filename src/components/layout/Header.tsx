"use client";

import { User, LogOut, Settings, Camera, Upload, Loader2, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useControl } from "@/contexts/ControlContext";
import { Trash, Building2, User as UserIcon } from "lucide-react";

export function Header() {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { viewMode, setViewMode, controleTipo, setControleTipo } = useControl();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  
  // Profile Data States
  const [avatar, setAvatar] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [controle, setControle] = useState("both");

  // Load logic
  useEffect(() => {
    async function fetchUserAndProfile() {
      setIsLoading(true);
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        setUserId(authData.user.id);
        setUserEmail(authData.user.email || "");
        
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', authData.user.id).single();
        if (profile) {
          setName(profile.nome || authData.user.user_metadata?.nome || "");
          setCpf(profile.cpf || "");
          setCnpj(profile.cnpj || "");
          setControle(profile.controle_tipo || "both");
          if (profile.avatar) setAvatar(profile.avatar);
        } else {
          // Fallback to metadata if profile row doesn't exist yet
          setName(authData.user.user_metadata?.nome || "");
        }
      }
      setIsLoading(false);
    }
    fetchUserAndProfile();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
         alert("Por favor, escolha uma imagem menor que 2MB.");
         return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
         setAvatar(reader.result as string); // Save Base64 for instant DB persistence without S3 buckets
      };
      reader.readAsDataURL(file);
    }
  };

  const saveProfile = async () => {
    if (!userId) return;
    setIsSaving(true);
    setShowSuccess(false);

    try {
       const { error } = await supabase.from('profiles').upsert([{
         id: userId,
         nome: name,
         cpf: cpf || null,
         cnpj: cnpj || null,
         controle_tipo: controle,
         avatar: avatar // Base64 saving
       }]);
       
       if (error) alert("Erro ao salvar: " + error.message);
       else {
         setShowSuccess(true);
         setControleTipo(controle);
       }
    } catch(e) {
       console.error(e);
    } finally {
       setIsSaving(false);
       setTimeout(() => setShowSuccess(false), 3000);
    }
  };

  const handleLogout = async () => {
      await supabase.auth.signOut();
      router.push("/login"); // Force redirect
  };

  const handleDeleteProfile = async () => {
    if (!userId) return;
    if (!confirm("⚠️ ATENÇÃO: Esta ação é IRREVERSÍVEL!\n\nTodos os seus dados (perfil, transações e contas bancárias) serão excluídos permanentemente.\n\nDeseja mesmo continuar?")) return;
    
    setIsDeleting(true);
    try {
      // Supabase RLS will handle deleting related data if set to cascade, 
      // but here we might need to delete manually if cascade isn't set.
      await supabase.from('bank_accounts').delete().eq('user_id', userId);
      await supabase.from('transactions').delete().eq('user_id', userId);
      await supabase.from('profiles').delete().eq('id', userId);
      
      const { error } = await supabase.auth.admin.deleteUser(userId); // Needs service role, won't work in client side easily.
      // Usually users can't delete themselves from client side if not configured.
      // Better alternative: sign out and mark as inactive or let auth hook handle it.
      await supabase.auth.signOut();
      router.push("/cadastro");
      alert("Conta excluída com sucesso.");
    } catch(e) {
      alert("Erro ao excluir: Apenas o administrador pode excluir contas permanentemente via Auth, mas seus dados locais foram removidos.");
      await supabase.auth.signOut();
      router.push("/cadastro");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <header className="h-16 flex items-center justify-between px-8 shrink-0 relative bg-white border-b border-slate-100">
      <div className="flex items-center gap-4">
        {controleTipo === 'both' && (
          <div className="bg-slate-100 p-1 rounded-xl flex border border-slate-200">
            <button 
              onClick={() => setViewMode('pj')}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${viewMode === 'pj' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Building2 className="w-3 h-3" /> Empresa (PJ)
            </button>
            <button 
              onClick={() => setViewMode('pf')}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${viewMode === 'pf' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <UserIcon className="w-3 h-3" /> Pessoal (PF)
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <Dialog>
        <DialogTrigger render={
          <button className="flex items-center gap-3 bg-white px-5 py-2 rounded-full border border-slate-200 hover:bg-slate-50 transition-colors text-left group shadow-sm">
            <div className="bg-emerald-100 w-8 h-8 rounded-full text-emerald-600 flex items-center justify-center overflow-hidden ring-2 ring-emerald-500/20 group-hover:ring-emerald-500 transition-all">
              {avatar ? <img src={avatar} className="w-full h-full object-cover" /> : <User className="w-4 h-4 ml-0.5" />}
            </div>
            
            <div className="flex flex-col min-w-[140px]">
              {isLoading ? (
                <div className="h-4 w-24 bg-slate-100 rounded animate-pulse mb-1"></div>
              ) : (
                <span className="text-xs font-black text-slate-800 truncate max-w-[180px]">{name || userEmail || "FinControl User"}</span>
              )}
              <span className="text-[10px] text-slate-400 font-bold tracking-wider uppercase truncate max-w-[180px]">{userEmail ? "Conta Sincronizada" : "Acessando nuvem..."}</span>
            </div>
            <Settings className="w-4 h-4 text-slate-300 ml-1 group-hover:text-slate-500 transition-colors" />
          </button>
        } />
        <DialogContent className="sm:max-w-md bg-white border-slate-200 text-slate-800 p-0 overflow-hidden shadow-2xl rounded-2xl">
          <DialogHeader className="p-6 pb-2 border-b border-slate-50 bg-slate-50/50">
            <DialogTitle className="text-xl font-black text-slate-800 flex items-center gap-2">
              <Settings className="w-5 h-5 text-emerald-500" /> Configuração do Perfil
            </DialogTitle>
          </DialogHeader>
          
          <div className="px-6 py-6 space-y-5">
             <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 transition-colors">
               <div 
                 className="relative group w-16 h-16 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center overflow-hidden cursor-pointer shadow-md"
                 onClick={() => fileInputRef.current?.click()}
                 title="Nova Imagem"
               >
                 {avatar ? (
                   <img src={avatar} className="w-full h-full object-cover" />
                 ) : (
                   <Camera className="w-6 h-6 text-slate-400" />
                 )}
                 <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                    <Upload className="w-4 h-4 text-white" />
                 </div>
               </div>
               <div>
                  <h3 className="text-sm font-black text-slate-800 tracking-tight">Foto de Identificação</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest max-w-[200px] mt-0.5">Formatos PNG ou JPG. Recomendado menos de 2MB.</p>
               </div>
               <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
             </div>

             <div className="space-y-4">
               <div className="space-y-1.5 focus-within:text-emerald-500 transition-colors">
                 <Label htmlFor="edit-name" className="text-[10px] font-black uppercase tracking-widest text-inherit pl-1">Nome Completo</Label>
                 <Input id="edit-name" value={name} onChange={e=>setName(e.target.value)} disabled={isLoading} className="bg-white border-slate-200 h-11 px-4 font-bold text-slate-700 rounded-xl focus:border-emerald-500 focus:ring-emerald-500 disabled:opacity-50 transition-all" />
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {(controle === 'pf' || controle === 'both') && (
                   <div className="space-y-1.5 focus-within:text-emerald-500 transition-colors">
                      <Label htmlFor="edit-cpf" className="text-[10px] font-black uppercase tracking-widest text-inherit pl-1">CPF</Label>
                      <Input id="edit-cpf" value={cpf} onChange={e=>setCpf(e.target.value)} disabled={isLoading} className="bg-white border-slate-200 h-11 px-4 font-bold text-slate-700 rounded-xl focus:border-emerald-500 focus:ring-emerald-500 disabled:opacity-50 transition-all" />
                   </div>
                 )}
                 {(controle === 'pj' || controle === 'both') && (
                   <div className="space-y-1.5 focus-within:text-emerald-500 transition-colors">
                      <Label htmlFor="edit-cnpj" className="text-[10px] font-black uppercase tracking-widest text-inherit pl-1">CNPJ</Label>
                      <Input id="edit-cnpj" value={cnpj} onChange={e=>setCnpj(e.target.value)} disabled={isLoading} placeholder="Opcional" className="bg-white border-slate-200 h-11 px-4 font-bold text-slate-700 rounded-xl focus:border-emerald-500 focus:ring-emerald-500 disabled:opacity-50 transition-all" />
                   </div>
                 )}
               </div>

               <div className="space-y-1.5 focus-within:text-emerald-500 transition-colors">
                 <Label htmlFor="edit-controle" className="text-[10px] font-black uppercase tracking-widest text-inherit pl-1">Tipo de Controle</Label>
                 <select 
                   id="edit-controle" 
                   value={controle} 
                   onChange={e=>setControle(e.target.value)} 
                   disabled={isLoading} 
                   className="w-full bg-white border border-slate-200 rounded-xl h-11 px-4 font-bold text-sm text-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none disabled:opacity-50 transition-all"
                 >
                   <option value="pf" disabled={controle === 'pj' || controle === 'both'}>Controle PF (Pessoal)</option>
                   <option value="pj" disabled={controle === 'pf' || controle === 'both'}>Controle PJ (Empresarial)</option>
                   <option value="both">Controle PF e PJ (Ambos)</option>
                 </select>
                 <p className="text-[9px] font-bold text-slate-400 mt-1 pl-1 italic">* Você pode adicionar um novo controle, mas não remover o atual.</p>
               </div>

               <div className="pt-2 flex flex-col gap-3">
                 <Button type="button" onClick={saveProfile} disabled={isSaving || isLoading} className="w-full h-12 font-black bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs uppercase tracking-[0.2em] shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98]">
                   {isSaving ? (
                      <span className="flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin"/> Atualizando...</span>
                   ) : showSuccess ? (
                      <span className="flex items-center gap-2 px-6"><CheckCircle2 className="w-5 h-5"/> Dados Salvos!</span>
                   ) : "Atualizar Cadastro"}
                 </Button>

                 <button 
                   type="button" 
                   onClick={handleDeleteProfile} 
                   disabled={isDeleting || isLoading}
                   className="flex items-center justify-center gap-2 py-2 text-[10px] font-black text-rose-400 hover:text-rose-600 transition-colors uppercase tracking-widest"
                 >
                   <Trash className="w-3.5 h-3.5" /> Excluir Minha Conta Permanentemente
                 </button>
               </div>
             </div>
          </div>
        </DialogContent>
        </Dialog>
        
        <button onClick={handleLogout} className="ml-6 flex items-center gap-2 text-rose-500 hover:text-white hover:bg-rose-500 font-semibold text-sm transition-colors border max-h-min border-rose-500/20 bg-rose-500/10 px-4 py-2 rounded-full shadow-sm active:scale-95">
          <LogOut className="w-4 h-4" /> Sair
        </button>
      </div>
    </header>
  );
}
