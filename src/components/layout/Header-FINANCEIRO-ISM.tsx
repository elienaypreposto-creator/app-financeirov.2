"use client";

import { User, LogOut, Settings, Camera, Upload, Loader2, CheckCircle2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function Header() {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  
  // Profile Data States
  const [avatar, setAvatar] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [regime, setRegime] = useState("Pessoa Física Apenas (Sem Empresa)");

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
          setRegime(profile.regime_tributario || "Pessoa Física Apenas (Sem Empresa)");
          if (profile.avatar) setAvatar(profile.avatar);
        } else {
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
         setAvatar(reader.result as string);
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
         regime_tributario: regime,
         avatar: avatar 
       }]);
       
       if (error) alert("Erro ao salvar: " + error.message);
       else setShowSuccess(true);
    } catch(e) {
       console.error(e);
    } finally {
       setIsSaving(false);
       setTimeout(() => setShowSuccess(false), 3000);
    }
  };

  const handleLogout = async () => {
     await supabase.auth.signOut();
     router.push("/login");
  };

  return (
    <header className="h-20 flex items-center justify-end px-12 shrink-0 relative border-b border-border/30 backdrop-blur-md z-30">
      <Dialog>
        <DialogTrigger
          render={
            <button type="button" className="flex items-center gap-4 bg-card px-6 py-2.5 rounded-2xl border border-border/50 hover:border-primary/30 transition-all text-left group shadow-sm hover:shadow-primary/5 active:scale-95">
              <div className="bg-primary/10 w-10 h-10 rounded-xl text-primary flex items-center justify-center overflow-hidden ring-2 ring-primary/5 group-hover:ring-primary/20 transition-all shadow-inner">
                {avatar ? <img src={avatar} className="w-full h-full object-cover" /> : <User className="w-5 h-5 text-primary/70" />}
              </div>
              
              <div className="flex flex-col min-w-[150px]">
                {isLoading ? (
                  <div className="h-4 w-24 bg-slate-100 rounded animate-pulse mb-1"></div>
                ) : (
                  <span className="text-sm font-black text-slate-800 tracking-tight truncate max-w-[200px]">{name || userEmail || "FinControl User"}</span>
                )}
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{userEmail ? "Conta Sincronizada" : "Acessando..."}</span>
              </div>
              <Settings className="w-4 h-4 text-slate-300 ml-2 group-hover:text-primary transition-all group-hover:rotate-45" />
            </button>
          }
        />
        <DialogContent className="sm:max-w-md bg-white border-slate-200 text-slate-900 p-0 overflow-hidden shadow-2xl rounded-3xl">
          <DialogHeader className="p-8 pb-4">
            <DialogTitle className="text-xl font-black flex items-center gap-3 text-slate-900 tracking-tight">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary shadow-sm"><Settings className="w-5 h-5" /></div>
              Configuração do Perfil
            </DialogTitle>
          </DialogHeader>
          
          <div className="px-8 pb-8 space-y-6">
             <div className="flex items-center gap-6 bg-slate-50/50 p-6 rounded-2xl border border-slate-100 shadow-inner">
               <div 
                 className="relative group w-20 h-20 rounded-2xl border-2 border-white bg-white flex items-center justify-center overflow-hidden cursor-pointer shadow-xl transition-transform hover:scale-105"
                 onClick={() => fileInputRef.current?.click()}
                 title="Mudar Foto"
               >
                 {avatar ? (
                   <img src={avatar} className="w-full h-full object-cover" />
                 ) : (
                   <Camera className="w-8 h-8 text-slate-300" />
                 )}
                 <div className="absolute inset-0 bg-primary/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px]">
                    <Upload className="w-5 h-5 text-white" />
                 </div>
               </div>
               <div className="flex-1">
                  <h3 className="text-sm font-black text-slate-800">Foto de Identificação</h3>
                  <p className="text-[11px] text-slate-400 font-medium leading-relaxed mt-1">Sua foto ajuda na identificação pessoal dentro do ecossistema FinControl.</p>
               </div>
               <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
             </div>

             <div className="space-y-5">
               <div className="space-y-2 group">
                 <Label htmlFor="edit-name" className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-400 pl-1 group-focus-within:text-primary transition-colors">Nome Completo</Label>
                 <Input id="edit-name" value={name} onChange={e=>setName(e.target.value)} disabled={isLoading} className="bg-white border-slate-200 h-12 px-5 font-bold text-slate-800 focus:ring-primary rounded-xl shadow-sm" />
               </div>
               
               <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-2">
                    <Label htmlFor="edit-cpf" className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-400 pl-1">CPF Oficial</Label>
                    <Input id="edit-cpf" value={cpf} onChange={e=>setCpf(e.target.value)} disabled={isLoading} className="bg-white border-slate-200 h-12 px-5 font-mono text-sm font-bold text-slate-700 rounded-xl shadow-sm" />
                 </div>
                 <div className="space-y-2">
                    <Label htmlFor="edit-cnpj" className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-400 pl-1">CNPJ Principal</Label>
                    <Input id="edit-cnpj" value={cnpj} onChange={e=>setCnpj(e.target.value)} disabled={isLoading} placeholder="Opcional" className="bg-white border-slate-200 h-12 px-5 font-mono text-sm font-bold text-slate-700 rounded-xl shadow-sm" />
                 </div>
               </div>

               <div className="space-y-2">
                 <Label htmlFor="edit-regime" className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-400 pl-1">Regime Tributário</Label>
                 <select id="edit-regime" value={regime} onChange={e=>setRegime(e.target.value)} disabled={isLoading} className="w-full bg-white border border-slate-200 rounded-xl h-12 px-5 font-bold text-sm text-slate-700 focus:border-primary outline-none shadow-sm cursor-pointer hover:border-primary/30 transition-all">
                   <option value="Pessoa Física Apenas (Sem Empresa)">Pessoa Física Apenas (Sem Empresa)</option>
                   <option value="MEI (Microempreendedor Individual)">MEI (Microempreendedor Individual)</option>
                   <option value="ME (Simples Nacional)">ME (Simples Nacional)</option>
                 </select>
               </div>

               <div className="pt-4">
                 <Button type="button" onClick={saveProfile} disabled={isSaving || isLoading} className="w-full h-14 font-black bg-primary text-white hover:bg-primary/90 text-sm uppercase tracking-widest transition-all shadow-xl shadow-primary/20 rounded-2xl active:scale-[0.98] border-0">
                   {isSaving ? (
                      <span className="flex items-center gap-3"><Loader2 className="w-5 h-5 animate-spin"/> Sincronizando...</span>
                   ) : showSuccess ? (
                      <span className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-emerald-300"/> Perfil Atualizado!</span>
                   ) : "Salvar Alterações"}
                 </Button>
               </div>
             </div>
          </div>
        </DialogContent>
      </Dialog>
      
      <button onClick={handleLogout} className="ml-8 flex items-center gap-2 text-rose-500 hover:text-white hover:bg-rose-500 font-bold text-xs uppercase tracking-widest transition-all border border-rose-100 bg-rose-50 px-6 py-2.5 rounded-2xl shadow-sm hover:shadow-rose-200 active:scale-95 group">
        <LogOut className="w-4 h-4 transition-transform group-hover:-translate-x-1" /> Sair
      </button>
    </header>
  );
}
