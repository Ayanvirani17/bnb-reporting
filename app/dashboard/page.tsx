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

export default function Dashboard() {
  const [results, setResults] = useState<PLResult[]>([])
  const [period1, setPeriod1] = useState("")
  const [period2, setPeriod2] = useState("")
  const [availablePeriods, setAvailablePeriods] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [showExportMenu, setShowExportMenu] = useState(false)
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
    setPeriod1(periods[0])
    setPeriod2(periods[periods.length - 1])
    setResults(data)
    setLoading(false)
  }

  const toggle = (cat: string) => setExpanded(prev => ({ ...prev, [cat]: !prev[cat] }))

  const totalFor = (period: string, cat: string) =>
    results.filter(r => r.period === period && r.pl_category === cat).reduce((s, r) => s + r.amount, 0)

  const itemsFor = (period: string, cat: string) =>
    results.filter(r => r.period === period && r.pl_category === cat)

  // Period 1 calculations
  const p1 = {
    revenue: totalFor(period1, "Revenue"),
    cogs: totalFor(period1, "COGS"),
    variable: totalFor(period1, "Variable Cost"),
    opex: totalFor(period1, "Opex"),
    nonOpex: totalFor(period1, "Non Opex"),
  }
  p1.gm = p1.revenue - p1.cogs
  p1.cm = p1.gm - p1.variable
  p1.net = p1.cm - p1.opex - p1.nonOpex

  // Period 2 calculations
  const p2 = {
    revenue: totalFor(period2, "Revenue"),
    cogs: totalFor(period2, "COGS"),
    variable: totalFor(period2, "Variable Cost"),
    opex: totalFor(period2, "Opex"),
    nonOpex: totalFor(period2, "Non Opex"),
  }
  p2.gm = p2.revenue - p2.cogs
  p2.cm = p2.gm - p2.variable
  p2.net = p2.cm - p2.opex - p2.nonOpex

  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)
  const pct = (val: number, rev: number) => rev > 0 ? ((val / rev) * 100).toFixed(1) + "%" : "0.0%"
  const variance = (a: number, b: number) => a - b
  const varColor = (v: number, inverse = false) => {
    if (v === 0) return "text-gray-400"
    const positive = inverse ? v < 0 : v > 0
    return positive ? "text-emerald-400" : "text-red-400"
  }
  const varSign = (v: number) => v > 0 ? `+${fmt(v)}` : fmt(v)

  const exportToExcel = () => {
    setShowExportMenu(false)
    const wsData = [
      ["BNB Restaurant & Cafe - Comparative P&L"],
      [""],
      ["Category", period1, period2, "Variance"],
      ["Revenue", p1.revenue, p2.revenue, variance(p2.revenue, p1.revenue)],
      ["COGS", p1.cogs, p2.cogs, variance(p2.cogs, p1.cogs)],
      ["Gross Margin", p1.gm, p2.gm, variance(p2.gm, p1.gm)],
      ["Variable Cost", p1.variable, p2.variable, variance(p2.variable, p1.variable)],
      ["Contribution Margin", p1.cm, p2.cm, variance(p2.cm, p1.cm)],
      ["Opex", p1.opex, p2.opex, variance(p2.opex, p1.opex)],
      ["Non Opex", p1.nonOpex, p2.nonOpex, variance(p2.nonOpex, p1.nonOpex)],
      ["Net Profit", p1.net, p2.net, variance(p2.net, p1.net)],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Comparative P&L");
    XLSX.writeFile(wb, `Comparative_PL.xlsx`);
  }

  const exportToPDF = () => {
    setShowExportMenu(false)
    const doc = new jsPDF({ orientation: "landscape" });

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("BNB Restaurant & Cafe — Comparative P&L", 14, 18);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(`${period1}  vs  ${period2}`, 14, 26);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 32);
    doc.setTextColor(0);

    const rows = [
      ["Revenue", fmt(p1.revenue), fmt(p2.revenue), varSign(variance(p2.revenue, p1.revenue))],
      ["COGS", fmt(p1.cogs), fmt(p2.cogs), varSign(variance(p2.cogs, p1.cogs))],
      ["Gross Margin", fmt(p1.gm), fmt(p2.gm), varSign(variance(p2.gm, p1.gm))],
      ["Variable Cost", fmt(p1.variable), fmt(p2.variable), varSign(variance(p2.variable, p1.variable))],
      ["Contribution Margin", fmt(p1.cm), fmt(p2.cm), varSign(variance(p2.cm, p1.cm))],
      ["Opex", fmt(p1.opex), fmt(p2.opex), varSign(variance(p2.opex, p1.opex))],
      ["Non Opex", fmt(p1.nonOpex), fmt(p2.nonOpex), varSign(variance(p2.nonOpex, p1.nonOpex))],
      ["NET PROFIT", fmt(p1.net), fmt(p2.net), varSign(variance(p2.net, p1.net))],
    ]

    const startY = 40;
    const rowH = 10;
    const cols = [70, 55, 55, 55];
    const startX = 14;

    // Header
    doc.setFillColor(79, 70, 229);
    doc.setTextColor(255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    const totalW = cols.reduce((a, b) => a + b, 0);
    doc.rect(startX, startY, totalW, rowH, 'F');
    doc.text("Category", startX + 3, startY + 7);
    doc.text(period1, startX + cols[0] + 3, startY + 7);
    doc.text(period2, startX + cols[0] + cols[1] + 3, startY + 7);
    doc.text("Variance", startX + cols[0] + cols[1] + cols[2] + 3, startY + 7);

    rows.forEach((row, i) => {
      const y = startY + rowH * (i + 1);
      if (i % 2 === 0) {
        doc.setFillColor(245, 245, 255);
        doc.rect(startX, y, totalW, rowH, 'F');
      }
      doc.setTextColor(0);
      doc.setFont("helvetica", row[0] === "NET PROFIT" ? "bold" : "normal");
      doc.setFontSize(9);
      doc.text(row[0], startX + 3, y + 7);
      doc.text(row[1], startX + cols[0] + 3, y + 7);
      doc.text(row[2], startX + cols[0] + cols[1] + 3, y + 7);
      doc.text(row[3], startX + cols[0] + cols[1] + cols[2] + 3, y + 7);
      doc.setDrawColor(220, 220, 220);
      doc.line(startX, y + rowH, startX + totalW, y + rowH);
    });

    doc.save(`Comparative_PL.pdf`);
  }

  // Reusable row component
  const Row = ({ label, a, b, cat, inverse = false }: {
    label: string; a: number; b: number; cat: string; inverse?: boolean
  }) => {
    const v = variance(b, a)
    const items1 = itemsFor(period1, cat)
    const items2 = itemsFor(period2, cat)
    const hasItems = items1.length > 0 || items2.length > 0

    return (
      <div>
        <div
          onClick={() => hasItems && toggle(cat)}
          className={`grid grid-cols-4 px-4 sm:px-6 py-3 border-b border-gray-800 text-sm transition-all ${hasItems ? 'cursor-pointer hover:bg-gray-800/30' : ''}`}
        >
          <div className="flex items-center gap-2 col-span-1">
            {hasItems && <span className="text-[10px] text-gray-500">{expanded[cat] ? '▼' : '▶'}</span>}
            <span className="font-medium">{label}</span>
          </div>
          <span className="text-right font-mono">{fmt(a)}</span>
          <span className="text-right font-mono">{fmt(b)}</span>
          <span className={`text-right font-mono font-bold ${varColor(v, inverse)}`}>{varSign(v)}</span>
        </div>

        {expanded[cat] && (
          <div className="bg-gray-950/60">
            {Array.from(new Set([...items1.map(i => i.pl_line_item), ...items2.map(i => i.pl_line_item)])).map((line, i) => {
              const a1 = items1.find(x => x.pl_line_item === line)?.amount || 0
              const b1 = items2.find(x => x.pl_line_item === line)?.amount || 0
              return (
                <div key={i} className="grid grid-cols-4 px-8 sm:px-12 py-2 text-xs text-gray-400 border-b border-gray-800/20">
                  <span className="col-span-1">{line}</span>
                  <span className="text-right font-mono">{fmt(a1)}</span>
                  <span className="text-right font-mono">{fmt(b1)}</span>
                  <span className={`text-right font-mono ${varColor(variance(b1, a1), inverse)}`}>{varSign(variance(b1, a1))}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const SubRow = ({ label, a, b, color, inverse = false }: {
    label: string; a: number; b: number; color: string; inverse?: boolean
  }) => {
    const v = variance(b, a)
    return (
      <div className={`grid grid-cols-4 px-4 sm:px-6 py-4 border-y font-black text-sm sm:text-base ${color}`}>
        <span className="uppercase tracking-wide">{label}</span>
        <span className="text-right font-mono">{fmt(a)}</span>
        <span className="text-right font-mono">{fmt(b)}</span>
        <span className={`text-right font-mono ${varColor(v, inverse)}`}>{varSign(v)}</span>
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
      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">

        {/* HEADER */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-tighter">BNB Financial</h1>
          <p className="text-gray-500 text-xs mt-1 uppercase tracking-widest">Comparative P&L Dashboard</p>
        </div>

        {/* CONTROLS */}
        <div className="flex flex-wrap gap-3 mb-8 items-center">
          <select
            value={period1}
            onChange={(e) => setPeriod1(e.target.value)}
            className="flex-1 min-w-[130px] bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {availablePeriods.map(p => <option key={p} value={p}>{p}</option>)}
          </select>

          <span className="text-gray-500 font-bold text-sm">vs</span>

          <select
            value={period2}
            onChange={(e) => setPeriod2(e.target.value)}
            className="flex-1 min-w-[130px] bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {availablePeriods.map(p => <option key={p} value={p}>{p}</option>)}
          </select>

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

        {/* COLUMN HEADERS */}
        <div className="grid grid-cols-4 px-4 sm:px-6 py-3 text-[10px] uppercase tracking-widest text-gray-500 border-b border-gray-800">
          <span>Category</span>
          <span className="text-right">{period1}</span>
          <span className="text-right">{period2}</span>
          <span className="text-right">Variance</span>
        </div>

        {/* P&L BODY */}
        <div className="bg-gray-900/40 rounded-2xl border border-gray-800 overflow-hidden shadow-2xl">

          <Row label="Revenue" a={p1.revenue} b={p2.revenue} cat="Revenue" />
          <Row label="COGS" a={p1.cogs} b={p2.cogs} cat="COGS" inverse />
          <SubRow label="Gross Margin" a={p1.gm} b={p2.gm} color="bg-indigo-500/10 border-indigo-500/20 text-indigo-300" />

          <Row label="Variable Cost" a={p1.variable} b={p2.variable} cat="Variable Cost" inverse />
          <SubRow label="Contribution Margin" a={p1.cm} b={p2.cm} color="bg-emerald-500/10 border-emerald-500/20 text-emerald-300" />

          <Row label="Opex" a={p1.opex} b={p2.opex} cat="Opex" inverse />
          <Row label="Non Opex" a={p1.nonOpex} b={p2.nonOpex} cat="Non Opex" inverse />

          {/* NET PROFIT */}
          <div className={`grid grid-cols-4 px-4 sm:px-6 py-6 sm:py-8 items-center ${p2.net >= 0 ? 'bg-indigo-600/20' : 'bg-red-600/20'}`}>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">Bottom Line</p>
              <h2 className="text-base sm:text-2xl font-black uppercase">Net Profit</h2>
            </div>
            <span className="text-right font-mono font-black text-sm sm:text-lg">{fmt(p1.net)}</span>
            <span className="text-right font-mono font-black text-sm sm:text-lg">{fmt(p2.net)}</span>
            <span className={`text-right font-mono font-black text-sm sm:text-lg ${varColor(variance(p2.net, p1.net))}`}>
              {varSign(variance(p2.net, p1.net))}
            </span>
          </div>

        </div>

        {/* LEGEND */}
        <div className="flex gap-4 mt-4 text-xs text-gray-600 justify-end">
          <span className="text-emerald-500">▲ Positive variance</span>
          <span className="text-red-400">▼ Negative variance</span>
        </div>

      </div>
    </div>
  )
}