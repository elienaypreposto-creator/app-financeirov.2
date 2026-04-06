export interface Transaction {
  id: string
  date: Date
  description: string
  value: number
  bank: string
  category: string
  completed: boolean
  fileId?: string
}

export interface ConciliationFile {
  id: string
  importDate: Date
  bankName: string
  bankAgency: string
  bankAccount: string
  periodStart: Date
  periodEnd: Date
  totalTransactions: number
  completedTransactions: number
  ignoredTransactions: number
  pendingTransactions: number
  status: "pendente" | "conciliado"
}

export interface CategoryGroup {
  label: string
  options: string[]
}

export const DEFAULT_BANKS = ["Santander", "Inter", "Mercado Pago"]

export const DEFAULT_CATEGORIES: CategoryGroup[] = [
  {
    label: "Entradas",
    options: ["Receita de Clientes", "Rendimento de Aplicação", "Salário CLT"],
  },
  {
    label: "Saídas",
    options: [
      "Pró-labore",
      "Distribuição de Lucros",
      "Despesas Operacionais PJ",
      "Honorários Contábeis",
      "DAS Simples Nacional",
      "Despesas Pessoais",
    ],
  },
]

export const DEFAULT_PJ_BANKS = ["Inter", "Mercado Pago", "Santander", "Caixa"]  