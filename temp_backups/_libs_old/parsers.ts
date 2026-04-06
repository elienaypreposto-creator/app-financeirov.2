import Papa from "papaparse"
import type { Transaction } from "./types"

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15)
}

export function parseCSV(content: string): Partial<Transaction>[] {
  const result = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
  })

  return result.data.map((row: Record<string, string>) => {
    const dateStr = row.Data || row.date || row.DATE || ""
    const description =
      row.Descrição ||
      row.Descricao ||
      row.description ||
      row.DESCRIPTION ||
      row.Memo ||
      ""
    const valueStr = row.Valor || row.value || row.VALUE || row.Amount || "0"

    const value = parseFloat(
      valueStr.replace(/[^\d,.-]/g, "").replace(",", ".")
    )

    let parsedDate = new Date()
    if (dateStr) {
      const parts = dateStr.split(/[/-]/)
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          parsedDate = new Date(
            parseInt(parts[0]),
            parseInt(parts[1]) - 1,
            parseInt(parts[2])
          )
        } else {
          parsedDate = new Date(
            parseInt(parts[2]),
            parseInt(parts[1]) - 1,
            parseInt(parts[0])
          )
        }
      }
    }

    return {
      id: generateId(),
      date: parsedDate,
      description: description.trim(),
      value: isNaN(value) ? 0 : value,
      bank: "Santander",
      category: "Despesas Pessoais",
      completed: false,
    }
  })
}

export function parseOFX(content: string): Partial<Transaction>[] {
  const transactions: Partial<Transaction>[] = []

  const stmtTrnRegex =
    /<STMTTRN>([\s\S]*?)<\/STMTTRN>|<STMTTRN>([\s\S]*?)(?=<STMTTRN>|<\/BANKTRANLIST>)/gi
  const matches = content.match(stmtTrnRegex) || []

  for (const match of matches) {
    const dtPostedMatch = match.match(/<DTPOSTED>(\d{8})/i)
    const trnAmtMatch = match.match(/<TRNAMT>([+-]?\d+\.?\d*)/i)
    const memoMatch = match.match(/<MEMO>([^<\n]+)/i)
    const nameMatch = match.match(/<NAME>([^<\n]+)/i)

    let parsedDate = new Date()
    if (dtPostedMatch) {
      const dateStr = dtPostedMatch[1]
      const year = parseInt(dateStr.substring(0, 4))
      const month = parseInt(dateStr.substring(4, 6)) - 1
      const day = parseInt(dateStr.substring(6, 8))
      parsedDate = new Date(year, month, day)
    }

    const value = trnAmtMatch ? parseFloat(trnAmtMatch[1]) : 0
    const description = (memoMatch?.[1] || nameMatch?.[1] || "").trim()

    if (description || value !== 0) {
      transactions.push({
        id: generateId(),
        date: parsedDate,
        description,
        value,
        bank: "Santander",
        category: "Despesas Pessoais",
        completed: false,
      })
    }
  }

  return transactions
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR").format(date)
}