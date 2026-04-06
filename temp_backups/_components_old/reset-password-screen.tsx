"use client"

import { useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { KeyRound, AlertCircle, CheckCircle, ArrowLeft, Copy } from "lucide-react"
import { useAuthStore } from "@/lib/auth-store"

interface ResetPasswordScreenProps {
  onSwitchToLogin: () => void
}

export function ResetPasswordScreen({ onSwitchToLogin }: ResetPasswordScreenProps) {
  const [identifier, setIdentifier] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const requestPasswordReset = useAuthStore((state) => state.requestPasswordReset)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(newPassword)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")
    setNewPassword("")
    setIsLoading(true)

    await new Promise((resolve) => setTimeout(resolve, 500))

    const result = requestPasswordReset(identifier)

    if (!result.success) {
      setError(result.message)
    } else {
      setSuccess(result.message)
      if (result.newPassword) {
        setNewPassword(result.newPassword)
      }
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
              width={180}
              height={60}
              className="object-contain w-auto h-auto"
              priority
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Recupere o acesso à sua conta
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

            {success && (
              <Alert className="bg-primary/10 border-primary/50">
                <CheckCircle className="h-4 w-4 text-primary" />
                <AlertDescription className="text-primary">{success}</AlertDescription>
              </Alert>
            )}

            {newPassword && (
              <div className="p-4 bg-secondary rounded-lg border border-border">
                <p className="text-sm text-muted-foreground mb-2">Sua nova senha temporária:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-background px-3 py-2 rounded text-foreground font-mono text-lg">
                    {newPassword}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleCopy}
                    className="border-border"
                  >
                    <Copy className={`h-4 w-4 ${copied ? "text-primary" : ""}`} />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {copied ? "Copiado!" : "Copie e use esta senha para fazer login."}
                </p>
              </div>
            )}

            {!newPassword && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="identifier" className="text-foreground">
                    CPF ou Email
                  </Label>
                  <Input
                    id="identifier"
                    type="text"
                    placeholder="Digite seu CPF ou email cadastrado"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      Processando...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <KeyRound className="h-4 w-4" />
                      Recuperar Senha
                    </span>
                  )}
                </Button>
              </>
            )}

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={onSwitchToLogin}
                className="text-sm text-primary hover:text-primary/80 font-medium transition-colors flex items-center justify-center gap-1 mx-auto"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar para o login
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}