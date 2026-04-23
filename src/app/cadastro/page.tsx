"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, ArrowLeft, UserPlus, Upload, Camera, Loader2, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();

  // File Upload State (Local visual only for now)
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
  const [controle, setControle] = useState("both");
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
      const url = URL.createObjectURL(file);
      setAvatar(url);
      setZoom(1); 
      setPosition({ x: 0, y: 0 });
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

    // Regra: Min 8, 1 uppercase, 1 special char
    const pwdRegex = /^(?=.*[A-Z])(?=.*[!@#$&*+=-_/\\[\]{})(;:.,|]).{8,}$/;
    if (!pwdRegex.test(password)) {
      setErrorMsg("A senha deve ter no mínimo 8 caracteres, incluindo uma letra maiúscula e um caractere especial (!@#$&*).");
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nome: name,
        }
      }
    });

    if (error) {
      setErrorMsg(error.message);
      setIsLoading(false);
      return;
    }

    if (data.user) {
      // Use upsert to ensure the profile row is created if it doesn't exist
      await supabase.from('profiles').upsert({
         id: data.user.id,
         nome: name,
         cpf: cpf || null,
         cnpj: cnpj || null,
         controle_tipo: controle,
         telefone: `${ddd}${phone}` || null,
         avatar: avatar || null, // Link the Base64 avatar from registration
         updated_at: new Date().toISOString()
      });

      // Redirect on success
      router.push("/dashboard");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 relative overflow-hidden py-10">
      {/* Background Logo - Semi-transparent and centered */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] z-0">
        <img src="/logo.png" alt="" className="w-[80vw] max-w-6xl object-contain grayscale" />
      </div>

      <div className="w-full max-w-lg bg-card/70 backdrop-blur-xl border border-border/50 rounded-2xl p-8 shadow-2xl z-10 relative">
        <div className="flex flex-col items-center mb-6 text-center">
          <p className="text-muted-foreground text-[10px] font-black tracking-[0.3em] uppercase opacity-80">Crie seu Perfil e Conta Empresarial</p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/50 rounded-lg flex items-center gap-3 text-red-500 text-sm font-medium">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{errorMsg}</p>
          </div>
        )}

        <form className="space-y-5" onSubmit={handleSignUp}>
          
          {/* Avatar Upload */}
          <div className="flex flex-col items-center gap-3 py-2 bg-slate-900/20 border border-slate-800/50 rounded-xl p-4 touch-none">
            <div className="relative group">
               <div 
                 className={`w-28 h-28 rounded-full border-4 border-slate-800 bg-slate-950 flex flex-col items-center justify-center overflow-hidden relative shadow-xl ${avatar ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer hover:bg-slate-900 transition-colors'}`}
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
                    <div className="flex flex-col items-center text-slate-400">
                      <Camera className="w-8 h-8 mb-1 opacity-50" />
                      <span className="text-[10px] uppercase font-bold tracking-widest">Foto</span>
                    </div>
                 )}
               </div>

               {avatar && (
                 <button type="button" onClick={() => fileInputRef.current?.click()} className="absolute bottom-1 right-1 bg-emerald-500 w-8 h-8 rounded-full flex items-center justify-center border-2 border-slate-900 shadow-lg hover:bg-emerald-400 transition-transform active:scale-90 z-20" title="Trocar Foto">
                   <Upload className="w-4 h-4 text-slate-900" />
                 </button>
               )}
            </div>
            
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
            
            {avatar && (
              <div className="w-full max-w-[200px] flex items-center gap-3 mt-1">
                 <span className="text-sm text-slate-500 font-bold">-</span>
                 <input type="range" min="0.5" max="3" step="0.05" value={zoom} onChange={handleZoomChange} className="flex-1 accent-primary h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer" />
                 <span className="text-sm text-slate-500 font-bold">+</span>
              </div>
            )}
            {!avatar && <p className="text-xs text-slate-500 text-center flex flex-col items-center"><span className="text-slate-300 font-semibold mb-1">Identificação Pessoal</span> O sistema fará o enquadramento redondo.</p>}
            {avatar && <p className="text-[10px] text-primary/80 uppercase tracking-widest font-bold">Arraste a foto para enquadrar</p>}
          </div>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
               <Label htmlFor="name" className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Nome Completo</Label>
               <Input id="name" value={name} onChange={e => setName(e.target.value)} required placeholder="João da Silva" className="bg-background/50 border-border focus:border-primary h-11 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Email Administrativo</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="seu@email.com" className="bg-background/50 border-border focus:border-primary h-11 rounded-xl" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="cpf" className="font-bold text-xs uppercase tracking-widest text-muted-foreground">CPF (Contas PF)</Label>
                <Input id="cpf" type="text" value={cpf} onChange={e => setCpf(e.target.value)} placeholder="000.000.000-00" className="bg-background/50 border-border focus:border-primary h-11 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cnpj" className="font-bold text-xs uppercase tracking-widest text-muted-foreground">CNPJ (Contas PJ)</Label>
                <Input id="cnpj" type="text" value={cnpj} onChange={e => setCnpj(e.target.value)} placeholder="00.000.000/0001-00" className="bg-background/50 border-border focus:border-primary h-11 rounded-xl" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="controle" className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Tipo de Controle</Label>
                <select id="controle" value={controle} onChange={e => setControle(e.target.value)} className="w-full bg-background/50 border border-border rounded-xl h-11 px-3 text-sm text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-primary">
                  <option value="pf" className="bg-background text-foreground">Controle PF (Pessoal)</option>
                  <option value="pj" className="bg-background text-foreground">Controle PJ (Empresarial)</option>
                  <option value="both" className="bg-background text-foreground">Controle PF e PJ (Ambos)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5 pt-2">
              <Label htmlFor="phone" className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Telefone Celular</Label>
              <div className="flex gap-4">
                 <Input id="ddd" type="text" value={ddd} onChange={e => setDdd(e.target.value)} placeholder="DDD" className="w-20 bg-background/50 border-border focus:border-primary h-11 rounded-xl" />
                 <Input id="phone" type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder="00000-0000" className="flex-1 bg-background/50 border-border focus:border-primary h-11 rounded-xl" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="password" className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Senha Segura</Label>
                <div className="relative">
                  <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required placeholder="Mínimo de 8 caracteres" className="pl-3 pr-10 bg-background/50 border-border focus:border-primary h-11 rounded-xl" />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 gap-2 text-muted-foreground">
                    {showPassword ? <EyeOff className="w-4 h-4 cursor-pointer hover:text-foreground" onClick={() => setShowPassword(false)} /> : <Eye className="w-4 h-4 cursor-pointer hover:text-foreground" onClick={() => setShowPassword(true)} />}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm_password" className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Confirmar Senha</Label>
                <div className="relative">
                  <Input id="confirm_password" type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required placeholder="Repita a senha" className="pl-3 pr-10 bg-background/50 border-border focus:border-primary h-11 rounded-xl" />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 gap-2 text-muted-foreground">
                    {showConfirmPassword ? <EyeOff className="w-4 h-4 cursor-pointer hover:text-foreground" onClick={() => setShowConfirmPassword(false)} /> : <Eye className="w-4 h-4 cursor-pointer hover:text-foreground" onClick={() => setShowConfirmPassword(true)} />}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <Button type="submit" disabled={isLoading} className="w-full font-bold text-base h-12 flex items-center justify-center gap-2 transition-all">
                {isLoading ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Registrando no Banco...</>
                ) : (
                  <><UserPlus className="w-5 h-5" /> Cadastrar Usuário e Empresa</>
                )}
              </Button>
            </div>
          </div>
        </form>

        <div className="mt-8 flex flex-col items-center gap-2 text-sm border-t border-slate-800 pt-6">
          <Link href="/login" className="flex items-center gap-1 text-primary font-bold hover:underline">
             <ArrowLeft className="w-4 h-4" /> Voltar para a tela de Login
          </Link>
        </div>
      </div>
    </div>
  );
}
