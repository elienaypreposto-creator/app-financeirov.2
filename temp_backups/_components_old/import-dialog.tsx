"use client"

import { useState } from "react"
import { Upload, FileText, X, Building2 } from "lucide-react"
import { useTransactionStore } from "@/lib/store"
import { parseCSV, parseOFX, generateId } from "@/lib/parsers"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ConciliationFile } from "@/lib/types"

interface ImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImportComplete: (fileId: string) => void
}

export function ImportDialog({ open, onOpenChange, onImportComplete }: ImportDialogProps) {
  const banks = useTransactionStore((state) => state.banks)
  const addFile = useTransactionStore((state) => state.addFile)
  const addTransactions = useTransactionStore((state) => state.addTransactions)
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [bankName, setBankName] = useState("")
  const [bankAgency, setBankAgency] = useState("")
  const [bankAccount, setBankAccount] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && (file.name.endsWith(".csv") || file.name.endsWith(".ofx"))) {
      setSelectedFile(file)
      setError(null)
    } else {
      setError("Por favor, selecione um arquivo .csv ou .ofx")
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setError(null)
    }
  }

  const handleImport = async () => {
    if (!selectedFile || !bankName) {
      setError("Por favor, selecione um arquivo e um banco")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const content = await selectedFile.text()
      let transactions
      
      if (selectedFile.name.endsWith(".csv")) {
        transactions = parseCSV(content)
      } else {
        transactions = parseOFX(content)
      }

      if (transactions.length === 0) {
        setError("Nenhuma transação encontrada no arquivo")
        setIsLoading(false)
        return
      }

      const fileId = generateId()
      
      const dates = transactions.map(t => new Date(t.date))
      const periodStart = new Date(Math.min(...dates.map(d => d.getTime())))
      const periodEnd = new Date(Math.max(...dates.map(d => d.getTime())))

      const newFile: ConciliationFile = {
        id: fileId,
        importDate: new Date(),
        bankName,
        bankAgency: bankAgency || "0000",
        bankAccount: bankAccount || "00000000-0",
        periodStart,
        periodEnd,
        totalTransactions: transactions.length,
        completedTransactions: 0,
        ignoredTransactions: 0,
        pendingTransactions: transactions.length,
        status: "pendente",
      }

      const transactionsWithFile = transactions.map(t => ({
        ...t,
        bank: bankName,
        fileId,
      }))

      addFile(newFile)
      addTransactions(transactionsWithFile, fileId)
      
      setSelectedFile(null)
      setBankName("")
      setBankAgency("")
      setBankAccount("")
      onOpenChange(false)
      onImportComplete(fileId)
    } catch {
      setError("Erro ao processar o arquivo. Verifique o formato.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setSelectedFile(null)
    setBankName("")
    setBankAgency("")
    setBankAccount("")
    setError(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Importar Extrato</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Selecione um arquivo .csv ou .ofx e informe os dados do banco.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              border-2 border-dashed rounded-lg p-6 text-center transition-colors
              ${isDragging ? "border-primary bg-primary/10" : "border-border"}
              ${selectedFile ? "bg-primary/5" : ""}
            `}
          >
            {selectedFile ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="h-8 w-8 text-primary" />
                <div className="text-left">
                  <p className="font-medium text-foreground">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedFile(null)}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label className="cursor-pointer">
                <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-foreground">
                  Arraste um arquivo ou clique para selecionar
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Formatos aceitos: .csv, .ofx
                </p>
                <input
                  type="file"
                  accept=".csv,.ofx"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <Label className="text-foreground">Banco</Label>
              <Select value={bankName} onValueChange={setBankName}>
                <SelectTrigger className="mt-1 bg-background border-border text-foreground">
                  <SelectValue placeholder="Selecione o banco" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
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
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-foreground">Agência</Label>
                <div className="relative mt-1">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={bankAgency}
                    onChange={(e) => setBankAgency(e.target.value)}
                    placeholder="0000"
                    className="pl-9 bg-background border-border text-foreground"
                  />
                </div>
              </div>
              <div>
                <Label className="text-foreground">Conta</Label>
                <Input
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  placeholder="00000000-0"
                  className="mt-1 bg-background border-border text-foreground"
                />
              </div>
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={handleClose}
              className="border-border"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleImport}
              disabled={!selectedFile || !bankName || isLoading}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isLoading ? "Importando..." : "Importar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}