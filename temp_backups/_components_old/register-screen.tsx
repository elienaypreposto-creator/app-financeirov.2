"use client"

import { useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Eye, EyeOff, UserPlus, AlertCircle, CheckCircle, ArrowLeft } from "lucide-react"
import { useAuthStore } from "@/lib/auth-store"

interface RegisterScreenProps {
  onSwitchToLogin: () => void
}

export function RegisterScreen({ onSwitchToLogin }: RegisterScreenProps) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    cpf: "",
    ddd: "",
    phone: "",
    password: "",
    confirmPassword: "",
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const register = useAuthStore((state) => state.register)

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, "").slice(0, 11)
    return numbers
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
  }

  const formatDDD = (value: string) => {
    return value.replace(/\D/g, "").slice(0, 2)
  }

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "").slice(0, 9)
    if (numbers.length > 5) {
      return numbers.replace(/(\d{5})(\d)/, "$1-$2")
    }
    return numbers
  }

  const handleChange = (field: string, value: string) => {
    let formattedValue = value
    
    if (field === "cpf") {
      formattedValue = formatCPF(value)
    } else if (field === "ddd") {
      formattedValue = formatDDD(value)
    } else if (field === "phone") {
      formattedValue = formatPhone(value)
    }
    
    setFormData((prev) => ({ ...prev, [field]: formattedValue }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")
    setIsLoading(true)

    await new Promise((resolve) => setTimeout(resolve, 500))

    if (formData.password !== formData.confirmPassword) {
      setError("As senhas não coincidem.")
      setIsLoading(false)
      return
    }

    if (formData.password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.")
      setIsLoading(false)
      return
    }

    const cpfNumbers = formData.cpf.replace(/\D/g, "")
    if (cpfNumbers.length !== 11) {
      setError("CPF deve ter 11 dígitos.")
      setIsLoading(false)
      return
    }

    const phoneNumbers = formData.phone.replace(/\D/g, "")
    if (phoneNumbers.length !== 9) {
      setError("Celular deve ter 9 dígitos.")
      setIsLoading(false)
      return
    }

    if (formData.ddd.length !== 2) {
      setError("DDD deve ter 2 dígitos.")
      setIsLoading(false)
      return
    }

    const result = register({
      name: formData.name,
      email: formData.email,
      cpf: cpfNumbers,
      phone: `(${formData.ddd}) ${formData.phone}`,
      password: formData.password,
    })

    if (!result.success) {
      setError(result.message)
    } else {
      setSuccess(result.message)
      setTimeout(() => {
        onSwitchToLogin()
      }, 1500)
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
            Crie sua conta para começar
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

            <div className="space-y-2">
              <Label htmlFor="name" className="text-foreground">
                Nome Completo
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="Digite seu nome completo"
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cpf" className="text-foreground">
                CPF
              </Label>
              <Input
                id="cpf"
                type="text"
                placeholder="000.000.000-00"
                value={formData.cpf}
                onChange={(e) => handleChange("cpf", e.target.value)}
                className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-foreground">Telefone para Contato</Label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="DDD"
                  value={formData.ddd}
                  onChange={(e) => handleChange("ddd", e.target.value)}
                  className="w-20 bg-secondary border-border text-foreground placeholder:text-muted-foreground text-center"
                  required
                />
                <Input
                  type="text"
                  placeholder="00000-0000"
                  value={formData.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  className="flex-1 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground">
                Senha
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Mínimo 6 caracteres"
                  value={formData.password}
                  onChange={(e) => handleChange("password", e.target.value)}
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

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-foreground">
                Confirmar Senha
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Repita sua senha"
                  value={formData.confirmPassword}
                  onChange={(e) => handleChange("confirmPassword", e.target.value)}
                  className="bg-secondary border-border text-foreground placeholder:text-muted-foreground pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                  Cadastrando...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  Cadastrar
                </span>
              )}
            </Button>

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