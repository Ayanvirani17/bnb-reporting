"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Type definitions to fix Vercel build error
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

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const { data } = await supabase.from("pl_results").select("*")
    if (!data || data.length === 0) { setLoading(false); return }
    
    // Sort periods unique
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
      <div className="w-full">
        <div 
          onClick={() => hasItems && toggle(category)}
          className={`flex justify-between px-8 py-4 border-b border-gray-800 transition cursor-pointer hover:bg-gray-800/30 ${isTotal ? 'bg-indigo-900/10 font-bold bg-gray-800/10' : ''} ${isPercent ? 'bg-gray-900/50 italic text-sm text-gray-400' : ''}`}
        >
          <div className="flex items-center gap-2">
             {hasItems && !isPercent && <span className="text-[10px] opacity-50">{expanded[category] ? '▼' : '▶'}</span>}
             <span>{label}</span>
          </div>
          <div className="flex gap-8 text-right">
            <span className={amount < 0 && !isPercent ? 'text-red-400' : ''}>{isPercent ? `${pct(amount)}%` : fmt(amount)}</span>
          </div>
        </div>
        
        {expanded[category] && !isPercent && items.map((item, i) => (
           <div key={i} className="flex justify-between px-14 py-2 text-xs text-gray-400 border-b border-gray-800/30 bg-gray-950/50">
             <span>{item.pl_line_item}</span>
             <span>{fmt(item.amount)}</span>
           </div>
        ))}
      </div>
    );
  }

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white font-mono">ENCRYPTING DATA...</div>

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans selection:bg-indigo-500/30">
      <div className="max-w-5xl mx-auto py-16 px-6">
        
        {/* Header & Controls */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12 border-b border-gray-800 pb-10">
          <div>
            <h1 className="text-5xl font-black uppercase tracking-tighter leading-none mb-2">BNB CONTROL</h1>
            <p className="text-gray-500 font-mono text-xs uppercase tracking-widest">Financial Reporting Intelligence v2.0</p>
          </div>
          
          <div className="flex flex-wrap gap-3">
             <select 
               value={period} 
               onChange={(e) => handleChange(e.target.value)}
               className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-3 text-sm font-bold appearance-none hover:border-indigo-500 transition-all cursor-pointer shadow-xl"
             >
               {availablePeriods.map(p => <option key={p} value={p}>{p}</option>)}
             </select>
             
             <div className="flex h-fit bg-gray-900 rounded-xl border border-gray-800 overflow-hidden shadow-xl">
               <button onClick={exportToExcel} className="px-5 py-3 text-xs font-black uppercase tracking-wider hover:bg-gray-800 border-r border-gray-800 transition-all">Excel</button>
               <button onClick={exportToPDF} className="px-5 py-3 text-xs font-black uppercase tracking-wider hover:bg-gray-800 transition-all">PDF</button>
             </div>
          </div>
        </div>

        {/* The Statement Body */}
        <div className="bg-gray-900/40 backdrop-blur-xl rounded-[2rem] border border-gray-800/50 overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] mb-20">
          
          <Row label="Total Revenue" amount={revenue} category="Revenue" isTotal />
          
          <Row label="Direct Cost of Goods (COGS)" amount={cogs} category="COGS" />
          <Row label="COGS Percentage" amount={cogs} category="COGS" isPercent />
          
          <div className="bg-indigo-500/5 px-8 py-6 flex justify-between font-black text-indigo-400 border-y border-indigo-500/10">
            <span className="uppercase tracking-widest text-xs">Margin Level 1</span>
            <div className="flex flex-col items-end">
                <span className="text-xl">{fmt(gm)}</span>
                <span className="text-[10px] text-indigo-500/60 uppercase">Gross Margin</span>
            </div>
          </div>
          <Row label="Gross Margin %" amount={gm} category="GM_Display" isPercent />

          <Row label="Variable Costs" amount={variableCosts} category="Variable Cost" />
          
          <div className="bg-emerald-500/5 px-8 py-6 flex justify-between font-black text-emerald-400 border-y border-emerald-500/10">
            <span className="uppercase tracking-widest text-xs">Margin Level 2</span>
            <div className="flex flex-col items-end">
                <span className="text-xl">{fmt(contributionMargin)}</span>
                <span className="text-[10px] text-emerald-500/60 uppercase">Contribution Margin</span>
            </div>
          </div>
          <Row label="Contribution Margin %" amount={contributionMargin} category="CM_Display" isPercent />

          <Row label="Fixed Operating Expense (Opex)" amount={opex} category="Opex" />
          <Row label="Opex Cost %" amount={opex} category="Opex" isPercent />

          <Row label="Non-Operating Expense" amount={nonOpex} category="Non Opex" />
          <Row label="Non-Opex %" amount={nonOpex} category="Non Opex" isPercent />

          {/* FINAL BOTTOM LINE */}
          <div className={`px-10 py-10 flex justify-between items-center ${netProfit >= 0 ? 'bg-indigo-500/20' : 'bg-red-500/10'}`}>
            <div>
              <h2 className="text-[10px] uppercase tracking-[0.3em] text-gray-500 mb-2 font-bold opacity-50">Audited Performance</h2>
              <span className="text-5xl font-black uppercase tracking-tighter">Profit</span>
            </div>
            <div className="text-right">
               <span className={`text-5xl font-black tracking-tighter ${netProfit >= 0 ? 'text-white' : 'text-rose-400'}`}>{fmt(netProfit)}</span>
               <div className="flex flex-col items-end mt-2">
                 <p className="text-xs text-gray-500 font-mono font-bold">NP %: {pct(netProfit)}%</p>
                 <div className="w-12 h-1 bg-indigo-500 mt-2 rounded-full"></div>
               </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}