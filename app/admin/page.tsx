"use client"

import { useState } from "react"
import * as XLSX from "xlsx"
import { supabase } from "@/lib/supabaseClient"

export default function AdminPage() {
  const [data, setData] = useState<any[]>([])
  const [status, setStatus] = useState("")
  const [period, setPeriod] = useState("")
  const [isUploading, setIsUploading] = useState(false)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setStatus("Reading file...")

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const binaryStr = evt.target?.result
        const workbook = XLSX.read(binaryStr, { type: "binary" })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]

        const jsonData = XLSX.utils.sheet_to_json(sheet, {
          range: 6,
          defval: "",
        }) as any[]

        const cleanedData = jsonData.filter(
          (row) =>
            row["Account Name"] &&
            row["Account Name"] !== "Totals" &&
            row["Account Name"] !== "Difference"
        )

        setData(cleanedData)
        setStatus(`✅ Loaded ${cleanedData.length} rows. Ready to upload.`)
      } catch (err) {
        console.error(err)
        setStatus("❌ Error reading file.")
      }
    }
    reader.readAsBinaryString(file)
  }

  const uploadToDatabase = async () => {
    if (!period) return alert("Please enter the period")
    if (data.length === 0) return alert("Please upload a file first")

    setIsUploading(true)
    setStatus("Uploading...")

    try {
      const entityId = "2108a319-2ad1-47df-b020-596f80851d71"

      const { data: tbHeader, error: tbError } = await supabase
        .from("trial_balances")
        .insert([{ entity_id: entityId, period: period, status: "processing" }])
        .select()
        .single()

      if (tbError) throw tbError

      const formattedLines = data.map((row) => ({
        trial_balance_id: tbHeader.id,
        account_code: row["Account Name"],
        account_name: row["Account Name"],
        debit: parseFloat(row["Debit"] || 0),
        credit: parseFloat(row["Credit"] || 0),
      }))

      await supabase.from("trial_balance_lines").insert(formattedLines)

      const { data: mapping } = await supabase
        .from("account_mapping")
        .select("*")
        .eq("entity_id", entityId)

      const plTotals: Record<string, number> = {}
      let matchCount = 0
      alert("Mapping rows loaded: " + (mapping?.length ?? 0))

      formattedLines.forEach((line) => {
        // ✅ FIXED: uses includes() instead of exact match
        const match = mapping?.find((m: any) =>
          line.account_name.toLowerCase().includes(m.account_name.toLowerCase())
        )

        if (match) {
          matchCount++
          const amount =
            match.sign_convention === "credit"
              ? (line.credit || 0) - (line.debit || 0)
              : (line.debit || 0) - (line.credit || 0)

          const key = `${match.pl_category}||${match.pl_line_item}`
          plTotals[key] = (plTotals[key] || 0) + amount
        }
      })

      alert(`Debug: Found ${matchCount} matching accounts`)

      const plRows = Object.entries(plTotals).map(([key, amount]) => {
        const [pl_category, pl_line_item] = key.split("||")
        return {
          trial_balance_id: tbHeader.id,
          entity_id: entityId,
          period: period,
          pl_category,
          pl_line_item,
          amount,
        }
      })

      if (plRows.length > 0) {
        const { error: plError } = await supabase
          .from("pl_results")
          .insert(plRows)
        if (plError) throw plError
      } else {
        alert("Warning: No P&L rows were created!")
      }

      await supabase
        .from("trial_balances")
        .update({ status: "complete" })
        .eq("id", tbHeader.id)

      setStatus("✅ Success! Check the dashboard.")
      setData([])
      setPeriod("")
    } catch (err: any) {
      alert("Error: " + err.message)
      setStatus("❌ Error: " + err.message)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-10">
      <div className="bg-white shadow-lg rounded-lg p-8 border border-gray-200">

        <h1 className="text-3xl font-bold text-gray-800 mb-1">BNB Admin Portal</h1>
        <p className="text-gray-400 text-sm mb-8">Only authorized users can access this page.</p>

        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Period</label>
            <input
              type="text"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              placeholder="e.g. March 2026"
              className="w-full border border-gray-300 p-2 rounded-md text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Trial Balance File (.xlsx / .xls)
            </label>
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileUpload}
              className="w-full text-sm mt-1"
            />
          </div>
        </div>

        {status && (
          <div className={`p-4 rounded-md mb-6 text-sm font-medium ${
            status.includes("✅") ? "bg-green-50 text-green-700" :
            status.includes("❌") ? "bg-red-50 text-red-700" :
            "bg-blue-50 text-blue-700"
          }`}>
            {status}
          </div>
        )}

        {data.length > 0 && (
          <>
            <div className="overflow-x-auto border rounded-lg mb-6">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Debit</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Credit</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {data.slice(0, 8).map((row, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2 text-gray-700">{row["Account Name"]}</td>
                      <td className="px-4 py-2 text-gray-600">{row["Debit"] || "-"}</td>
                      <td className="px-4 py-2 text-gray-600">{row["Credit"] || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="p-3 text-xs text-gray-400 italic">
                Showing first 8 rows of {data.length} total rows
              </p>
            </div>

            <button
              onClick={uploadToDatabase}
              disabled={isUploading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition disabled:opacity-50"
            >
              {isUploading ? "Processing..." : `Generate P&L for ${period || "selected period"}`}
            </button>
          </>
        )}
      </div>
    </div>
  )
}