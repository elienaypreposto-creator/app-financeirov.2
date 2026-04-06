"use client"

import Image from "next/image"
import { FileText, LayoutDashboard } from "lucide-react"
import { cn } from "@/lib/utils"

type Screen = "lancamentos" | "dashboard"

interface AppSidebarProps {
  currentScreen: Screen
  onScreenChange: (screen: Screen) => void
}

const menuItems = [
  {
    id: "lancamentos" as Screen,
    label: "Lançamentos",
    description: "Fluxo de Caixa",
    icon: FileText,
  },
  {
    id: "dashboard" as Screen,
    label: "Dashboard Tributário",
    description: "Os Cálculos",
    icon: LayoutDashboard,
  },
]

export function AppSidebar({ currentScreen, onScreenChange }: AppSidebarProps) {
  return (
    <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-center">
          <Image
            src="/logo.png"
            alt="FinControl - Seu Controle Financeiro Inteligente"
            width={180}
            height={60}
            className="object-contain w-auto h-auto"
            priority
          />
        </div>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = currentScreen === item.id
            return (
              <li key={item.id}>
                <button
                  onClick={() => onScreenChange(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left",
                    isActive
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  )}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-sm">{item.label}</p>
                    <p
                      className={cn(
                        "text-xs",
                        isActive ? "text-primary/70" : "text-muted-foreground"
                      )}
                    >
                      {item.description}
                    </p>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <div className="bg-sidebar-accent/50 rounded-lg p-4">
          <p className="text-xs text-muted-foreground mb-2">Contas Configuradas</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-sidebar-foreground/70">Santander</span>
              <span className="text-xs font-medium text-sky-400">PF</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-sidebar-foreground/70">Inter</span>
              <span className="text-xs font-medium text-primary">PJ</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-sidebar-foreground/70">Mercado Pago</span>
              <span className="text-xs font-medium text-primary">PJ</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}