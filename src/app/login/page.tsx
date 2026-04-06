"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Eye, EyeOff, ArrowRight, User, Loader2, AlertCircle, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg("");

    if (!email || !password) {
      setErrorMsg("Por favor, preencha E-mail e Senha.");
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMsg(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message);
      setIsLoading(false);
      return;
    }

    if (data.user) {
      router.push("/dashboard");
    }
  };

  if (!mounted) return <div className="min-h-screen bg-white" />;

  return (
    <div className="flex min-h-screen bg-white">
      {/* LEFT COLUMN: Branding */}
      <div className="hidden lg:flex flex-1 flex-col items-center justify-center p-12 bg-[#f8fafc] border-r border-slate-100">
        <div className="max-w-xl w-full flex flex-col items-center text-center">
           <img src="/logo.png" alt="FinControl Logo" className="w-full max-w-md object-contain" />
        </div>
      </div>

      {/* RIGHT COLUMN: Login Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 bg-white relative">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:text-left">
            <div className="lg:hidden flex justify-center mb-8">
              <img src="/logo.png" alt="FinControl" className="h-16 object-contain" />
            </div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Acesse sua conta para continuar</p>
          </div>

          {errorMsg && (
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600 text-sm font-bold shadow-sm animate-in fade-in slide-in-from-top-4">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>{errorMsg}</p>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSignIn}>
            <div className="space-y-2 group">
              <Label htmlFor="email" className="text-[11px] font-black uppercase tracking-widest text-slate-400 pl-1 group-focus-within:text-primary transition-colors">Email Cadastrado</Label>
              <div className="relative">
                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="exemplo@email.com" className="pl-5 pr-12 bg-slate-50 border-slate-200 h-14 rounded-2xl focus:ring-primary font-bold shadow-sm text-slate-700" />
                <div className="absolute inset-y-0 right-0 flex items-center pr-5 pointer-events-none text-slate-300">
                  <User className="w-4 h-4" />
                </div>
              </div>
            </div>

            <div className="space-y-2 group">
              <Label htmlFor="password" className="text-[11px] font-black uppercase tracking-widest text-slate-400 pl-1 group-focus-within:text-primary transition-colors">Senha</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" className="pl-5 pr-16 bg-slate-50 border-slate-200 h-14 rounded-2xl focus:ring-primary font-bold shadow-sm tracking-widest text-slate-700" />
                <div className="absolute inset-y-0 right-0 flex items-center pr-5 gap-3 text-slate-300">
                  <KeyRound className="w-4 h-4" />
                  <div className="h-4 w-px bg-slate-200" />
                  {showPassword ? <EyeOff className="w-4 h-4 cursor-pointer hover:text-primary transition-colors" onClick={() => setShowPassword(false)} /> : <Eye className="w-4 h-4 cursor-pointer hover:text-primary transition-colors" onClick={() => setShowPassword(true)} />}
                </div>
              </div>
            </div>

            <Button type="submit" disabled={isLoading} className="w-full font-black text-sm h-14 flex items-center justify-center gap-3 transition-all rounded-2xl bg-[#0ca383] text-white hover:bg-[#0a8c70] shadow-xl shadow-teal-500/20 uppercase tracking-widest active:scale-[0.98] border-0">
              {isLoading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Autenticando...</>
              ) : (
                <><ArrowRight className="w-5 h-5" /> Entrar no FinControl</>
              )}
            </Button>
          </form>

          <div className="flex flex-col items-center gap-4 text-sm pt-4">
            <Link href="#" className="text-slate-400 font-bold hover:text-primary transition-colors">Esqueceu sua senha?</Link>
            <div className="h-px bg-slate-100 w-full my-2" />
            <p className="text-slate-500 font-medium">Ainda não tem conta? <Link href="/cadastro" className="text-[#0ca383] font-black hover:underline underline-offset-4 decoration-2">Cadastre-se</Link></p>
          </div>
        </div>

        {/* Floating badge for trust */}
        <div className="absolute bottom-8 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-300">
           <ShieldCheck className="w-4 h-4" /> Ambiente Seguro
        </div>
      </div>
    </div>
  );
}
