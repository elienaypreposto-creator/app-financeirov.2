"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface User {
  id: string
  name: string
  email: string
  cpf: string
  phone: string
  password: string
}

interface AuthStore {
  users: User[]
  currentUser: User | null
  isAuthenticated: boolean
  register: (user: Omit<User, "id">) => { success: boolean; message: string }
  login: (identifier: string, password: string) => { success: boolean; message: string }
  logout: () => void
  requestPasswordReset: (identifier: string) => { success: boolean; message: string; newPassword?: string }
}

const generateId = () => Math.random().toString(36).substring(2, 15)

const generateTempPassword = () => Math.random().toString(36).substring(2, 10)

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      users: [],
      currentUser: null,
      isAuthenticated: false,

      register: (userData) => {
        const { users } = get()
        
        const emailExists = users.some(u => u.email.toLowerCase() === userData.email.toLowerCase())
        if (emailExists) {
          return { success: false, message: "Este email já está cadastrado." }
        }
        
        const cpfExists = users.some(u => u.cpf === userData.cpf)
        if (cpfExists) {
          return { success: false, message: "Este CPF já está cadastrado." }
        }

        const newUser: User = {
          id: generateId(),
          ...userData,
        }

        set((state) => ({
          users: [...state.users, newUser],
        }))

        return { success: true, message: "Cadastro realizado com sucesso!" }
      },

      login: (identifier, password) => {
        const { users } = get()
        
        const user = users.find(
          u => (u.email.toLowerCase() === identifier.toLowerCase() || u.cpf === identifier) && u.password === password
        )

        if (!user) {
          return { success: false, message: "Email/CPF ou senha incorretos." }
        }

        set({
          currentUser: user,
          isAuthenticated: true,
        })

        return { success: true, message: "Login realizado com sucesso!" }
      },

      logout: () => {
        set({
          currentUser: null,
          isAuthenticated: false,
        })
      },

      requestPasswordReset: (identifier) => {
        const { users } = get()
        
        const userIndex = users.findIndex(
          u => u.email.toLowerCase() === identifier.toLowerCase() || u.cpf === identifier
        )

        if (userIndex === -1) {
          return { success: false, message: "Usuário não encontrado." }
        }

        const newPassword = generateTempPassword()
        
        set((state) => ({
          users: state.users.map((u, i) => 
            i === userIndex ? { ...u, password: newPassword } : u
          ),
        }))

        return { 
          success: true, 
          message: "Nova senha gerada com sucesso!", 
          newPassword 
        }
      },
    }),
    {
      name: "fincontrol-auth",
    }
  )
)