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
  const [period, setPeriod] = useState("")
  const [availablePeriods, setAvailablePeriods] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [showExportMenu, setShowExportMenu] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)

  useEffect(() => { loadData() }, [])

  // Close export menu when clicking outside
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
    setResults(data.filter((d: PLResult) => d.period === latest))
    setLoading(false)
  }

  const handleChange = async (p: string) => {
    setPeriod(p)
    const { data } = await supabase.from("pl_results").select("*").eq("period", p)
    setResults(data || [])
  }

  const toggle = (cat: string) => setExpanded(prev => ({ ...prev, [cat]: !prev[cat] }))

  const total = (cat: string) => results.filter(r => r.pl_category === cat).reduce((s, r) => s + r.amount, 0)

  const revenue = total("Revenue")
  const cogs = total("COGS")
  const gm = revenue - cogs
  const variableCosts = total("Variable Cost")
  const contributionMargin = gm - variableCosts
  const opex = total("Opex")
  const nonOpex = total("Non Opex")
  const netProfit = contributionMargin - opex - nonOpex

  const pct = (val: number) => revenue > 0 ? ((val / revenue) * 100).toFixed(1) : "0.0"
  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n)

  const exportToExcel = () => {
    setShowExportMenu(false)
    const wsData = [
      ["BNB Restaurant & Cafe - P&L Statement"],
      ["Period", period],
      ["Generated", new Date().toLocaleDateString()],
      [""],
      ["Category", "Amount", "% of Revenue"],
      ["Revenue", revenue, "100%"],
      ["COGS", cogs, `${pct(cogs)}%`],
      ["Gross Margin", gm, `${pct(gm)}%`],
      ["Variable Cost", variableCosts, `${pct(variableCosts)}%`],
      ["Contribution Margin", contributionMargin, `${pct(contributionMargin)}%`],
      ["Opex", opex, `${pct(opex)}%`],
      ["Non Opex", nonOpex, `${pct(nonOpex)}%`],
      ["Net Profit", netProfit, `${pct(netProfit)}%`]
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "P&L Report");
    XLSX.writeFile(wb, `PL_${period}.xlsx`);
  }

  const exportToPDF = () => {
    setShowExportMenu(false)
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("BNB Restaurant & Cafe", 14, 18);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(`Profit & Loss Statement — ${period}`, 14, 26);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 32);
    doc.setTextColor(0);

    const rows = [
      ['Revenue', fmt(revenue), '100%'],
      ['COGS', fmt(cogs), `${pct(cogs)}%`],
      ['Gross Margin (GM)', fmt(gm), `${pct(gm)}%`],
      ['Variable Cost', fmt(variableCosts), `${pct(variableCosts)}%`],
      ['Contribution Margin', fmt(contributionMargin), `${pct(contributionMargin)}%`],
      ['Opex', fmt(opex), `${pct(opex)}%`],
      ['Non Opex', fmt(nonOpex), `${pct(nonOpex)}%`],
      ['NET PROFIT', fmt(netProfit), `${pct(netProfit)}%`],
    ];

    const startY = 42;
    const rowHeight = 10;
    const colWidths = [90, 55, 40];
    const startX = 14;

    doc.setFillColor(79, 70, 229);
    doc.setTextColor(255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.rect(startX, startY, colWidths[0] + colWidths[1] + colWidths[2], rowHeight, 'F');
    doc.text("Category", startX + 3, startY + 7);
    doc.text("Amount", startX + colWidths[0] + 3, startY + 7);
    doc.text("% of Revenue", startX + colWidths[0] + colWidths[1] + 3, startY + 7);

    rows.forEach((row, i) => {
      const y = startY + rowHeight * (i + 1);
      const isHighlight = row[0].includes("Margin") || row[0].includes("PROFIT");

      if (isHighlight) {
        doc.setFillColor(240, 240, 255);
        doc.rect(startX, y, colWidths[0] + colWidths[1] + colWidths[2], rowHeight, 'F');
      }

      doc.setTextColor(0);
      doc.setFont("helvetica", row[0] === 'NET PROFIT' ? "bold" : "normal");
      doc.text(row[0], startX + 3, y + 7);
      doc.text(row[1], startX + colWidths[0] + 3, y + 7);
      doc.text(row[2], startX + colWidths[0] + colWidths[1] + 3, y + 7);

      doc.setDrawColor(220, 220, 220);
      doc.line(startX, y + rowHeight, startX + colWidths[0] + colWidths[1] + colWidths[2], y + rowHeight);
    });

    doc.save(`PL_${period}.pdf`);
  }

  const Row = ({ label, amount, category, isPercent = false }: {
    label: string;
    amount: number;
    category: string;
    isPercent?: boolean;
  }) => {
    const items = results.filter(r => r.pl_category === category);
    const hasItems = items.length > 0 && !isPercent;

    return (
      <div className="w-full">
        <div
          onClick={() => hasItems && toggle(category)}
          className={`flex justify-between px-4 sm:px-8 py-3 sm:py-4 border-b border-gray-800 transition-all
            ${hasItems ? 'cursor-pointer hover:bg-gray-800/40' : ''}
            ${isPercent ? 'bg-gray-900/60 text-xs text-gray-500 italic py-2' : ''}
          `}
        >
          <div className="flex items-center gap-2 text-sm sm:text-base">
            {hasItems && (
              <span className="text-[10px] text-gray-500">
                {expanded[category] ? '▼' : '▶'}
              </span>
            )}
            <span>{label}</span>
          </div>
          <span className={`text-sm sm:text-base font-mono ${amount < 0 ? 'text-red-400' : ''}`}>
            {isPercent ? `${pct(amount)}%` : fmt(amount)}
          </span>
        </div>

        {expanded[category] && !isPercent && items.map((item, i) => (
          <div key={i} className="flex justify-between px-8 sm:px-14 py-2 text-xs text-gray-500 border-b border-gray-800/20 bg-gray-950/60">
            <span>{item.pl_line_item}</span>
            <span className="font-mono">{fmt(item.amount)}</span>
          </div>
        ))}
      </div>
    );
  }

  const SubtotalRow = ({ label, amount, color }: { label: string; amount: number; color: string }) => (
    <div className={`px-4 sm:px-8 py-4 sm:py-5 flex justify-between items-center border-y ${color}`}>
      <span className="text-sm sm:text-base font-black uppercase tracking-wide">{label}</span>
      <span className="text-sm sm:text-lg font-black font-mono">{fmt(amount)}</span>
    </div>
  )

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white text-sm font-mono">
      Loading...
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-14">

        {/* HEADER */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-tighter">BNB Financial</h1>
          <p className="text-gray-500 text-xs mt-1 uppercase tracking-widest">Profit & Loss Dashboard</p>
        </div>

        {/* CONTROLS */}
        <div className="flex flex-wrap gap-3 mb-8">

          {/* Period Dropdown */}
          <select
            value={period}
            onChange={(e) => handleChange(e.target.value)}
            className="flex-1 min-w-[140px] bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            {availablePeriods.map(p => <option key={p} value={p}>{p}</option>)}
          </select>

          {/* Export Dropdown */}
          <div className="relative" ref={exportRef}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 transition-all rounded-xl px-5 py-3 text-sm font-black uppercase tracking-wider shadow-lg"
            >
              ⬇ Export
              <span className="text-xs">{showExportMenu ? '▲' : '▼'}</span>
            </button>

            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-44 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                <button
                  onClick={exportToExcel}
                  className="w-full text-left px-5 py-3 text-sm hover:bg-gray-800 transition-all flex items-center gap-3"
                >
                  <span>📊</span> Excel (.xlsx)
                </button>
                <div className="border-t border-gray-800" />
                <button
                  onClick={exportToPDF}
                  className="w-full text-left px-5 py-3 text-sm hover:bg-gray-800 transition-all flex items-center gap-3"
                >
                  <span>📄</span> PDF (.pdf)
                </button>
              </div>
            )}
          </div>
        </div>

        {/* P&L STATEMENT */}
        <div className="bg-gray-900/50 rounded-2xl border border-gray-800 overflow-hidden shadow-2xl">

          <Row label="Revenue" amount={revenue} category="Revenue" />
          <Row label="COGS %" amount={cogs} category="COGS" isPercent />

          <Row label="COGS" amount={cogs} category="COGS" />
          <SubtotalRow label="Gross Margin" amount={gm} color="bg-indigo-500/10 border-indigo-500/20 text-indigo-300" />
          <Row label="GM %" amount={gm} category="GM" isPercent />

          <Row label="Variable Cost" amount={variableCosts} category="Variable Cost" />
          <SubtotalRow label="Contribution Margin" amount={contributionMargin} color="bg-emerald-500/10 border-emerald-500/20 text-emerald-300" />
          <Row label="Contribution Margin %" amount={contributionMargin} category="CM" isPercent />

          <Row label="Opex" amount={opex} category="Opex" />
          <Row label="Opex %" amount={opex} category="Opex" isPercent />

          <Row label="Non Opex" amount={nonOpex} category="Non Opex" />
          <Row label="Non Opex %" amount={nonOpex} category="Non Opex" isPercent />

          {/* NET PROFIT */}
          <div className={`px-4 sm:px-8 py-6 sm:py-8 flex justify-between items-center ${netProfit >= 0 ? 'bg-indigo-600/20' : 'bg-red-600/20'}`}>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">Bottom Line</p>
              <h2 className="text-xl sm:text-3xl font-black uppercase">Net Profit</h2>
            </div>
            <div className="text-right">
              <p className={`text-xl sm:text-3xl font-black font-mono ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {fmt(netProfit)}
              </p>
              <p className="text-xs text-gray-500 mt-1 font-mono">NP% {pct(netProfit)}%</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}