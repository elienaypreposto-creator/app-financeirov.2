"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, ArrowLeft, UserPlus, Upload, Camera, Loader2, AlertCircle, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();

  // File Upload State
  const [avatar, setAvatar] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [regime, setRegime] = useState("Pessoa Física Apenas (Sem Empresa)");
  const [ddd, setDdd] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
         setAvatar(reader.result as string);
         setZoom(1);
         setPosition({ x: 0, y: 0 });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setZoom(Number(e.target.value));
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (!avatar) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !avatar) return;
    setPosition({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const onMouseUp = () => {
    setIsDragging(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg("");

    if (!email || !password || !name || !confirmPassword) {
      setErrorMsg("Nome, E-mail, Senha e Confirmação são obrigatórios.");
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("As senhas digitadas não coincidem.");
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nome: name }
      }
    });

    if (error) {
      setErrorMsg(error.message);
      setIsLoading(false);
      return;
    }

    if (data.user) {
      await supabase.from('profiles').upsert({
         id: data.user.id,
         nome: name,
         cpf: cpf || null,
         cnpj: cnpj || null,
         regime_tributario: regime,
         telefone: `${ddd}${phone}` || null,
         avatar: avatar || null,
         updated_at: new Date().toISOString()
      });
      router.push("/dashboard");
    }
  };

  return (
    <div className="flex min-h-screen bg-white">
      {/* LEFT COLUMN: Branding (Same as Login) */}
      <div className="hidden lg:flex flex-1 flex-col items-center justify-center p-12 bg-[#f8fafc] border-r border-slate-100 sticky top-0 h-screen">
        <div className="max-w-xl w-full flex flex-col items-center text-center">
           <img src="/logo.png" alt="FinControl Logo" className="w-full max-w-sm object-contain" />
        </div>
      </div>

      {/* RIGHT COLUMN: Register Form */}
      <div className="flex-1 flex flex-col items-center p-6 md:p-12 bg-white overflow-y-auto min-h-screen">
        <div className="w-full max-w-xl space-y-10 py-8">
          <div className="text-center lg:text-left flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Novo no ecossistema?</p>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">Crie sua conta profissional</h2>
            </div>
            <Link href="/login" className="flex items-center gap-2 text-slate-400 font-bold hover:text-primary transition-all text-xs uppercase tracking-widest bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
               <ArrowLeft className="w-4 h-4" /> Voltar
            </Link>
          </div>

          {errorMsg && (
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600 text-sm font-bold shadow-sm animate-in fade-in slide-in-from-top-4">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>{errorMsg}</p>
            </div>
          )}

          <form className="space-y-10" onSubmit={handleSignUp}>
            {/* Avatar Upload */}
            <div className="flex flex-col md:flex-row items-center gap-8 bg-[#f8fafc] border border-slate-100 rounded-3xl p-8 shadow-inner">
              <div className="relative group shrink-0">
                 <div 
                   className={`w-32 h-32 rounded-[2rem] border-4 border-white bg-white flex flex-col items-center justify-center overflow-hidden relative shadow-2xl transition-transform hover:scale-105 ${avatar ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer hover:bg-slate-50 transition-colors'}`}
                   onClick={() => !avatar && fileInputRef.current?.click()}
                   onMouseDown={onMouseDown}
                   onMouseMove={onMouseMove}
                   onMouseUp={onMouseUp}
                   onMouseLeave={onMouseUp}
                 >
                   {avatar ? (
                      <img 
                        src={avatar} 
                        alt="Avatar" 
                        className="absolute max-w-none origin-center pointer-events-none"
                        style={{ transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`, width: '100%', height: '100%', objectFit: 'cover' }}
                        draggable={false}
                      />
                   ) : (
                      <div className="flex flex-col items-center text-slate-300">
                        <Camera className="w-10 h-10 mb-2 opacity-50" />
                        <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">Foto</span>
                      </div>
                   )}
                 </div>

                 {avatar && (
                   <button type="button" onClick={() => fileInputRef.current?.click()} className="absolute -bottom-2 -right-2 bg-primary w-10 h-10 rounded-xl flex items-center justify-center border-4 border-white shadow-xl hover:bg-primary/90 transition-all active:scale-90 z-20 hover:rotate-12" title="Trocar Foto">
                     <Upload className="w-5 h-5 text-white" />
                   </button>
                 )}
              </div>
              
              <div className="flex-1 space-y-4">
                 <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Sua Identidade Visual</h3>
                 <p className="text-xs text-slate-500 font-medium leading-relaxed">Arraste a foto para ajustar. Isso será exibido no seu dashboard e relatórios fiscais.</p>
                 {avatar && (
                    <div className="w-full max-w-[200px] flex items-center gap-4">
                       <input type="range" min="0.5" max="3" step="0.05" value={zoom} onChange={handleZoomChange} className="flex-1 accent-primary h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer" />
                    </div>
                 )}
              </div>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              <div className="space-y-2 group md:col-span-2">
                 <Label htmlFor="name" className="text-[11px] font-black uppercase tracking-widest text-slate-400 pl-1 group-focus-within:text-primary transition-colors">Nome Completo</Label>
                 <Input id="name" value={name} onChange={e => setName(e.target.value)} required placeholder="Seu nome" className="bg-slate-50 border-slate-200 h-14 rounded-2xl focus:ring-primary font-bold shadow-sm" />
              </div>

              <div className="space-y-2 group md:col-span-2">
                <Label htmlFor="email" className="text-[11px] font-black uppercase tracking-widest text-slate-400 pl-1 group-focus-within:text-primary transition-colors">Email de Trabalho</Label>
                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="seu@email.com" className="bg-slate-50 border-slate-200 h-14 rounded-2xl focus:ring-primary font-bold shadow-sm" />
              </div>

              <div className="space-y-2 group">
                <Label htmlFor="cpf" className="text-[11px] font-black uppercase tracking-widest text-slate-400 pl-1 group-focus-within:text-primary transition-colors">CPF</Label>
                <Input id="cpf" type="text" value={cpf} onChange={e => setCpf(e.target.value)} placeholder="000.000.000-00" className="bg-slate-50 border-slate-200 h-14 rounded-2xl font-mono font-bold shadow-sm" />
              </div>
              
              <div className="space-y-2 group">
                <Label htmlFor="cnpj" className="text-[11px] font-black uppercase tracking-widest text-slate-400 pl-1 group-focus-within:text-primary transition-colors">CNPJ (Opcional)</Label>
                <Input id="cnpj" type="text" value={cnpj} onChange={e => setCnpj(e.target.value)} placeholder="00.000.000/0001-00" className="bg-slate-50 border-slate-200 h-14 rounded-2xl font-mono font-bold shadow-sm" />
              </div>

              <div className="space-y-2 group md:col-span-2">
                <Label htmlFor="regime" className="text-[11px] font-black uppercase tracking-widest text-slate-400 pl-1 group-focus-within:text-primary transition-colors">Enquadramento Tributário</Label>
                <select id="regime" value={regime} onChange={e => setRegime(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl h-14 px-5 font-bold text-sm text-slate-700 outline-none focus:border-primary shadow-sm cursor-pointer">
                  <option value="Pessoa Física Apenas (Sem Empresa)">Pessoa Física Apenas (Sem Empresa)</option>
                  <option value="MEI (Microempreendedor Individual)">MEI (Microempreendedor Individual)</option>
                  <option value="ME (Simples Nacional)">ME (Simples Nacional)</option>
                </select>
              </div>

              <div className="space-y-2 group">
                <Label htmlFor="password" className="text-[11px] font-black uppercase tracking-widest text-slate-400 pl-1 group-focus-within:text-primary transition-colors">Senha Segura</Label>
                <div className="relative">
                  <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" className="pl-5 pr-12 bg-slate-50 border-slate-200 h-14 rounded-2xl focus:ring-primary font-bold shadow-sm tracking-widest" />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-5 text-slate-300">
                    {showPassword ? <EyeOff className="w-4 h-4 cursor-pointer hover:text-primary" onClick={() => setShowPassword(false)} /> : <Eye className="w-4 h-4 cursor-pointer hover:text-primary" onClick={() => setShowPassword(true)} />}
                  </div>
                </div>
              </div>

              <div className="space-y-2 group">
                <Label htmlFor="confirm_password" className="text-[11px] font-black uppercase tracking-widest text-slate-400 pl-1 group-focus-within:text-primary transition-colors">Confirmar Senha</Label>
                <div className="relative">
                  <Input id="confirm_password" type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required placeholder="••••••••" className="pl-5 pr-12 bg-slate-50 border-slate-200 h-14 rounded-2xl focus:ring-primary font-bold shadow-sm tracking-widest" />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-5 text-slate-300">
                    {showConfirmPassword ? <EyeOff className="w-4 h-4 cursor-pointer hover:text-primary" onClick={() => setShowConfirmPassword(false)} /> : <Eye className="w-4 h-4 cursor-pointer hover:text-primary" onClick={() => setShowConfirmPassword(true)} />}
                  </div>
                </div>
              </div>
            </div>

            <Button type="submit" disabled={isLoading} className="w-full font-black text-sm h-16 flex items-center justify-center gap-3 transition-all rounded-2xl bg-primary text-white hover:bg-primary/90 shadow-2xl shadow-primary/30 uppercase tracking-widest active:scale-[0.98] border-0">
              {isLoading ? (
                <><Loader2 className="w-6 h-6 animate-spin" /> Processando...</>
              ) : (
                <><UserPlus className="w-6 h-6" /> Concluir Cadastro</>
              )}
            </Button>
          </form>

          <div className="flex justify-center items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 pt-10">
             <ShieldCheck className="w-4 h-4" /> Dados Criptografados e Seguros
          </div>
        </div>
      </div>
    </div>
  );
}
