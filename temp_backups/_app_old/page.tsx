"use client"

import { useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { LancamentosScreen } from "@/components/lancamentos-screen"
import { DashboardScreen } from "@/components/dashboard-screen"
import { LoginScreen } from "@/components/login-screen"
import { RegisterScreen } from "@/components/register-screen"
import { ResetPasswordScreen } from "@/components/reset-password-screen"
import { UserHeader } from "@/components/user-header"
import { useAuthStore } from "@/lib/auth-store"

type Screen = "lancamentos" | "dashboard"
type AuthScreen = "login" | "register" | "reset"

export default function HomePage() {
  const [currentScreen, setCurrentScreen] = useState<Screen>("lancamentos")
  const [authScreen, setAuthScreen] = useState<AuthScreen>("login")
  
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  if (!isAuthenticated) {
    if (authScreen === "login") {
      return (
        <LoginScreen
          onSwitchToRegister={() => setAuthScreen("register")}
          onSwitchToReset={() => setAuthScreen("reset")}
        />
      )
    }
    
    if (authScreen === "register") {
      return <RegisterScreen onSwitchToLogin={() => setAuthScreen("login")} />
    }
    
    if (authScreen === "reset") {
      return <ResetPasswordScreen onSwitchToLogin={() => setAuthScreen("login")} />
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar
        currentScreen={currentScreen}
        onScreenChange={setCurrentScreen}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <UserHeader />
        
        <main className="flex-1 overflow-auto">
          <div className="p-8 max-w-6xl mx-auto">
            {currentScreen === "lancamentos" ? (
              <LancamentosScreen />
            ) : (
              <DashboardScreen />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}