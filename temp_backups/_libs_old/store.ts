"use client"

import { create } from "zustand"
import type { Transaction, CategoryGroup, ConciliationFile } from "./types"
import { DEFAULT_BANKS, DEFAULT_CATEGORIES, DEFAULT_PJ_BANKS } from "./types"
import { generateId } from "./parsers"

interface TransactionStore {
  transactions: Transaction[]
  files: ConciliationFile[]
  banks: string[]
  pjBanks: string[]
  categories: CategoryGroup[]
  currentFileId: string | null
  
  addFile: (file: ConciliationFile) => void
  updateFile: (id: string, updates: Partial<ConciliationFile>) => void
  deleteFile: (id: string) => void
  setCurrentFileId: (id: string | null) => void
  
  addTransactions: (transactions: Partial<Transaction>[], fileId?: string) => void
  updateTransaction: (
    id: string,
    updates: Partial<Pick<Transaction, "bank" | "category" | "completed">>
  ) => void
  deleteTransaction: (id: string) => void
  
  addBank: (bank: string, isPJ: boolean) => void
  removeBank: (bank: string) => void
  addCategory: (category: string, groupLabel: string) => void
  removeCategory: (category: string) => void
  
  getFileTransactions: (fileId: string) => Transaction[]
  recalculateFileCounts: (fileId: string) => void
  finalizeFile: (fileId: string) => void
}

export const useTransactionStore = create<TransactionStore>((set, get) => ({
  transactions: [],
  files: [],
  banks: [...DEFAULT_BANKS],
  pjBanks: [...DEFAULT_PJ_BANKS],
  categories: JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)),
  currentFileId: null,
  
  addFile: (file) =>
    set((state) => ({
      files: [file, ...state.files],
    })),
    
  updateFile: (id, updates) =>
    set((state) => ({
      files: state.files.map((f) =>
        f.id === id ? { ...f, ...updates } : f
      ),
    })),
    
  deleteFile: (id) =>
    set((state) => ({
      files: state.files.filter((f) => f.id !== id),
      transactions: state.transactions.filter((t) => t.fileId !== id),
    })),
    
  setCurrentFileId: (id) =>
    set(() => ({
      currentFileId: id,
    })),
  
  addTransactions: (newTransactions, fileId) =>
    set((state) => ({
      transactions: [
        ...state.transactions,
        ...(newTransactions.map(t => ({ 
          ...t, 
          completed: false,
          fileId: fileId || t.fileId,
        })) as Transaction[]),
      ],
    })),
    
  updateTransaction: (id, updates) => {
    set((state) => ({
      transactions: state.transactions.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
    }))
    const transaction = get().transactions.find(t => t.id === id)
    if (transaction?.fileId) {
      get().recalculateFileCounts(transaction.fileId)
    }
  },
    
  deleteTransaction: (id) => {
    const transaction = get().transactions.find(t => t.id === id)
    set((state) => ({
      transactions: state.transactions.filter((t) => t.id !== id),
    }))
    if (transaction?.fileId) {
      get().recalculateFileCounts(transaction.fileId)
    }
  },
    
  addBank: (bank, isPJ) =>
    set((state) => ({
      banks: state.banks.includes(bank) ? state.banks : [...state.banks, bank],
      pjBanks: isPJ && !state.pjBanks.includes(bank) 
        ? [...state.pjBanks, bank] 
        : state.pjBanks,
    })),
    
  removeBank: (bank) =>
    set((state) => ({
      banks: state.banks.filter((b) => b !== bank),
      pjBanks: state.pjBanks.filter((b) => b !== bank),
    })),
    
  addCategory: (category, groupLabel) =>
    set((state) => ({
      categories: state.categories.map((group) =>
        group.label === groupLabel && !group.options.includes(category)
          ? { ...group, options: [...group.options, category].sort() }
          : group
      ),
    })),
    
  removeCategory: (category) =>
    set((state) => ({
      categories: state.categories.map((group) => ({
        ...group,
        options: group.options.filter((c) => c !== category),
      })),
    })),
    
  getFileTransactions: (fileId) => {
    return get().transactions.filter(t => t.fileId === fileId)
  },
  
  recalculateFileCounts: (fileId) => {
    const transactions = get().transactions.filter(t => t.fileId === fileId)
    const completed = transactions.filter(t => t.completed).length
    const pending = transactions.filter(t => !t.completed).length
    const total = transactions.length
    
    set((state) => ({
      files: state.files.map((f) =>
        f.id === fileId 
          ? { 
              ...f, 
              completedTransactions: completed,
              pendingTransactions: pending,
              totalTransactions: total,
              status: pending === 0 && total > 0 ? "conciliado" : "pendente"
            } 
          : f
      ),
    }))
  },
  
  finalizeFile: (fileId) => {
    get().recalculateFileCounts(fileId)
    set(() => ({
      currentFileId: null,
    }))
  },
}))