"use client"

import { useState, useMemo } from "react"
import {
  Search,
  Download,
  Trash2,
  RefreshCw,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
} from "lucide-react"
import { useTransactionStore } from "@/lib/store"
import { formatDate } from "@/lib/parsers"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { ConciliationFile } from "@/lib/types"

interface ConciliationListProps {
  onImport: () => void
  onViewFile: (fileId: string) => void
}

const ITEMS_PER_PAGE = 10

export function ConciliationList({ onImport, onViewFile }: ConciliationListProps) {
  const files = useTransactionStore((state) => state.files)
  const banks = useTransactionStore((state) => state.banks)
  const deleteFile = useTransactionStore((state) => state.deleteFile)
  
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [bankFilter, setBankFilter] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [dateRange, setDateRange] = useState({
    start: "",
    end: "",
  })
  const [currentPage, setCurrentPage] = useState(1)

  const filteredFiles = useMemo(() => {
    return files.filter((file) => {
      if (statusFilter !== "all" && file.status !== statusFilter) return false
      if (bankFilter !== "all" && file.bankName !== bankFilter) return false
      if (searchTerm) {
        const search = searchTerm.toLowerCase()
        const matchesBank = file.bankName.toLowerCase().includes(search)
        const matchesAccount = file.bankAccount.toLowerCase().includes(search)
        const matchesAgency = file.bankAgency.toLowerCase().includes(search)
        if (!matchesBank && !matchesAccount && !matchesAgency) return false
      }
      if (dateRange.start) {
        const startDate = new Date(dateRange.start)
        if (new Date(file.importDate) < startDate) return false
      }
      if (dateRange.end) {
        const endDate = new Date(dateRange.end)
        endDate.setHours(23, 59, 59, 999)
        if (new Date(file.importDate) > endDate) return false
      }
      return true
    })
  }, [files, statusFilter, bankFilter, searchTerm, dateRange])

  const totalPages = Math.ceil(filteredFiles.length / ITEMS_PER_PAGE)
  const paginatedFiles = filteredFiles.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  const handleExport = (file: ConciliationFile) => {
    const transactions = useTransactionStore.getState().getFileTransactions(file.id)
    const csvContent = [
      ["Data", "Descrição", "Valor", "Banco", "Categoria", "Status"].join(";"),
      ...transactions.map(t => [
        formatDate(t.date),
        t.description,
        t.value.toFixed(2).replace(".", ","),
        t.bank,
        t.category,
        t.completed ? "Concluído" : "Pendente"
      ].join(";"))
    ].join("\n")
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `extrato_${file.bankName}_${formatDate(file.periodStart)}_${formatDate(file.periodEnd)}.csv`
    link.click()
  }

  const formatDateTime = (date: Date) => {
    const d = new Date(date)
    return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  }

  const formatPeriod = (start: Date, end: Date) => {
    return `De ${formatDate(start)} à ${formatDate(end)}`
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">Arquivos de conciliação</h2>
        <Button 
          onClick={onImport}
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          Importar
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 pb-4 border-b border-border">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px] bg-card border-border text-foreground text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="all" className="text-foreground focus:bg-secondary">
              Todos
            </SelectItem>
            <SelectItem value="conciliado" className="text-foreground focus:bg-secondary">
              Conciliado
            </SelectItem>
            <SelectItem value="pendente" className="text-foreground focus:bg-secondary">
              Pendente
            </SelectItem>
          </SelectContent>
        </Select>

        <Select value={bankFilter} onValueChange={setBankFilter}>
          <SelectTrigger className="w-[150px] bg-card border-border text-foreground text-sm">
            <SelectValue placeholder="Conta" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="all" className="text-foreground focus:bg-secondary">
              Todas as Contas
            </SelectItem>
            {banks.map((bank) => (
              <SelectItem 
                key={bank} 
                value={bank}
                className="text-foreground focus:bg-secondary"
              >
                {bank}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            className="w-[140px] bg-card border-border text-foreground text-sm"
          />
          <span className="text-muted-foreground">-</span>
          <Input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            className="w-[140px] bg-card border-border text-foreground text-sm"
          />
        </div>

        <Button 
          variant="outline" 
          size="icon"
          className="border-border bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={() => {
            setStatusFilter("all")
            setBankFilter("all")
            setSearchTerm("")
            setDateRange({ start: "", end: "" })
            setCurrentPage(1)
          }}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-card border-border text-foreground"
          />
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-secondary/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Data
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Banco
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Período
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Conciliados
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Ignorados
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Pendentes
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Total
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedFiles.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                    {files.length === 0 
                      ? "Nenhum arquivo importado. Clique em \"Importar\" para começar."
                      : "Nenhum arquivo corresponde aos filtros selecionados."}
                  </td>
                </tr>
              ) : (
                paginatedFiles.map((file) => (
                  <tr 
                    key={file.id} 
                    className="hover:bg-secondary/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Badge 
                        className={
                          file.status === "conciliado"
                            ? "bg-primary/20 text-primary border-primary/30 hover:bg-primary/30"
                            : "bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30"
                        }
                      >
                        {file.status === "conciliado" ? "CONCILIADO" : "PENDENTE"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {formatDateTime(file.importDate)}
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{file.bankName}</p>
                        <p className="text-xs text-muted-foreground">
                          Agência: {file.bankAgency} | Conta: {file.bankAccount}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {formatPeriod(file.periodStart, file.periodEnd)}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-foreground">
                      {file.completedTransactions}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-foreground">
                      {file.ignoredTransactions}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-foreground">
                      {file.pendingTransactions}
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-medium text-foreground">
                      {file.totalTransactions}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={() => onViewFile(file.id)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Visualizar</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={() => handleExport(file)}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Exportar CSV</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => deleteFile(file.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Excluir</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {filteredFiles.length > 0 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            {(currentPage - 1) * ITEMS_PER_PAGE + 1} a{" "}
            {Math.min(currentPage * ITEMS_PER_PAGE, filteredFiles.length)} de{" "}
            {filteredFiles.length}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="border-border"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="border-border"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-3 text-sm text-muted-foreground">
              Página {currentPage} de {totalPages || 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="border-border"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages || totalPages === 0}
              className="border-border"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}