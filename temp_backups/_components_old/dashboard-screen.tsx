"use client"

import { TaxDashboard } from "./tax-dashboard"

export function DashboardScreen() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-100">
          Dashboard Tributário
        </h2>
        <p className="text-slate-400 mt-1">
          Cálculos automáticos do Simples Nacional
        </p>
      </div>

      <TaxDashboard />
    </div>
  )
}