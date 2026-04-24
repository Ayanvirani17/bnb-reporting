"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"

export default function Dashboard() {
  const [results, setResults] = useState<any[]>([])
  const [period, setPeriod] = useState("")
  const [availablePeriods, setAvailablePeriods] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const { data } = await supabase.from("pl_results").select("*")
    if (!data || data.length === 0) { setLoading(false); return }
    const periods = Array.from(new Set(data.map((d: any) => d.period)))
    setAvailablePeriods(periods)
    const latest = periods[periods.length - 1]
    setPeriod(latest)
    setResults(data.filter((d: any) => d.period === latest))
    setLoading(false)
  }

  const handleChange = async (p: string) => {
    setPeriod(p)
    const { data } = await supabase.from("pl_results").select("*").eq("period", p)
    setResults(data || [])
  }

  const total = (cat: string) =>
    results.filter(r => r.pl_category === cat).reduce((s, r) => s + r.amount, 0)

  const revenue = total("Revenue")
  const cogs = Math.abs(total("Cost of Sales"))
  const expenses = Math.abs(total("Operating Expenses"))
  const gross = revenue - cogs
  const ebitda = gross - expenses
  const margin = revenue > 0 ? ((ebitda / revenue) * 100).toFixed(1) : "0.0"

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n)

  const lineItems = (cat: string) =>
    results.filter(r => r.pl_category === cat)

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-white text-xl animate-pulse">Loading financials...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 md:p-12">

      {/* Header */}
      <div className="max-w-5xl mx-auto mb-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-indigo-400 mb-1">Financial Report</p>
          <h1 className="text-4xl font-extrabold tracking-tight">BNB Restaurant & Cafe</h1>
          <p className="text-gray-400 mt-1 text-sm">Profit & Loss Statement</p>
        </div>
        <select
          value={period}
          onChange={(e) => handleChange(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-white px-5 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {availablePeriods.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {/* KPI Cards */}
      <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {[
          { label: "Revenue", value: fmt(revenue), color: "from-indigo-500 to-indigo-700", icon: "📈" },
          { label: "Gross Profit", value: fmt(gross), color: gross >= 0 ? "from-blue-500 to-blue-700" : "from-red-500 to-red-700", icon: "💰" },
          { label: "Total Expenses", value: fmt(expenses), color: "from-rose-500 to-rose-700", icon: "📉" },
          { label: "Net Profit", value: fmt(ebitda), color: ebitda >= 0 ? "from-emerald-500 to-emerald-700" : "from-red-500 to-red-700", icon: ebitda >= 0 ? "🟢" : "🔴" },
        ].map((card) => (
          <div key={card.label} className={`bg-gradient-to-br ${card.color} rounded-2xl p-5 shadow-lg`}>
            <p className="text-xs uppercase tracking-widest opacity-80 mb-2">{card.icon} {card.label}</p>
            <p className="text-2xl font-bold">{card.value}</p>
          </div>
        ))}
      </div>

      {/* P&L Table */}
      <div className="max-w-5xl mx-auto bg-gray-900 rounded-2xl shadow-2xl overflow-hidden mb-6">

        {/* Revenue */}
        <div className="px-8 py-5 border-b border-gray-800">
          <p className="text-xs uppercase tracking-widest text-indigo-400 mb-4">Revenue</p>
          {lineItems("Revenue").map((r, i) => (
            <div key={i} className="flex justify-between py-2 text-sm text-gray-300 border-b border-gray-800/50">
              <span>{r.pl_line_item}</span>
              <span className="text-indigo-300">{fmt(Math.abs(r.amount))}</span>
            </div>
          ))}
          <div className="flex justify-between py-3 font-bold text-white mt-1">
            <span>Total Revenue</span>
            <span className="text-indigo-400">{fmt(revenue)}</span>
          </div>
        </div>

        {/* Cost of Sales */}
        <div className="px-8 py-5 border-b border-gray-800">
          <p className="text-xs uppercase tracking-widest text-rose-400 mb-4">Cost of Sales</p>
          {lineItems("Cost of Sales").map((r, i) => (
            <div key={i} className="flex justify-between py-2 text-sm text-gray-300 border-b border-gray-800/50">
              <span>{r.pl_line_item}</span>
              <span className="text-rose-300">({fmt(Math.abs(r.amount))})</span>
            </div>
          ))}
          <div className="flex justify-between py-3 font-bold text-white mt-1">
            <span>Total Cost of Sales</span>
            <span className="text-rose-400">({fmt(cogs)})</span>
          </div>
        </div>

        {/* Gross Profit */}
        <div className="px-8 py-5 bg-blue-950/40 border-b border-gray-800">
          <div className="flex justify-between font-bold text-xl">
            <span className="text-blue-300">Gross Profit</span>
            <span className={gross >= 0 ? "text-blue-300" : "text-red-400"}>{fmt(gross)}</span>
          </div>
        </div>

        {/* Operating Expenses */}
        <div className="px-8 py-5 border-b border-gray-800">
          <p className="text-xs uppercase tracking-widest text-amber-400 mb-4">Operating Expenses</p>
          {lineItems("Operating Expenses").map((r, i) => (
            <div key={i} className="flex justify-between py-2 text-sm text-gray-300 border-b border-gray-800/50">
              <span>{r.pl_line_item}</span>
              <span className="text-amber-300">({fmt(Math.abs(r.amount))})</span>
            </div>
          ))}
          <div className="flex justify-between py-3 font-bold text-white mt-1">
            <span>Total Operating Expenses</span>
            <span className="text-amber-400">({fmt(expenses)})</span>
          </div>
        </div>

        {/* Net Profit */}
        <div className={`px-8 py-6 ${ebitda >= 0 ? "bg-emerald-950/40" : "bg-red-950/40"}`}>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Bottom Line</p>
              <p className={`text-2xl font-extrabold ${ebitda >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                Net Profit
              </p>
            </div>
            <div className="text-right">
              <p className={`text-3xl font-extrabold ${ebitda >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {fmt(ebitda)}
              </p>
              <p className="text-xs text-gray-400 mt-1">Margin: {margin}%</p>
            </div>
          </div>
        </div>

      </div>

      {/* Footer */}
      <p className="text-center text-gray-600 text-xs mt-6">
        BNB Financial Reporting System • Auto-generated from Trial Balance
      </p>

    </div>
  )
}