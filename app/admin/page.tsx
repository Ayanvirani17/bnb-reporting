"use client"

import { useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabaseClient'

export default function AdminPage() {
  const [period, setPeriod] = useState('')
  const [data, setData] = useState<any[]>([])
  const [status, setStatus] = useState('')

  const handleFileUpload = (e: any) => {
    const file = e.target.files[0]
    const reader = new FileReader()
    reader.onload = (evt) => {
      const bstr = evt.target?.result
      const wb = XLSX.read(bstr, { type: 'binary' })
      const wsname = wb.SheetNames[0]
      const ws = wb.Sheets[wsname]
      // Start from Row 6 (index 5)
      const json = XLSX.utils.sheet_to_json(ws, { range: 5, defval: 0 })
      setData(json)
      setStatus('File preview loaded.')
    }
    reader.readAsBinaryString(file)
  }

  const smartMap = (name: string) => {
    const n = name.toLowerCase()
    
    // REVENUE
    if (n.includes('sale') || n.includes('income') || n.includes('service charge')) 
        return { cat: 'Revenue', line: 'Sales Revenue', sign: 'credit' }
    
    // COGS
    if (n.includes('purchases') || n.includes('cost of') || n.includes('raw material') || n.includes('food') || n.includes('beverage'))
        return { cat: 'COGS', line: 'Direct Costs', sign: 'debit' }
    
    // VARIABLE
    if (n.includes('commission') || n.includes('delivery') || n.includes('packaging') || n.includes('discount'))
        return { cat: 'Variable Cost', line: 'Variable Expenses', sign: 'debit' }

    // OPEX (The biggest list)
    if (n.includes('wage') || n.includes('salary') || n.includes('staff'))
        return { cat: 'Opex', line: 'Staff Costs', sign: 'debit' }
    if (n.includes('rent') || n.includes('license') || n.includes('permit'))
        return { cat: 'Opex', line: 'Rent & Compliance', sign: 'debit' }
    if (n.includes('electricity') || n.includes('water') || n.includes('gas') || n.includes('utility'))
        return { cat: 'Opex', line: 'Utilities', sign: 'debit' }
    if (n.includes('repair') || n.includes('maintenance'))
        return { cat: 'Opex', line: 'Repairs & Maint.', sign: 'debit' }
    
    // DEFAULT TO GENERAL OPEX
    return { cat: 'Opex', line: 'General Admin', sign: 'debit' }
  }

  const uploadToDatabase = async () => {
    if (!period || data.length === 0) {
      alert('Please select period and upload file')
      return
    }
    setStatus('Processing data...')

    // 1. Create Trial Balance Header
    const { data: tb, error: tbErr } = await supabase
      .from('trial_balances')
      .insert({ entity_id: (await supabase.from('entities').select('id').limit(1)).data?.[0].id, period_name: period })
      .select()

    if (tbErr) { setStatus('Error creating TB'); return }
    const tbId = tb[0].id

    // 2. Load Existing Mapping
    const { data: mapping } = await supabase.from('account_mapping').select('*')
    
    // 3. Prepare Lines with Smart Logic
    const finalLines = data
      .filter((row: any) => row['Account Name'] && row['Account Name'] !== 'Totals' && row['Account Name'] !== 'Difference')
      .map((row: any) => {
        const name = row['Account Name']
        const debit = parseFloat(row['Debit']) || 0
        const credit = parseFloat(row['Credit']) || 0
        
        // Find in database mapping OR use Smart Guess
        const map = mapping?.find(m => m.account_name === name) || smartMap(name)
        
        const amount = map.sign_convention === 'credit' ? (credit - debit) : (debit - credit)

        return {
          trial_balance_id: tbId,
          account_name: name,
          debit,
          credit,
          amount,
          pl_category: map.pl_category || map.cat,
          pl_line_item: map.pl_line_item || map.line
        }
      })

    // 4. Insert Lines
    const { error: lineErr } = await supabase.from('trial_balance_lines').insert(finalLines)
    if (lineErr) { setStatus('Error saving lines'); return }

    // 5. Aggregate to P&L Results
    const summary: any = {}
    finalLines.forEach(l => {
      const key = `${l.pl_category}|${l.pl_line_item}`
      summary[key] = (summary[key] || 0) + l.amount
    })

    const plData = Object.keys(summary).map(key => {
      const [cat, line] = key.split('|')
      return { period, pl_category: cat, pl_line_item: line, amount: summary[key] }
    })

    await supabase.from('pl_results').insert(plData)
    setStatus('SUCCESS! P&L Generated for ' + period)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-10 font-mono">
      <div className="max-w-2xl mx-auto border border-gray-800 p-8 rounded-2xl bg-gray-900/50">
        <h1 className="text-2xl font-black mb-6">ADMIN PORTAL</h1>
        
        <label className="block text-xs text-gray-500 mb-2">PERIOD NAME (e.g., March 2026)</label>
        <input 
          type="text" 
          value={period} 
          onChange={e => setPeriod(e.target.value)}
          className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 mb-6 outline-none focus:border-indigo-500"
          placeholder="Enter Month & Year"
        />

        <label className="block text-xs text-gray-500 mb-2">DATA SOURCE (.XLSX)</label>
        <input 
          type="file" 
          onChange={handleFileUpload}
          className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
        />

        <button 
          onClick={uploadToDatabase}
          className="w-full mt-10 bg-white text-black font-black py-4 rounded-xl hover:bg-gray-200 transition-all uppercase tracking-tighter"
        >
          Generate Reports
        </button>

        {status && (
          <div className="mt-8 p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-lg text-center text-indigo-400 text-sm">
            {status}
          </div>
        )}
      </div>
    </div>
  )
}