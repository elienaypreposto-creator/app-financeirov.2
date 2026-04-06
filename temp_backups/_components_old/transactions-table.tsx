"use client"

import { useState } from "react"
import { AlertTriangle, Trash2, Check, Plus, X, Calendar } from "lucide-react"
import { useTransactionStore } from "@/lib/store"
import { formatCurrency, formatDate } from "@/lib/parsers"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import type { Transaction } from "@/lib/types"

function hasRisk(transaction: Transaction, pjBanks: string[]): boolean {
  return (
    pjBanks.includes(transaction.bank) &&
    transaction.category === "Despesas Pessoais"
  )
}

interface FiltersProps {
  selectedYear: string
  selectedMonth: string
  onYearChange: (year: string) => void
  onMonthChange: (month: string) => void
  availableYears: string[]
}

function Filters({
  selectedYear,
  selectedMonth,
  onYearChange,
  onMonthChange,
  availableYears,
}: FiltersProps) {
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

  return (
    <div className="flex items-center gap-3">
      <Calendar className="h-4 w-4 text-slate-400" />
      <Select value={selectedYear} onValueChange={onYearChange}>
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
      <Select value={selectedMonth} onValueChange={onMonthChange}>
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
  )
}

function ManageBanksDialog() {
  const [newBank, setNewBank] = useState("")
  const [isPJ, setIsPJ] = useState(false)
  const banks = useTransactionStore((state) => state.banks)
  const pjBanks = useTransactionStore((state) => state.pjBanks)
  const addBank = useTransactionStore((state) => state.addBank)
  const removeBank = useTransactionStore((state) => state.removeBank)

  const handleAdd = () => {
    if (newBank.trim()) {
      addBank(newBank.trim(), isPJ)
      setNewBank("")
      setIsPJ(false)
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700"
        >
          <Plus className="h-3 w-3 mr-1" />
          Gerir Bancos
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-800 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-slate-100">Gerir Bancos</DialogTitle>
          <DialogDescription className="text-slate-400">
            Adicione ou remova bancos. Marque como PJ para ativar alertas de risco tributário.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Nome do banco"
              value={newBank}
              onChange={(e) => setNewBank(e.target.value)}
              className="bg-slate-900 border-slate-600 text-slate-200"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <Button onClick={handleAdd} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="isPJ"
              checked={isPJ}
              onCheckedChange={(checked) => setIsPJ(checked === true)}
            />
            <label htmlFor="isPJ" className="text-sm text-slate-300">
              Conta PJ (ativa alerta de risco tributário)
            </label>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-slate-400">Bancos existentes:</p>
            <div className="flex flex-wrap gap-2">
              {banks.map((bank) => (
                <Badge
                  key={bank}
                  variant="secondary"
                  className="bg-slate-700 text-slate-200 flex items-center gap-1"
                >
                  {bank}
                  {pjBanks.includes(bank) && (
                    <span className="text-xs text-primary">(PJ)</span>
                  )}
                  <button
                    onClick={() => removeBank(bank)}
                    className="ml-1 hover:text-red-400"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ManageCategoriesDialog() {
  const [newCategory, setNewCategory] = useState("")
  const [selectedGroup, setSelectedGroup] = useState("Entradas")
  const categories = useTransactionStore((state) => state.categories)
  const addCategory = useTransactionStore((state) => state.addCategory)
  const removeCategory = useTransactionStore((state) => state.removeCategory)

  const handleAdd = () => {
    if (newCategory.trim()) {
      addCategory(newCategory.trim(), selectedGroup)
      setNewCategory("")
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700"
        >
          <Plus className="h-3 w-3 mr-1" />
          Gerir Categorias
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-slate-100">Gerir Categorias</DialogTitle>
          <DialogDescription className="text-slate-400">
            Adicione ou remova categorias de Entradas e Saídas.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Nome da categoria"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="bg-slate-900 border-slate-600 text-slate-200 flex-1"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger className="w-[120px] bg-slate-900 border-slate-600 text-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem
                  value="Entradas"
                  className="text-slate-200 focus:bg-slate-700"
                >
                  Entradas
                </SelectItem>
                <SelectItem
                  value="Saídas"
                  className="text-slate-200 focus:bg-slate-700"
                >
                  Saídas
                </SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleAdd} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-4">
            {categories.map((group) => (
              <div key={group.label}>
                <p className="text-sm font-medium text-slate-300 mb-2">
                  {group.label}
                </p>
                <div className="flex flex-wrap gap-2">
                  {group.options.map((cat) => (
                    <Badge
                      key={cat}
                      variant="secondary"
                      className="bg-slate-700 text-slate-200 flex items-center gap-1"
                    >
                      {cat}
                      <button
                        onClick={() => removeCategory(cat)}
                        className="ml-1 hover:text-red-400"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function TransactionsTable() {
  const [selectedYear, setSelectedYear] = useState("all")
  const [selectedMonth, setSelectedMonth] = useState("all")

  const transactions = useTransactionStore((state) => state.transactions)
  const banks = useTransactionStore((state) => state.banks)
  const pjBanks = useTransactionStore((state) => state.pjBanks)
  const categories = useTransactionStore((state) => state.categories)
  const updateTransaction = useTransactionStore(
    (state) => state.updateTransaction
  )
  const deleteTransaction = useTransactionStore(
    (state) => state.deleteTransaction
  )

  const availableYears = [
    ...new Set(transactions.map((t) => t.date.getFullYear().toString())),
  ].sort((a, b) => parseInt(b) - parseInt(a))

  const filteredTransactions = transactions.filter((t) => {
    if (selectedYear !== "all" && t.date.getFullYear().toString() !== selectedYear) {
      return false
    }
    if (selectedMonth !== "all" && t.date.getMonth().toString() !== selectedMonth) {
      return false
    }
    return true
  })

  const sortedTransactions = [...filteredTransactions].sort(
    (a, b) => b.date.getTime() - a.date.getTime()
  )

  const pendingCount = filteredTransactions.filter((t) => !t.completed).length
  const completedCount = filteredTransactions.filter((t) => t.completed).length

  if (transactions.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <ManageBanksDialog />
            <ManageCategoriesDialog />
          </div>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-8 text-center">
          <p className="text-slate-400">
            Nenhuma transação. Importe um ficheiro acima.
          </p>
        </div>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-2">
            <ManageBanksDialog />
            <ManageCategoriesDialog />
          </div>
          <Filters
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            onYearChange={setSelectedYear}
            onMonthChange={setSelectedMonth}
            availableYears={availableYears}
          />
        </div>

        <div className="flex gap-4 text-sm">
          <span className="text-slate-400">
            Pendentes: <span className="text-amber-400 font-medium">{pendingCount}</span>
          </span>
          <span className="text-slate-400">
            Concluídas: <span className="text-primary font-medium">{completedCount}</span>
          </span>
        </div>

        <div className="rounded-lg border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800/80">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider w-12">
                    <span className="sr-only">Status</span>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Data
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Descrição
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Valor
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Banco
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Categoria
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider w-12">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {sortedTransactions.map((transaction) => {
                  const isRisk = hasRisk(transaction, pjBanks)
                  return (
                    <tr
                      key={transaction.id}
                      className={`transition-colors ${
                        isRisk
                          ? "bg-red-900/20 border-l-2 border-l-red-500"
                          : transaction.completed
                          ? "bg-primary/10"
                          : "hover:bg-slate-800/50"
                      }`}
                    >
                      <td className="px-4 py-3">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() =>
                                updateTransaction(transaction.id, {
                                  completed: !transaction.completed,
                                })
                              }
                              className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors ${
transaction.completed
                                                  ? "bg-primary border-primary text-primary-foreground"
                                                  : "border-muted-foreground hover:border-primary"
                              }`}
                            >
                              {transaction.completed && <Check className="h-3 w-3" />}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="bg-slate-700 border-slate-600">
                            <p className="text-sm">
                              {transaction.completed
                                ? "Marcar como pendente"
                                : "Marcar como concluída"}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-300">
                        {formatDate(transaction.date)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        <div className="flex items-center gap-2">
                          {transaction.description}
                          {isRisk && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                className="bg-red-900 border-red-700 text-red-100"
                              >
                                <p className="text-sm font-medium">
                                  Risco Tributário
                                </p>
                                <p className="text-xs">
                                  Despesa PF paga na conta PJ.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </td>
                      <td
                        className={`px-4 py-3 whitespace-nowrap text-sm text-right font-mono ${
                          transaction.value >= 0
                            ? "text-primary"
                            : "text-destructive"
                        }`}
                      >
                        {formatCurrency(transaction.value)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Select
                          value={transaction.bank}
                          onValueChange={(value) =>
                            updateTransaction(transaction.id, { bank: value })
                          }
                          disabled={transaction.completed}
                        >
                          <SelectTrigger 
                            className={`w-[140px] bg-slate-800 border-slate-700 text-slate-200 text-sm ${
                              transaction.completed ? "opacity-60" : ""
                            }`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-800 border-slate-700">
                            {banks.map((bank) => (
                              <SelectItem
                                key={bank}
                                value={bank}
                                className="text-slate-200 focus:bg-slate-700 focus:text-slate-100"
                              >
                                {bank}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Select
                          value={transaction.category}
                          onValueChange={(value) =>
                            updateTransaction(transaction.id, { category: value })
                          }
                          disabled={transaction.completed}
                        >
                          <SelectTrigger 
                            className={`w-[200px] bg-slate-800 border-slate-700 text-slate-200 text-sm ${
                              transaction.completed ? "opacity-60" : ""
                            }`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-800 border-slate-700">
                            {categories.map((group) => (
                              <SelectGroup key={group.label}>
                                <SelectLabel className="text-slate-400 text-xs">
                                  {group.label}
                                </SelectLabel>
                                {group.options.map((cat) => (
                                  <SelectItem
                                    key={cat}
                                    value={cat}
                                    className="text-slate-200 focus:bg-slate-700 focus:text-slate-100"
                                  >
                                    {cat}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteTransaction(transaction.id)}
                          className="h-8 w-8 text-slate-400 hover:text-red-400 hover:bg-red-900/20"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Eliminar</span>
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}