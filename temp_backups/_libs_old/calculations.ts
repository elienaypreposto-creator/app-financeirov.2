import type { Transaction } from "./types"

export interface TaxCalculations {
  faturamentoTotal: number
  rendimentos: number
  proLaboreIdeal: number
  das: number
  inssPagar: number
  totalDespesas: number
  lucroIsento: number
  totalTransactions: number
  completedTransactions: number
}

export function calculateTaxes(transactions: Transaction[]): TaxCalculations {
  // Only use completed transactions for tax calculations
  const completedTransactions = transactions.filter((t) => t.completed)
  
  const faturamentoTotal = completedTransactions
    .filter((t) => t.category === "Receita de Clientes")
    .reduce((sum, t) => sum + t.value, 0)

  const rendimentos = completedTransactions
    .filter((t) => t.category === "Rendimento de Aplicação")
    .reduce((sum, t) => sum + t.value, 0)

  const proLaboreIdeal = faturamentoTotal * 0.28

  const das = faturamentoTotal * 0.06

  const inssPagar = proLaboreIdeal * 0.11

  const totalDespesas = completedTransactions
    .filter(
      (t) =>
        t.category === "Despesas Operacionais PJ" ||
        t.category === "Honorários Contábeis"
    )
    .reduce((sum, t) => sum + Math.abs(t.value), 0)

  const lucroIsento =
    faturamentoTotal +
    rendimentos -
    (proLaboreIdeal + das + inssPagar + totalDespesas)

  return {
    faturamentoTotal,
    rendimentos,
    proLaboreIdeal,
    das,
    inssPagar,
    totalDespesas,
    lucroIsento,
    totalTransactions: transactions.length,
    completedTransactions: completedTransactions.length,
  }
}