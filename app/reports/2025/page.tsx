'use client'

import { useState, useEffect } from 'react'

const PASS = 'Dara$$$911'
const STORAGE_KEY = 'topdonut_reports_auth'

// Revenue categories
const defaultRevenue = [
  { label: 'Square - Credit Card', amount: 377648.90 },
  { label: 'Square - Cash', amount: 96789.42 },
  { label: 'Square - Cash App', amount: 629.98 },
  { label: 'DoorDash', amount: 32950.39 },
  { label: 'Uber Eats', amount: 20505.96 },
]

// Cost of Goods Sold (from Austin Bank + Square Bank 2025)
const defaultCOGS = [
  { label: 'Dawn Food Products', amount: 46027.44 },       // Austin Bank
  { label: "Sam's Club", amount: 14762.48 },                // Square ($14,381.72) + CapOne ($380.76)
  { label: 'Walmart', amount: 8841.45 },                    // Square ($8,767.62) + Southside ($44.44) + CapOne ($29.39)
  { label: "Brookshire's", amount: 3585.78 },                // Square Bank
  { label: 'Super 1 Foods', amount: 1755.93 },              // Square Bank
  { label: 'Import Emporium', amount: 1354.31 },            // Square Bank
  { label: 'Sunrise Supply', amount: 1049.16 },             // Austin Bank
  { label: 'Murphy Atwal', amount: 338.63 },                // Square Bank
  { label: 'Dallas Superstore', amount: 321.50 },           // Square Bank
  { label: 'Tyler C-Store Wholesale', amount: 147.18 },     // Square Bank
  { label: 'Star Supplies Milk', amount: 0 },               // May be in checks
  { label: 'Smith Fiel', amount: 0 },                       // May be in checks
  { label: 'Tyler Beverage', amount: 0 },                   // May be in checks
  { label: 'Croissant Wholesale supplier', amount: 0 },     // May be in checks
  { label: 'Hiland Milk company', amount: 0 },              // May be in checks
  { label: 'Checks to Suppliers (uncat.)', amount: 65131.95 }, // Austin Bank checks
]

