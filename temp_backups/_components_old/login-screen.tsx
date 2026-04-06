"use client"

import { useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Eye, EyeOff, LogIn, AlertCircle, CheckCircle } from "lucide-react"
import { useAuthStore } from "@/lib/auth-store"

interface LoginScreenProps {
  onSwitchToRegister: () => void
  onSwitchToReset: () => void
}

export function LoginScreen({ onSwitchToRegister, onSwitchToReset }: LoginScreenProps) {
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const login = useAuthStore((state) => state.login)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    await new Promise((resolve) => setTimeout(resolve, 500))

    const result = login(identifier, password)
    
    if (!result.success) {
      setError(result.message)
    }
    
    setIsLoading(false)
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-card border-border">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <Image
              src="/logo.png"
              alt="FinControl"
              width={200}
              height={67}
              className="object-contain w-auto h-auto"
              priority
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Acesse sua conta para continuar
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive" className="bg-destructive/10 border-destructive/50">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="identifier" className="text-foreground">
                CPF ou Email
              </Label>
              <Input
                id="identifier"
                type="text"
                placeholder="Digite seu CPF ou email"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground">
                Senha
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-secondary border-border text-foreground placeholder:text-muted-foreground pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Entrando...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn className="h-4 w-4" />
                  Entrar
                </span>
              )}
            </Button>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={onSwitchToReset}
                className="text-sm text-primary hover:text-primary/80 transition-colors"
              >
                Esqueceu sua senha?
              </button>
              <div className="text-center text-sm text-muted-foreground">
                Ainda não tem conta?{" "}
                <button
                  type="button"
                  onClick={onSwitchToRegister}
                  className="text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  Cadastre-se
                </button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}