"use client"

import { useState } from "react"
import {
  TrendingUp,
  Calculator,
  Briefcase,
  Wallet,
  Info,
  ArrowRight,
  Calendar,
  AlertCircle,
} from "lucide-react"
import { useTransactionStore } from "@/lib/store"
import { calculateTaxes } from "@/lib/calculations"
import { formatCurrency } from "@/lib/parsers"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface TaxCardProps {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  variant?: "default" | "highlight"
  info?: string
}

function TaxCard({
  title,
  icon,
  children,
  variant = "default",
  info,
}: TaxCardProps) {
  return (
    <div
      className={`rounded-xl border p-6 ${
        variant === "highlight"
          ? "bg-primary/20 border-primary/50"
          : "bg-card border-border"
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-lg ${
              variant === "highlight"
                ? "bg-primary/20 text-primary"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            {icon}
          </div>
          <h3 className="font-semibold text-slate-200">{title}</h3>
        </div>
        {info && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-slate-500 cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs bg-slate-700 border-slate-600">
                <p className="text-sm">{info}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

interface ValueRowProps {
  label: string
  value: number
  isNegative?: boolean
  highlight?: boolean
}

function ValueRow({
  label,
  value,
  isNegative = false,
  highlight = false,
}: ValueRowProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-400">{label}</span>
      <span
        className={`font-mono text-sm ${
          highlight
            ? "text-primary font-semibold text-base"
            : isNegative
              ? "text-destructive"
              : "text-foreground"
        }`}
      >
        {isNegative && value > 0 ? "-" : ""}
        {formatCurrency(Math.abs(value))}
      </span>
    </div>
  )
}

export function TaxDashboard() {
  const [selectedYear, setSelectedYear] = useState("all")
  const [selectedMonth, setSelectedMonth] = useState("all")
  
  const transactions = useTransactionStore((state) => state.transactions)
  
  const availableYears = [
    ...new Set(transactions.map((t) => t.date.getFullYear().toString())),
  ].sort((a, b) => parseInt(b) - parseInt(a))

  const months = [
    { value: "all", label: "Todos os meses" },
    { value: "0", label: "Janeiro" },
    { value: "1", label: "Fevereiro" },
    { value: "2", label: "Março" },
    { value: "3", label: "Abril" },
    { value: "4", label: "Maio" },
    { value: "5", label: "Junho" },
    { value: "6", label: "Julho" },
    { value: "7", label: "Agosto" },
    { value: "8", label: "Setembro" },
    { value: "9", label: "Outubro" },
    { value: "10", label: "Novembro" },
    { value: "11", label: "Dezembro" },
  ]
  
  const filteredTransactions = transactions.filter((t) => {
    if (selectedYear !== "all" && t.date.getFullYear().toString() !== selectedYear) {
      return false
    }
    if (selectedMonth !== "all" && t.date.getMonth().toString() !== selectedMonth) {
      return false
    }
    return true
  })
  
  const taxes = calculateTaxes(filteredTransactions)
  const pendingCount = filteredTransactions.filter((t) => !t.completed).length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Calendar className="h-4 w-4 text-slate-400" />
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[120px] bg-slate-800 border-slate-700 text-slate-200 text-sm">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem
                value="all"
                className="text-slate-200 focus:bg-slate-700 focus:text-slate-100"
              >
                Todos os anos
              </SelectItem>
              {availableYears.map((year) => (
                <SelectItem
                  key={year}
                  value={year}
                  className="text-slate-200 focus:bg-slate-700 focus:text-slate-100"
                >
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[160px] bg-slate-800 border-slate-700 text-slate-200 text-sm">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              {months.map((month) => (
                <SelectItem
                  key={month.value}
                  value={month.value}
                  className="text-slate-200 focus:bg-slate-700 focus:text-slate-100"
                >
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex gap-4 text-sm">
          <span className="text-slate-400">
            Total: <span className="text-slate-200 font-medium">{filteredTransactions.length}</span>
          </span>
          <span className="text-slate-400">
            Concluídas: <span className="text-primary font-medium">{taxes.completedTransactions}</span>
          </span>
        </div>
      </div>

      {pendingCount > 0 && (
        <div className="rounded-xl border border-amber-500/50 bg-amber-900/20 p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-amber-400" />
            <div>
              <p className="text-sm font-medium text-amber-200">
                Existem {pendingCount} transações pendentes de classificação
              </p>
              <p className="text-xs text-amber-300/70 mt-1">
                Os cálculos abaixo consideram apenas transações marcadas como concluídas.
              </p>
            </div>
          </div>
        </div>
      )}

      {taxes.completedTransactions === 0 ? (
        <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-8 text-center">
          <p className="text-slate-400">
            Nenhuma transação concluída no período selecionado.
          </p>
          <p className="text-sm text-slate-500 mt-2">
            Classifique as transações na aba Lançamentos e marque-as como concluídas.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2">
            <TaxCard
              title="Receitas PJ"
              icon={<TrendingUp className="h-5 w-5" />}
              info="Total de entradas nas contas PJ (Inter e Mercado Pago)"
            >
              <ValueRow label="Faturamento Total" value={taxes.faturamentoTotal} />
              <ValueRow label="Rendimentos" value={taxes.rendimentos} />
              <div className="border-t border-slate-700 pt-3 mt-3">
                <ValueRow
                  label="Total Bruto"
                  value={taxes.faturamentoTotal + taxes.rendimentos}
                  highlight
                />
              </div>
            </TaxCard>

            <TaxCard
              title="Provisão de Impostos"
              icon={<Calculator className="h-5 w-5" />}
              info="Para manter a taxa de 6%, o seu Pró-labore deve ser 28% do faturamento."
            >
              <ValueRow
                label="Pró-labore Ideal (28%)"
                value={taxes.proLaboreIdeal}
                isNegative
              />
              <ValueRow
                label="DAS Simples Nacional (6%)"
                value={taxes.das}
                isNegative
              />
              <ValueRow
                label="INSS a Pagar (11%)"
                value={taxes.inssPagar}
                isNegative
              />
              <div className="border-t border-slate-700 pt-3 mt-3">
                <ValueRow
                  label="Total Impostos"
                  value={taxes.proLaboreIdeal + taxes.das + taxes.inssPagar}
                  isNegative
                />
              </div>
              <div className="mt-3 p-3 rounded-lg bg-amber-900/30 border border-amber-700/50">
                <p className="text-xs text-amber-300">
                  Para manter a taxa de 6%, o seu Pró-labore deve ser 28% do
                  faturamento.
                </p>
              </div>
            </TaxCard>

            <TaxCard
              title="Custos PJ"
              icon={<Briefcase className="h-5 w-5" />}
              info="Despesas operacionais e honorários contábeis"
            >
              <ValueRow
                label="Despesas Operacionais + Honorários"
                value={taxes.totalDespesas}
                isNegative
              />
            </TaxCard>

            <TaxCard
              title="Lucro Isento a Transferir"
              icon={<Wallet className="h-5 w-5" />}
              variant="highlight"
              info="Valor que pode ser transferido como distribuição de lucros, isento de IR"
            >
              <ValueRow label="Lucro Líquido" value={taxes.lucroIsento} highlight />

              <div className="mt-4 p-4 rounded-lg bg-primary/30 border border-primary/50">
                <div className="flex items-start gap-3">
                  <ArrowRight className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-primary font-medium">
                      Instrução
                    </p>
                    <p className="text-xs text-primary/80 mt-1">
                      Transfira exatamente{" "}
                      <span className="font-mono font-semibold">
                        {formatCurrency(taxes.lucroIsento)}
                      </span>{" "}
                      para o Santander como "Distribuição de Lucros" (Isento de IR).
                    </p>
                  </div>
                </div>
              </div>
            </TaxCard>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-6">
            <h3 className="font-semibold text-slate-200 mb-4">
              Resumo do Cálculo
            </h3>
            <div className="text-sm text-slate-400 font-mono bg-slate-900/50 rounded-lg p-4 overflow-x-auto">
              <div className="space-y-1">
                <p>
                  Faturamento Total:{" "}
                  <span className="text-primary">
                    {formatCurrency(taxes.faturamentoTotal)}
                  </span>
                </p>
                <p>
                  + Rendimentos:{" "}
                  <span className="text-primary">
                    {formatCurrency(taxes.rendimentos)}
                  </span>
                </p>
                <p>
                  - Pró-labore (28%):{" "}
                  <span className="text-destructive">
                    {formatCurrency(taxes.proLaboreIdeal)}
                  </span>
                </p>
                <p>
                  - DAS (6%):{" "}
                  <span className="text-destructive">
                    {formatCurrency(taxes.das)}
                  </span>
                </p>
                <p>
                  - INSS (11% do pró-labore):{" "}
                  <span className="text-destructive">
                    {formatCurrency(taxes.inssPagar)}
                  </span>
                </p>
                <p>
                  - Despesas:{" "}
                  <span className="text-destructive">
                    {formatCurrency(taxes.totalDespesas)}
                  </span>
                </p>
                <div className="border-t border-slate-700 mt-2 pt-2">
                  <p className="text-base">
                    = Lucro Isento:{" "}
                    <span className="text-emerald-400 font-bold">
                      {formatCurrency(taxes.lucroIsento)}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}