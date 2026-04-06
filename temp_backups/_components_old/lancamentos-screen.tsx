"use client"

import { FileDropzone } from "./file-dropzone"
import { TransactionsTable } from "./transactions-table"

export function LancamentosScreen() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-100">Lançamentos</h2>
        <p className="text-slate-400 mt-1">
          Importe extratos e categorize as transações
        </p>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-6">
        <h3 className="font-semibold text-slate-200 mb-4">
          Importar Extrato
        </h3>
        <FileDropzone />
      </div>

      <div>
        <h3 className="font-semibold text-slate-200 mb-4">
          Transações
        </h3>
        <TransactionsTable />
      </div>
    </div>
  )
}