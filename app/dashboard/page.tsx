"use client"

import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabaseClient"
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

interface PLResult {
  period: string;
  pl_category: string;
  pl_line_item: string;
  amount: number;
}

interface Metrics {
  revenue: number;
  cogs: number;
  variable: number;
  opex: number;
  nonOpex: number;
  gm: number;
  cm: number;
  net: number;
}

export default function Dashboard() {
  const [results, setResults] = useState<PLResult[]>([])
  const [period, setPeriod] = useState("")
  const [comparePeriod, setComparePeriod] = useState("")
  const [availablePeriods, setAvailablePeriods] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [showCompare, setShowCompare] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExportMenu(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const loadData = async () => {
    const { data } = await supabase.from("pl_results").select("*")
    if (!data || data.length === 0) { setLoading(false); return }
    const periods = Array.from(new Set(data.map((d: PLResult) => d.period)))
    setAvailablePeriods(periods)
    const latest = periods[periods.length - 1]
    setPeriod(latest)
    setComparePeriod(periods[0])
    setResults(data)
    setLoading(false)
  }

  const toggle = (cat: string) => setExpanded(prev => ({ ...prev, [cat]: !prev[cat] }))

  const totalFor = (p: string, cat: string) =>
    results.filter(r => r.period === p && r.pl_category === cat).reduce((s, r) => s + r.amount, 0)

  const getMetrics = (p: string): Metrics => {
    const revenue = totalFor(p, "Revenue")
    const cogs = totalFor(p, "COGS")
    const variable = totalFor(p, "Variable Cost")
    const opex = totalFor(p, "Opex")
    const nonOpex = totalFor(p, "Non Opex")
    const gm = revenue - cogs
    const cm = gm - variable
    const net = cm - opex - nonOpex
    return { revenue, cogs, variable, opex, nonOpex, gm, cm, net }
  }

  const m = getMetrics(period)
  const mc = getMetrics(comparePeriod)

  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)
  const pct = (val: number, rev: number) => rev > 0 ? ((val / rev) * 100).toFixed(1) + "%" : "0.0%"
  const varSign = (v: number) => v > 0 ? `+${fmt(v)}` : fmt(v)
  const varColor = (v: number, inverse = false) => {
    if (v === 0) return "text-gray-400"
    return (inverse ? v < 0 : v > 0) ? "text-emerald-400" : "text-red-400"
  }

  // ── EXPORTS ──────────────────────────────────────────────
  const exportToExcel = () => {
    setShowExportMenu(false)
    const wsData = showCompare ? [
      ["BNB Restaurant & Cafe — Comparative P&L"],
      ["", period, comparePeriod, "Variance"],
      ["Revenue", m.revenue, mc.revenue, mc.revenue - m.revenue],
      ["COGS", m.cogs, mc.cogs, mc.cogs - m.cogs],
      ["Gross Margin", m.gm, mc.gm, mc.gm - m.gm],
      ["Variable Cost", m.variable, mc.variable, mc.variable - m.variable],
      ["Contribution Margin", m.cm, mc.cm, mc.cm - m.cm],
      ["Opex", m.opex, mc.opex, mc.opex - m.opex],
      ["Non Opex", m.nonOpex, mc.nonOpex, mc.nonOpex - m.nonOpex],
      ["Net Profit", m.net, mc.net, mc.net - m.net],
    ] : [
      ["BNB Restaurant & Cafe — P&L Statement"],
      ["Period", period],
      [""],
      ["Category", "Amount", "% of Revenue"],
      ["Revenue", m.revenue, "100%"],
      ["COGS", m.cogs, pct(m.cogs, m.revenue)],
      ["Gross Margin", m.gm, pct(m.gm, m.revenue)],
      ["Variable Cost", m.variable, pct(m.variable, m.revenue)],
      ["Contribution Margin", m.cm, pct(m.cm, m.revenue)],
      ["Opex", m.opex, pct(m.opex, m.revenue)],
      ["Non Opex", m.nonOpex, pct(m.nonOpex, m.revenue)],
      ["Net Profit", m.net, pct(m.net, m.revenue)],
    ]
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "P&L")
    XLSX.writeFile(wb, `PL_${period}.xlsx`)
  }

  const exportToPDF = () => {
    setShowExportMenu(false)
    const doc = new jsPDF({ orientation: showCompare ? "landscape" : "portrait" })

    doc.setFontSize(16)
    doc.setFont("helvetica", "bold")
    doc.text("BNB Restaurant & Cafe", 14, 18)
    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(100)
    doc.text(showCompare ? `${period}  vs  ${comparePeriod}` : `P&L Statement — ${period}`, 14, 26)
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 32)
    doc.setTextColor(0)

    const rows = showCompare ? [
      ["Revenue", fmt(m.revenue), fmt(mc.revenue), varSign(mc.revenue - m.revenue)],
      ["COGS", fmt(m.cogs), fmt(mc.cogs), varSign(mc.cogs - m.cogs)],
      ["Gross Margin", fmt(m.gm), fmt(mc.gm), varSign(mc.gm - m.gm)],
      ["Variable Cost", fmt(m.variable), fmt(mc.variable), varSign(mc.variable - m.variable)],
      ["Contribution Margin", fmt(m.cm), fmt(mc.cm), varSign(mc.cm - m.cm)],
      ["Opex", fmt(m.opex), fmt(mc.opex), varSign(mc.opex - m.opex)],
      ["Non Opex", fmt(m.nonOpex), fmt(mc.nonOpex), varSign(mc.nonOpex - m.nonOpex)],
      ["NET PROFIT", fmt(m.net), fmt(mc.net), varSign(mc.net - m.net)],
    ] : [
      ["Revenue", fmt(m.revenue), "100%"],
      ["COGS", fmt(m.cogs), pct(m.cogs, m.revenue)],
      ["Gross Margin", fmt(m.gm), pct(m.gm, m.revenue)],
      ["Variable Cost", fmt(m.variable), pct(m.variable, m.revenue)],
      ["Contribution Margin", fmt(m.cm), pct(m.cm, m.revenue)],
      ["Opex", fmt(m.opex), pct(m.opex, m.revenue)],
      ["Non Opex", fmt(m.nonOpex), pct(m.nonOpex, m.revenue)],
      ["NET PROFIT", fmt(m.net), pct(m.net, m.revenue)],
    ]

    const startY = 40
    const rowH = 10
    const cols = showCompare ? [70, 50, 50, 50] : [90, 55, 40]
    const startX = 14
    const totalW = cols.reduce((a, b) => a + b, 0)

    doc.setFillColor(79, 70, 229)
    doc.setTextColor(255)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.rect(startX, startY, totalW, rowH, 'F')

    if (showCompare) {
      doc.text("Category", startX + 3, startY + 7)
      doc.text(period, startX + cols[0] + 3, startY + 7)
      doc.text(comparePeriod, startX + cols[0] + cols[1] + 3, startY + 7)
      doc.text("Variance", startX + cols[0] + cols[1] + cols[2] + 3, startY + 7)
    } else {
      doc.text("Category", startX + 3, startY + 7)
      doc.text("Amount", startX + cols[0] + 3, startY + 7)
      doc.text("% of Revenue", startX + cols[0] + cols[1] + 3, startY + 7)
    }

    rows.forEach((row, i) => {
      const y = startY + rowH * (i + 1)
      if (i % 2 === 0) {
        doc.setFillColor(245, 245, 255)
        doc.rect(startX, y, totalW, rowH, 'F')
      }
      doc.setTextColor(0)
      doc.setFont("helvetica", row[0] === "NET PROFIT" ? "bold" : "normal")
      doc.setFontSize(9)
      row.forEach((cell, ci) => {
        const x = startX + cols.slice(0, ci).reduce((a, b) => a + b, 0) + 3
        doc.text(cell, x, y + 7)
      })
      doc.setDrawColor(220, 220, 220)
      doc.line(startX, y + rowH, startX + totalW, y + rowH)
    })

    doc.save(`PL_${period}.pdf`)
  }

  // ── MAIN P&L ROW ─────────────────────────────────────────
  const Row = ({ label, amount, category, isPercent = false }: {
    label: string; amount: number; category: string; isPercent?: boolean
  }) => {
    const items = results.filter(r => r.period === period && r.pl_category === category)
    const hasItems = items.length > 0 && !isPercent
    return (
      <div className="w-full">
        <div
          onClick={() => hasItems && toggle(category)}
          className={`flex justify-between px-4 sm:px-8 py-3 border-b border-gray-800 transition-all
            ${hasItems ? 'cursor-pointer hover:bg-gray-800/40' : ''}
            ${isPercent ? 'bg-gray-900/60 text-xs text-gray-500 italic py-2' : ''}
          `}
        >
          <div className="flex items-center gap-2 text-sm sm:text-base">
            {hasItems && <span className="text-[10px] text-gray-500">{expanded[category] ? '▼' : '▶'}</span>}
            <span>{label}</span>
          </div>
          <span className={`text-sm sm:text-base font-mono ${amount < 0 ? 'text-red-400' : ''}`}>
            {isPercent ? pct(amount, m.revenue) : fmt(amount)}
          </span>
        </div>
        {expanded[category] && !isPercent && items.map((item, i) => (
          <div key={i} className="flex justify-between px-8 sm:px-14 py-2 text-xs text-gray-500 border-b border-gray-800/20 bg-gray-950/60">
            <span>{item.pl_line_item}</span>
            <span className="font-mono">{fmt(item.amount)}</span>
          </div>
        ))}
      </div>
    )
  }

  const SubtotalRow = ({ label, amount, color }: { label: string; amount: number; color: string }) => (
    <div className={`px-4 sm:px-8 py-4 flex justify-between items-center border-y ${color}`}>
      <span className="text-sm font-black uppercase tracking-wide">{label}</span>
      <span className="text-sm sm:text-lg font-black font-mono">{fmt(amount)}</span>
    </div>
  )

  // ── COMPARE ROW ───────────────────────────────────────────
  const CompareRow = ({ label, a, b, inverse = false }: {
    label: string; a: number; b: number; inverse?: boolean
  }) => {
    const v = b - a
    return (
      <div className="grid grid-cols-4 px-4 sm:px-6 py-3 border-b border-gray-800 text-sm">
        <span className="text-gray-300">{label}</span>
        <span className="text-right font-mono">{fmt(a)}</span>
        <span className="text-right font-mono">{fmt(b)}</span>
        <span className={`text-right font-mono font-bold ${varColor(v, inverse)}`}>{varSign(v)}</span>
      </div>
    )
  }

  const CompareSubRow = ({ label, a, b, color }: { label: string; a: number; b: number; color: string }) => {
    const v = b - a
    return (
      <div className={`grid grid-cols-4 px-4 sm:px-6 py-3 border-y font-black text-sm ${color}`}>
        <span>{label}</span>
        <span className="text-right font-mono">{fmt(a)}</span>
        <span className="text-right font-mono">{fmt(b)}</span>
        <span className={`text-right font-mono ${varColor(v)}`}>{varSign(v)}</span>
      </div>
    )
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white text-sm font-mono">
      Loading...
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">

        {/* HEADER */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-tighter">BNB Financial</h1>
          <p className="text-gray-500 text-xs mt-1 uppercase tracking-widest">Profit & Loss Dashboard</p>
        </div>

        {/* CONTROLS */}
        <div className="flex flex-wrap gap-3 mb-6 items-center">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="flex-1 min-w-[130px] bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {availablePeriods.map(p => <option key={p} value={p}>{p}</option>)}
          </select>

          {/* Compare Toggle */}
          <button
            onClick={() => setShowCompare(!showCompare)}
            className={`flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-black uppercase tracking-wider transition-all border ${
              showCompare
                ? 'bg-emerald-600 border-emerald-500 text-white'
                : 'bg-gray-900 border-gray-700 text-gray-300 hover:border-emerald-500 hover:text-emerald-400'
            }`}
          >
            ⇄ {showCompare ? 'Hide Compare' : 'Compare'}
          </button>

          {/* Export Dropdown */}
          <div className="relative" ref={exportRef}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 transition-all rounded-xl px-5 py-3 text-sm font-black uppercase tracking-wider shadow-lg"
            >
              ⬇ Export <span className="text-xs">{showExportMenu ? '▲' : '▼'}</span>
            </button>
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-44 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                <button onClick={exportToExcel} className="w-full text-left px-5 py-3 text-sm hover:bg-gray-800 transition-all flex items-center gap-3">
                  <span>📊</span> Excel (.xlsx)
                </button>
                <div className="border-t border-gray-800" />
                <button onClick={exportToPDF} className="w-full text-left px-5 py-3 text-sm hover:bg-gray-800 transition-all flex items-center gap-3">
                  <span>📄</span> PDF (.pdf)
                </button>
              </div>
            )}
          </div>
        </div>

        {/* MAIN P&L */}
        <div className="bg-gray-900/40 rounded-2xl border border-gray-800 overflow-hidden shadow-2xl mb-6">
          <Row label="Revenue" amount={m.revenue} category="Revenue" />
          <Row label="COGS %" amount={m.cogs} category="COGS" isPercent />
          <Row label="COGS" amount={m.cogs} category="COGS" />
          <SubtotalRow label="Gross Margin" amount={m.gm} color="bg-indigo-500/10 border-indigo-500/20 text-indigo-300" />
          <Row label="GM %" amount={m.gm} category="GM" isPercent />
          <Row label="Variable Cost" amount={m.variable} category="Variable Cost" />
          <SubtotalRow label="Contribution Margin" amount={m.cm} color="bg-emerald-500/10 border-emerald-500/20 text-emerald-300" />
          <Row label="Contribution Margin %" amount={m.cm} category="CM" isPercent />
          <Row label="Opex" amount={m.opex} category="Opex" />
          <Row label="Opex %" amount={m.opex} category="Opex" isPercent />
          <Row label="Non Opex" amount={m.nonOpex} category="Non Opex" />
          <Row label="Non Opex %" amount={m.nonOpex} category="Non Opex" isPercent />

          {/* NET PROFIT */}
          <div className={`px-4 sm:px-8 py-6 flex justify-between items-center ${m.net >= 0 ? 'bg-indigo-600/20' : 'bg-red-600/20'}`}>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">Bottom Line</p>
              <h2 className="text-xl sm:text-2xl font-black uppercase">Net Profit</h2>
            </div>
            <div className="text-right">
              <p className={`text-xl sm:text-2xl font-black font-mono ${m.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(m.net)}</p>
              <p className="text-xs text-gray-500 mt-1 font-mono">NP% {pct(m.net, m.revenue)}</p>
            </div>
          </div>
        </div>

        {/* COMPARE SECTION — toggles open/closed */}
        {showCompare && (
          <div className="mt-2">
            <div className="flex flex-wrap gap-3 items-center mb-4">
              <p className="text-xs uppercase tracking-widest text-gray-500">Comparing against:</p>
              <select
                value={comparePeriod}
                onChange={(e) => setComparePeriod(e.target.value)}
                className="flex-1 min-w-[130px] bg-gray-900 border border-emerald-700 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {availablePeriods.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            {/* Compare Column Headers */}
            <div className="grid grid-cols-4 px-4 sm:px-6 py-2 text-[10px] uppercase tracking-widest text-gray-500 border-b border-gray-800">
              <span>Category</span>
              <span className="text-right">{period}</span>
              <span className="text-right">{comparePeriod}</span>
              <span className="text-right">Variance</span>
            </div>

            <div className="bg-gray-900/40 rounded-2xl border border-emerald-800/40 overflow-hidden shadow-2xl">
              <CompareRow label="Revenue" a={m.revenue} b={mc.revenue} />
              <CompareRow label="COGS" a={m.cogs} b={mc.cogs} inverse />
              <CompareSubRow label="Gross Margin" a={m.gm} b={mc.gm} color="bg-indigo-500/10 border-indigo-500/20 text-indigo-300" />
              <CompareRow label="Variable Cost" a={m.variable} b={mc.variable} inverse />
              <CompareSubRow label="Contribution Margin" a={m.cm} b={mc.cm} color="bg-emerald-500/10 border-emerald-500/20 text-emerald-300" />
              <CompareRow label="Opex" a={m.opex} b={mc.opex} inverse />
              <CompareRow label="Non Opex" a={m.nonOpex} b={mc.nonOpex} inverse />

              {/* Compare Net Profit */}
              <div className="grid grid-cols-4 px-4 sm:px-6 py-5 bg-indigo-600/20 items-center">
                <span className="font-black uppercase text-sm">Net Profit</span>
                <span className="text-right font-black font-mono text-sm">{fmt(m.net)}</span>
                <span className="text-right font-black font-mono text-sm">{fmt(mc.net)}</span>
                <span className={`text-right font-black font-mono text-sm ${varColor(mc.net - m.net)}`}>
                  {varSign(mc.net - m.net)}
                </span>
              </div>
            </div>

            {/* Legend */}
            <div className="flex gap-4 mt-3 text-xs text-gray-600 justify-end">
              <span className="text-emerald-500">▲ Positive variance</span>
              <span className="text-red-400">▼ Negative variance</span>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}