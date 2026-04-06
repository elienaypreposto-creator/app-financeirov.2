"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { User, LogOut, ChevronDown } from "lucide-react"
import { useAuthStore, type User as UserType } from "@/lib/auth-store"

function formatCPF(cpf: string): string {
  if (cpf.length !== 11) return cpf
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
}

export function UserHeader() {
  const currentUser = useAuthStore((state) => state.currentUser)
  const logout = useAuthStore((state) => state.logout)

  if (!currentUser) return null

  return (
    <div className="flex items-center justify-end p-4 border-b border-border bg-card/50">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="flex items-center gap-3 h-auto py-2 px-3 hover:bg-secondary"
          >
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/20 text-primary">
              <User className="h-5 w-5" />
            </div>
            <div className="flex flex-col items-start">
              <span className="text-sm font-medium text-foreground">
                {currentUser.name}
              </span>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{currentUser.email}</span>
                <span className="text-muted-foreground/50">|</span>
                <span>CPF: {formatCPF(currentUser.cpf)}</span>
              </div>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 bg-card border-border">
          <div className="px-3 py-2">
            <p className="text-sm font-medium text-foreground">{currentUser.name}</p>
            <p className="text-xs text-muted-foreground mt-1">{currentUser.email}</p>
            <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
              <span>CPF: {formatCPF(currentUser.cpf)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Tel: {currentUser.phone}
            </p>
          </div>
          <DropdownMenuSeparator className="bg-border" />
          <DropdownMenuItem
            onClick={logout}
            className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}