// Expenses
// Expenses (from Austin Bank + Square Bank + Southside 2025)
const defaultExpenses = [
  // Rent & Facility
  { label: 'Rent/Lease (Metro)', amount: 12263.65 },        // Austin Bank
  { label: 'CAM Expenses & Property Tax', amount: 0 },
  { label: 'Smith County Vehicle Reg/Fees', amount: 226.84 }, // Square Bank
  { label: 'Business License FEE', amount: 0 },
  // Utilities
  { label: 'Electricity (TXU)', amount: 4276.72 },          // Austin ($2,910.79) + Square ($1,365.93)
  { label: 'Centralpoint Gas / Propane', amount: 19.92 },   // Square Bank (Amerigas)
  { label: 'City of Tyler Water', amount: 2012.34 },        // Square Bank
  { label: 'AT&T / Phone / Internet', amount: 2639.89 },    // Square Bank
  { label: 'Frontier Internet', amount: 524.94 },           // Square Bank
  { label: 'VEXUS Internet', amount: 239.98 },              // Square Bank
  { label: 'Trash/Waste Removal', amount: 0 },
  // Insurance
  { label: 'Insurance (Allstate)', amount: 3091.87 },       // Austin Bank
  { label: 'Insurance (Next Gen Liability)', amount: 1719.82 }, // Square Bank
  { label: 'Workers Compensation Insurance', amount: 0 },
  { label: 'Health Insurance Premiums', amount: 0 },
  // Payroll & Labor
  { label: 'Drake Management (Payroll/Service)', amount: 49402.58 }, // Austin Bank
  { label: 'Employee Wages (direct)', amount: 0 },
  { label: 'Payroll Taxes (SS, Medicare, FUTA)', amount: 0 },
  // Maintenance & Repairs (Lowe\'s, Home Depot, Harbor Freight)
  { label: "Lowe's (Maintenance/Repairs)", amount: 3835.53 }, // Square ($3,594.87) + CapOne ($240.66)
  { label: 'Home Depot', amount: 718.83 },                  // Square ($144.59) + CapOne ($574.24)
  { label: 'Harbor Freight (Tools)', amount: 172.29 },      // Square Bank
  { label: 'Equipment Repair / Maintenance', amount: 0 },
  { label: 'HVAC Service', amount: 0 },
  { label: 'Pest Control', amount: 0 },
  // Equipment & Depreciation
  { label: 'Equipment Purchases (Section 179)', amount: 0 },
  { label: 'POS System / Tablet', amount: 0 },
  // Supplies
  { label: 'Office Supplies', amount: 0 },
  { label: 'Cleaning Supplies', amount: 0 },
  { label: 'Uniforms / Work Clothing', amount: 0 },
  // Professional Services
  { label: 'Accountant / Bookkeeper Fees', amount: 0 },
  { label: 'Tax Preparation Fees', amount: 0 },
  { label: 'Legal Fees', amount: 0 },
  // Marketing & Sales
  { label: 'Advertising', amount: 0 },
  // Fees & Banking
  { label: 'Merchant Credit Card FEE (Square)', amount: 13724.14 }, // Square Sales CSV
  { label: 'Bank Fees / NSF Charges', amount: 2370.00 },    // Austin Bank
  { label: 'SBA EIDL Loan Payment', amount: 4080.00 },      // Austin Bank
  { label: 'Delivery/Freight Expense', amount: 0 },
  { label: 'Credit Card Interest (Capital One)', amount: 176.91 }, // CapOne
  // Vehicle
  { label: 'Vehicle Maintenance (O\'Reilly, Butler)', amount: 278.91 }, // Square Bank
  { label: 'Fuel (Business Use)', amount: 170.08 },         // Square ($150.45) + CapOne ($19.63)
  // Other
  { label: 'SimpliSafe (Security System)', amount: 311.67 }, // CapOne
  { label: 'PayPal JetImpex (Supplies)', amount: 169.00 },  // CapOne
  { label: 'Orthodontist (Mack & Hansen)', amount: 300.00 }, // CapOne
  { label: 'Employee Meals (Zaza Thai)', amount: 159.58 },  // CapOne
  { label: 'Other Expenses', amount: 0 },
]

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export default function IncomeStatement2025() {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [pwError, setPwError] = useState(false)

  // Data state
  const [period, setPeriod] = useState('ytd')
  const [fromMonth, setFromMonth] = useState(0)
  const [toMonth, setToMonth] = useState(new Date().getMonth())
  const [revenue, setRevenue] = useState(defaultRevenue.map(r => ({ ...r })))
  const [cogs, setCogs] = useState(defaultCOGS.map(c => ({ ...c })))
  const [expenses, setExpenses] = useState(defaultExpenses.map(e => ({ ...e })))

  // Custom row adders
  const [newCogsLabel, setNewCogsLabel] = useState('')
  const [newExpLabel, setNewExpLabel] = useState('')

  // Load/save
  const DATA_KEY = 'topdonut_income_2025'

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === PASS) setAuthed(true)
  }, [])

  useEffect(() => {
    if (!authed) return
    const saved = localStorage.getItem(DATA_KEY)
    if (saved) {
      try {
        const d = JSON.parse(saved)
        if (d.revenue) setRevenue(d.revenue)
        if (d.cogs) setCogs(d.cogs)
        if (d.expenses) setExpenses(d.expenses)
        if (d.fromMonth !== undefined) setFromMonth(d.fromMonth)
        if (d.toMonth !== undefined) setToMonth(d.toMonth)
      } catch {}
    }
  }, [authed])

  const saveData = () => {
    localStorage.setItem(DATA_KEY, JSON.stringify({ revenue, cogs, expenses, fromMonth, toMonth }))
  }

  useEffect(() => {
    if (authed) saveData()
  }, [revenue, cogs, expenses, fromMonth, toMonth, authed])

  const login = () => {
    if (password === PASS) {
      localStorage.setItem(STORAGE_KEY, PASS)
      setAuthed(true)
    } else {
      setPwError(true)
    }
  }

  // Calculations
  const totalRevenue = revenue.reduce((s, r) => s + r.amount, 0)
  const totalCOGS = cogs.reduce((s, c) => s + c.amount, 0)
  const grossProfit = totalRevenue - totalCOGS
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
  const netProfit = grossProfit - totalExpenses

  const updateRow = (arr: any[], setArr: any, idx: number, val: number) => {
    const copy = [...arr]
    copy[idx] = { ...copy[idx], amount: val }
    setArr(copy)
  }

  const renameRow = (arr: any[], setArr: any, idx: number, newLabel: string) => {
    const copy = [...arr]
    copy[idx] = { ...copy[idx], label: newLabel }
    setArr(copy)
  }

  const moveRow = (arr: any[], setArr: any, idx: number, dir: 'up' | 'down') => {
    if (dir === 'up' && idx === 0) return
    if (dir === 'down' && idx === arr.length - 1) return
    const copy = [...arr]
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1
    ;[copy[idx], copy[swapIdx]] = [copy[swapIdx], copy[idx]]
    setArr(copy)
  }

  const deleteRow = (arr: any[], setArr: any, idx: number) => {
    setArr(arr.filter((_: any, i: number) => i !== idx))
  }

  // Auth screen
  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: 40, maxWidth: 360, width: '100%', textAlign: 'center', border: '1px solid #e0e0e0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>&#128274;</div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#1a1a1a', marginBottom: 6 }}>Top Donut Reports</h1>
          <p style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>Enter password to access</p>
          <input
            type="password" value={password}
            onChange={e => { setPassword(e.target.value); setPwError(false) }}
            onKeyDown={e => e.key === 'Enter' && login()}
            placeholder="Password"
            style={{ width: '100%', padding: 12, borderRadius: 8, fontSize: 15, border: `1px solid ${pwError ? '#D85A30' : '#ddd'}`, marginBottom: 12, boxSizing: 'border-box', outline: 'none' }}
          />
          {pwError && <div style={{ color: '#D85A30', fontSize: 13, marginBottom: 12 }}>Wrong password</div>}
          <button onClick={login} style={{ width: '100%', padding: 12, borderRadius: 8, background: '#2C3E6B', color: '#fff', fontWeight: 600, fontSize: 15, border: 'none', cursor: 'pointer' }}>Unlock</button>
        </div>
      </div>
    )
  }

  const sectionTitle: React.CSSProperties = { fontSize: 16, fontWeight: 700, color: '#2C3E6B', margin: '24px 0 12px', textTransform: 'uppercase', letterSpacing: 0.5 }
  const inputStyle: React.CSSProperties = { width: 120, padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 14, textAlign: 'right' }
  const btnStyle: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '2px 4px', color: '#aaa' }

  const renderRow = (arr: any[], setArr: any, idx: number, canDelete = true) => (
    <div key={`row-${idx}-${arr.length}`} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0', borderBottom: '1px solid #f0f0f0', fontSize: 14 }}>
      <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        <button onClick={() => moveRow(arr, setArr, idx, 'up')} style={{ ...btnStyle, fontSize: 10, lineHeight: 1 }} title="Move up">&#9650;</button>
        <button onClick={() => moveRow(arr, setArr, idx, 'down')} style={{ ...btnStyle, fontSize: 10, lineHeight: 1 }} title="Move down">&#9660;</button>
      </div>
      <input
        type="text"
        defaultValue={arr[idx].label}
        onBlur={e => { if (e.target.value !== arr[idx].label) renameRow(arr, setArr, idx, e.target.value) }}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
        style={{ flex: 1, padding: '5px 8px', borderRadius: 6, border: '1px solid transparent', fontSize: 14, color: '#444', background: 'transparent' }}
        onFocus={e => { e.currentTarget.style.border = '1px solid #2C3E6B'; e.currentTarget.style.background = '#fff' }}
      />
      <input type="number" value={arr[idx].amount || ''} onChange={e => updateRow(arr, setArr, idx, Number(e.target.value) || 0)} style={inputStyle} placeholder="0.00" />
      {canDelete && <button className="no-print" onClick={() => deleteRow(arr, setArr, idx)} style={{ ...btnStyle, color: '#ddd', fontSize: 16 }} title="Delete">&#x2715;</button>}
    </div>
  )
  const totalStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: '#2C3E6B', color: '#fff', borderRadius: 8, fontSize: 16, fontWeight: 700, marginTop: 8 }
  const subtotalStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', padding: '10px 16px', background: '#e8edf5', color: '#2C3E6B', borderRadius: 8, fontSize: 15, fontWeight: 700, marginTop: 8 }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f0', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '24px 16px' }}>
        {/* Header */}
        <div style={{ background: '#2C3E6B', borderRadius: 12, padding: '24px 28px', color: '#fff', marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>TOP DONUT</h1>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 500, opacity: 0.9 }}>Income Statement</div>
              <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>{MONTHS[fromMonth]} - {MONTHS[toMonth]} 2025</div>
            </div>
            <div className="no-print" style={{ display: 'flex', gap: 8 }}>
              <select value={fromMonth} onChange={e => setFromMonth(Number(e.target.value))} style={{ padding: '6px 10px', borderRadius: 6, border: 'none', fontSize: 13 }}>
                {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
              <span style={{ color: '#fff', alignSelf: 'center' }}>to</span>
              <select value={toMonth} onChange={e => setToMonth(Number(e.target.value))} style={{ padding: '6px 10px', borderRadius: 6, border: 'none', fontSize: 13 }}>
                {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 24 }}>
          <div style={{ background: '#fff', borderRadius: 10, padding: 16, border: '1px solid #e0e0e0' }}>
            <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', marginBottom: 4 }}>Revenue</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a' }}>{fmt(totalRevenue)}</div>
          </div>
          <div style={{ background: '#fff', borderRadius: 10, padding: 16, border: '1px solid #e0e0e0' }}>
            <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', marginBottom: 4 }}>COGS</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#D85A30' }}>{fmt(totalCOGS)}</div>
          </div>
          <div style={{ background: '#fff', borderRadius: 10, padding: 16, border: '1px solid #e0e0e0' }}>
            <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', marginBottom: 4 }}>Expenses</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#BA7517' }}>{fmt(totalExpenses)}</div>
          </div>
          <div style={{ background: netProfit >= 0 ? '#E1F5EE' : '#FCEBEB', borderRadius: 10, padding: 16, border: `1px solid ${netProfit >= 0 ? '#9FE1CB' : '#F5C6C6'}` }}>
            <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', marginBottom: 4 }}>Net Profit</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: netProfit >= 0 ? '#085041' : '#791F1F' }}>{fmt(netProfit)}</div>
          </div>
        </div>

        {/* REVENUE */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e0e0e0', padding: '20px 24px', marginBottom: 16 }}>
          <div style={sectionTitle}>Revenue — Gross Sales</div>
          {revenue.map((_, i) => renderRow(revenue, setRevenue, i, true))}
          <div style={subtotalStyle}>
            <span>Total Revenue:</span>
            <span>{fmt(totalRevenue)}</span>
          </div>
        </div>

        {/* COST OF GOODS SOLD */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e0e0e0', padding: '20px 24px', marginBottom: 16 }}>
          <div style={sectionTitle}>Cost of Goods Sold</div>
          {cogs.map((_, i) => renderRow(cogs, setCogs, i))}
          <div className="no-print" style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <input value={newCogsLabel} onChange={e => setNewCogsLabel(e.target.value)} placeholder="New supplier name" style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }} />
            <button onClick={() => { if (newCogsLabel.trim()) { setCogs([...cogs, { label: newCogsLabel.trim(), amount: 0 }]); setNewCogsLabel('') } }} style={{ padding: '6px 14px', borderRadius: 6, background: '#2C3E6B', color: '#fff', border: 'none', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>+ Add</button>
          </div>
          <div style={subtotalStyle}>
            <span>Total Cost of Goods Sold:</span>
            <span>{fmt(totalCOGS)}</span>
          </div>
          <div style={{ ...subtotalStyle, background: '#d4e8d9', color: '#085041' }}>
            <span>Gross Profit (Loss):</span>
            <span>{fmt(grossProfit)}</span>
          </div>
        </div>

        {/* EXPENSES */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e0e0e0', padding: '20px 24px', marginBottom: 16 }}>
          <div style={sectionTitle}>Expenses</div>
          {expenses.map((_, i) => renderRow(expenses, setExpenses, i))}
          <div className="no-print" style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <input value={newExpLabel} onChange={e => setNewExpLabel(e.target.value)} placeholder="New expense category" style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }} />
            <button onClick={() => { if (newExpLabel.trim()) { setExpenses([...expenses, { label: newExpLabel.trim(), amount: 0 }]); setNewExpLabel('') } }} style={{ padding: '6px 14px', borderRadius: 6, background: '#2C3E6B', color: '#fff', border: 'none', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>+ Add</button>
          </div>
          <div style={subtotalStyle}>
            <span>Total Expenses:</span>
            <span>{fmt(totalExpenses)}</span>
          </div>
        </div>

        {/* NET PROFIT */}
        <div style={{ ...totalStyle, fontSize: 20, padding: '16px 24px', borderRadius: 12, background: netProfit >= 0 ? '#085041' : '#791F1F' }}>
          <span>Net Profit (Loss)</span>
          <span>{fmt(netProfit)}</span>
        </div>

        {/* Print button */}
        <div className="no-print" style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'center' }}>
          <button onClick={() => window.print()} style={{ padding: '10px 24px', borderRadius: 8, background: '#2C3E6B', color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Print / Save PDF
          </button>
          <button onClick={() => { if (confirm('Reset all data to zero?')) { setRevenue(defaultRevenue.map(r => ({ ...r }))); setCogs(defaultCOGS.map(c => ({ ...c }))); setExpenses(defaultExpenses.map(e => ({ ...e }))) } }} style={{ padding: '10px 24px', borderRadius: 8, background: '#fff', color: '#D85A30', border: '1px solid #D85A30', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Reset
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: '#aaa', paddingBottom: 40 }} className="no-print">
          Kimco LLC — Top Donut Income Statement 2025 — Data saved locally
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @page { margin: 0.3in; size: auto; }
        @media print {
          .no-print, footer, nav, header, [class*="footer"], [class*="Footer"], [class*="navbar"], [class*="Navbar"] { display: none !important; }
          body { background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; }
          input[type="number"], input[type="text"] {
            border: none !important; background: transparent !important;
            padding: 0 !important; font-weight: 600 !important;
            -moz-appearance: textfield;
          }
          input[type="number"]::-webkit-outer-spin-button,
          input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
          button { display: none !important; }
          div[style*="gap: 8"] > input[type="text"] { display: none !important; }
        }
      `}</style>
    </div>
  )
}
