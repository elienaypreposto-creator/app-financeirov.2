"use client"

import { useCallback, useState } from "react"
import { Upload, FileText, AlertCircle } from "lucide-react"
import { parseCSV, parseOFX } from "@/lib/parsers"
import { useTransactionStore } from "@/lib/store"
import type { Transaction } from "@/lib/types"

export function FileDropzone() {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const addTransactions = useTransactionStore((state) => state.addTransactions)

  const handleFile = useCallback(
    async (file: File) => {
      setError(null)

      const extension = file.name.split(".").pop()?.toLowerCase()
      const content = await file.text()

      let transactions: Partial<Transaction>[] = []

      if (extension === "csv") {
        transactions = parseCSV(content)
      } else if (extension === "ofx") {
        transactions = parseOFX(content)
      } else {
        setError("Formato não suportado. Use ficheiros .csv ou .ofx")
        return
      }

      if (transactions.length === 0) {
        setError("Nenhuma transação encontrada no ficheiro.")
        return
      }

      addTransactions(transactions)
    },
    [addTransactions]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)

      const files = Array.from(e.dataTransfer.files)
      files.forEach(handleFile)
    },
    [handleFile]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || [])
      files.forEach(handleFile)
      e.target.value = ""
    },
    [handleFile]
  )

  return (
    <div className="space-y-2">
      <label
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer ${
          isDragging
            ? "border-emerald-500 bg-emerald-500/10"
            : "border-slate-700 hover:border-slate-600 hover:bg-slate-800/50"
        }`}
      >
        <input
          type="file"
          accept=".csv,.ofx"
          multiple
          onChange={handleInputChange}
          className="hidden"
        />
        <Upload
          className={`mb-3 h-10 w-10 ${isDragging ? "text-emerald-500" : "text-slate-500"}`}
        />
        <p className="text-sm text-slate-400">
          Arraste ficheiros <span className="font-mono">.csv</span> ou{" "}
          <span className="font-mono">.ofx</span> aqui
        </p>
        <p className="text-xs text-slate-500 mt-1">
          ou clique para selecionar
        </p>
        <div className="flex items-center gap-4 mt-4 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <FileText className="h-3 w-3" /> CSV
          </span>
          <span className="flex items-center gap-1">
            <FileText className="h-3 w-3" /> OFX
          </span>
        </div>
      </label>
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}
    </div>
  )
}