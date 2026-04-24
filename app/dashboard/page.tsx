"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function Dashboard() {
  const [results, setResults] = useState<any[]>([])
  const [period, setPeriod] = useState("")
  const [availablePeriods, setAvailablePeriods] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

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

  const toggle = (cat: string) => setExpanded(prev => ({ ...prev, [cat]: !prev[cat] }))

  // CALCULATIONS
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

  // EXPORT FUNCTIONS
  const exportToExcel = () => {
    const wsData = [
      ["Entity", "BNB Restaurant & Cafe"],
      ["Period", period],
      [""],
      ["Category", "Amount", "% of Revenue"],
      ["Revenue", fmt(revenue), "100%"],
      ["COGS", fmt(cogs), `${pct(cogs)}%`],
      ["Gross Margin", fmt(gm), `${pct(gm)}%`],
      ["Variable Cost", fmt(variableCosts), `${pct(variableCosts)}%`],
      ["Contribution Margin", fmt(contributionMargin), `${pct(contributionMargin)}%`],
      ["Opex", fmt(opex), `${pct(opex)}%`],
      ["Non Opex", fmt(nonOpex), `${pct(nonOpex)}%`],
      ["Net Profit", fmt(netProfit), `${pct(netProfit)}%`]
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "P&L Report");
    XLSX.writeFile(wb, `P&L_${period}.xlsx`);
  }

  const exportToPDF = () => {
    const doc = new jsPDF() as any;
    doc.text("BNB Restaurant & Cafe - P&L Statement", 14, 15);
    doc.text(`Period: ${period}`, 14, 22);
    
    doc.autoTable({
      startY: 30,
      head: [['Category', 'Amount', '% of Revenue']],
      body: [
        ['Revenue', fmt(revenue), '100%'],
        ['COGS', fmt(cogs), `${pct(cogs)}%`],
        ['Gross Margin', fmt(gm), `${pct(gm)}%`],
        ['Variable Cost', fmt(variableCosts), `${pct(variableCosts)}%`],
        ['Contribution Margin', fmt(contributionMargin), `${pct(contributionMargin)}%`],
        ['Opex', fmt(opex), `${pct(opex)}%`],
        ['Non Opex', fmt(nonOpex), `${pct(nonOpex)}%`],
        ['Net Profit', fmt(netProfit), `${pct(netProfit)}%`],
      ],
      theme: 'grid',
      headStyles: { fillStyle: 'F', fillColor: [79, 70, 229] }
    });
    doc.save(`P&L_${period}.pdf`);
  }

  const Row = ({ label, amount, category, isTotal = false, isPercent = false }: any) => {
    const hasItems = results.some(r => r.pl_category === category);
    const items = results.filter(r => r.pl_category === category);
    
    return (
      <>
        <div 
          onClick={() => hasItems && toggle(category)}
          className={`flex justify-between px-8 py-4 border-b border-gray-800 transition cursor-pointer hover:bg-gray-800/30 ${isTotal ? 'bg-indigo-900/10 font-bold bg-gray-800/10' : ''} ${isPercent ? 'bg-gray-900/50 italic text-sm text-gray-400' : ''}`}
        >
          <div className="flex items-center gap-2">
             {hasItems && !isPercent && <span className="text-[10px] opacity-50">{expanded[category] ? '▼' : '▶'}</span>}
             <span>{label}</span>
          </div>
          <div className="flex gap-8">
            <span className={amount < 0 && !isPercent ? 'text-red-400' : ''}>{isPercent ? `${pct(amount)}%` : fmt(amount)}</span>
          </div>
        </div>
        
        {expanded[category] && items.map((item, i) => (
           <div key={i} className="flex justify-between px-14 py-2 text-xs text-gray-400 border-b border-gray-800/30 bg-gray-950/50">
             <span>{item.pl_line_item}</span>
             <span>{fmt(item.amount)}</span>
           </div>
        ))}
      </>
    );
  }

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">Loading Professional Dashboard...</div>

  return (
    <div className="min-h-screen bg-gray-950 text-white p-10">
      <div className="max-w-5xl mx-auto">
        
        {/* Header & Controls */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter">BNB Financial Control</h1>
            <p className="text-gray-500 text-sm">Dynamic P&L Management Engine</p>
          </div>
          
          <div className="flex gap-3">
             <select 
               value={period} 
               onChange={(e) => handleChange(e.target.value)}
               className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
             >
               {availablePeriods.map(p => <option key={p} value={p}>{p}</option>)}
             </select>
             
             <div className="flex bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
               <button onClick={exportToExcel} className="px-3 py-2 text-xs hover:bg-gray-800 border-r border-gray-700">Excel</button>
               <button onClick={exportToPDF} className="px-3 py-2 text-xs hover:bg-gray-800">PDF</button>
             </div>
          </div>
        </div>

        {/* The Statement Body */}
        <div className="bg-gray-900 rounded-3xl border border-gray-800 overflow-hidden shadow-2xl mb-20">
          
          <Row label="Revenue" amount={revenue} category="Revenue" isTotal />
          
          <Row label="COGS" amount={cogs} category="COGS" />
          <Row label="COGS %" amount={cogs} category="COGS" isPercent />
          
          <div className="bg-indigo-600/10 px-8 py-5 flex justify-between font-black text-indigo-300 border-y border-indigo-900/50">
            <span>GROSS MARGIN (GM)</span>
            <span>{fmt(gm)}</span>
          </div>
          <Row label="GM %" amount={gm} category="GM_Display" isPercent />

          <Row label="Variable Cost" amount={variableCosts} category="Variable Cost" />
          
          <div className="bg-emerald-600/10 px-8 py-5 flex justify-between font-black text-emerald-300 border-y border-emerald-900/50">
            <span>CONTRIBUTION MARGIN</span>
            <span>{fmt(contributionMargin)}</span>
          </div>
          <Row label="Contribution Margin %" amount={contributionMargin} category="CM_Display" isPercent />

          <Row label="Opex" amount={opex} category="Opex" />
          <Row label="Opex %" amount={opex} category="Opex" isPercent />

          <Row label="Non Opex" amount={nonOpex} category="Non Opex" />
          <Row label="Non Opex %" amount={nonOpex} category="Non Opex" isPercent />

          <div className={`px-8 py-8 flex justify-between items-center ${netProfit >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
            <div>
              <h2 className="text-sm uppercase tracking-widest text-gray-500 mb-1 font-bold">Bottom Line</h2>
              <span className="text-4xl font-black uppercase">Net Profit</span>
            </div>
            <div className="text-right">
               <span className={`text-4xl font-black ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmt(netProfit)}</span>
               <p className="text-sm text-gray-500 mt-1 font-bold">NP %: {pct(netProfit)}%</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}