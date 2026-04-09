'use client'

import { useState, useEffect, useRef } from 'react'

const PASS = 'Dara$$$911'
const STORAGE_KEY = 'topdonut_reports_auth'
const REPORT_ID = 'bookkeeping-2026'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const EXPENSE_CATS = [
  'COGS - Suppliers', 'COGS - Sam\'s Club', 'COGS - Walmart', 'COGS - Brookshire\'s', 'COGS - Other',
  'Rent/Lease', 'Electricity (TXU)', 'Gas', 'Water', 'Internet/Phone',
  'Insurance', 'Payroll (Drake)', 'Payroll Taxes',
  'Maintenance/Repairs', 'Equipment', 'Cleaning Supplies', 'Office Supplies',
  'Square CC Fees', 'Bank Fees', 'SBA Loan', 'Advertising',
  'Vehicle/Fuel', 'Security', 'Professional Services', 'Other',
]

function fmt(n: number) { return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

interface Transaction { id: string; date: string; desc: string; amount: number; category: string; type: 'income' | 'expense'; source: string }
interface MileageEntry { id: string; date: string; from: string; to: string; miles: number; purpose: string }

const emptyMonth = () => ({ square: 0, doordash: 0, ubereats: 0, cash: 0, otherIncome: 0 })

export default function Bookkeeping2026() {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [pwError, setPwError] = useState(false)
  const [tab, setTab] = useState<'dashboard'|'income'|'expenses'|'import'|'mileage'|'tax'>('dashboard')
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<string|null>(null)

  const [monthlyIncome, setMonthlyIncome] = useState<Record<number, { square: number; doordash: number; ubereats: number; cash: number; otherIncome: number }>>(
    Object.fromEntries(Array.from({length:12}, (_,i) => [i, emptyMonth()]))
  )
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [mileage, setMileage] = useState<MileageEntry[]>([])

  const [txDate, setTxDate] = useState(new Date().toISOString().slice(0,10))
  const [txDesc, setTxDesc] = useState(''); const [txAmount, setTxAmount] = useState(''); const [txCat, setTxCat] = useState(EXPENSE_CATS[0]); const [txSource, setTxSource] = useState('Square Bank')
  const [mlDate, setMlDate] = useState(new Date().toISOString().slice(0,10)); const [mlFrom, setMlFrom] = useState(''); const [mlTo, setMlTo] = useState(''); const [mlMiles, setMlMiles] = useState(''); const [mlPurpose, setMlPurpose] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (localStorage.getItem(STORAGE_KEY) === PASS) setAuthed(true) }, [])

  useEffect(() => {
    if (!authed) return
    fetch(`/api/report?id=${REPORT_ID}`).then(r => r.json()).then(d => {
      if (d.data) {
        if (d.data.monthlyIncome) setMonthlyIncome(d.data.monthlyIncome)
        if (d.data.transactions) setTransactions(d.data.transactions)
        if (d.data.mileage) setMileage(d.data.mileage)
        setLastSaved(d.updated_at ? new Date(d.updated_at).toLocaleString() : null)
      }
    }).catch(() => {})
  }, [authed])

  const saveToServer = async () => {
    setSaving(true)
    const res = await fetch('/api/report', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: REPORT_ID, data: { monthlyIncome, transactions, mileage } }) })
    if (res.ok) { setLastSaved(new Date().toLocaleString()); alert('Saved!') } else alert('Failed to save')
    setSaving(false)
  }

  const login = () => { if (password === PASS) { localStorage.setItem(STORAGE_KEY, PASS); setAuthed(true) } else setPwError(true) }

  const totalIncome = Object.values(monthlyIncome).reduce((s, m) => s + m.square + m.doordash + m.ubereats + m.cash + m.otherIncome, 0)
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const netProfit = totalIncome - totalExpenses
  const totalMiles = mileage.reduce((s, m) => s + m.miles, 0)
  const mileageDeduction = totalMiles * 0.70

  const expenseByCategory = EXPENSE_CATS.map(cat => ({
    cat, total: transactions.filter(t => t.type === 'expense' && t.category === cat).reduce((s, t) => s + t.amount, 0)
  })).filter(e => e.total > 0).sort((a, b) => b.total - a.total)

  const monthlyTotals = MONTHS.map((_, i) => {
    const inc = monthlyIncome[i] || emptyMonth()
    const rev = inc.square + inc.doordash + inc.ubereats + inc.cash + inc.otherIncome
    const exp = transactions.filter(t => t.type === 'expense' && new Date(t.date).getMonth() === i).reduce((s, t) => s + t.amount, 0)
    return { month: MONTHS[i], revenue: rev, expenses: exp, profit: rev - exp }
  })

  const addTransaction = () => {
    if (!txDesc || !txAmount) return
    setTransactions([...transactions, { id: Date.now().toString(), date: txDate, desc: txDesc, amount: parseFloat(txAmount), category: txCat, type: 'expense', source: txSource }])
    setTxDesc(''); setTxAmount('')
  }

  const addMileage = () => {
    if (!mlFrom || !mlTo || !mlMiles) return
    setMileage([...mileage, { id: Date.now().toString(), date: mlDate, from: mlFrom, to: mlTo, miles: parseFloat(mlMiles), purpose: mlPurpose }])
    setMlFrom(''); setMlTo(''); setMlMiles(''); setMlPurpose('')
  }

  const importCSV = (text: string) => {
    const lines = text.trim().split('\n')
    if (lines.length < 2) return
    const header = lines[0].toLowerCase()
    let imported = 0
    const newTx: Transaction[] = []
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.replace(/"/g, '').trim())
      if (cols.length < 3) continue
      let date = '', desc = '', amount = 0
      if (header.includes('transaction date')) { date = cols[0]; desc = cols[3] || cols[1]; amount = parseFloat(cols[5]) || 0 }
      else if (header.includes('post date')) { date = cols[1]; desc = cols[3]; amount = parseFloat(cols[4]) || 0 }
      else if (header.includes('account')) { date = cols[4] || cols[1]; desc = cols[3] || cols[5]; amount = parseFloat(cols[2]) || 0 }
      else { date = cols[0]; desc = cols[1]; amount = parseFloat(cols[2]) || 0 }
      if (!date || !amount || amount <= 0) continue
      const d = desc.toUpperCase()
      let cat = 'Other'
      if (d.includes('WALMART') || d.includes('SAM') || d.includes('BROOKSHIRE') || d.includes('SUPER 1') || d.includes('IMPORT EMP') || d.includes('DAWN')) cat = 'COGS - Suppliers'
      else if (d.includes('TXU')) cat = 'Electricity (TXU)'
      else if (d.includes('WATER') || d.includes('TYLER WATER')) cat = 'Water'
      else if (d.includes('ATT') || d.includes('AT&T') || d.includes('FRONTIER') || d.includes('VEXUS')) cat = 'Internet/Phone'
      else if (d.includes('LOWE') || d.includes('HOME DEPOT') || d.includes('HARBOR')) cat = 'Maintenance/Repairs'
      else if (d.includes('INSUR') || d.includes('ALLSTATE') || d.includes('NEXT INSUR')) cat = 'Insurance'
      else if (d.includes('DRAKE')) cat = 'Payroll (Drake)'
      else if (d.includes('METRO') && d.includes('RENT')) cat = 'Rent/Lease'
      else if (d.includes('SBA') || d.includes('EIDL')) cat = 'SBA Loan'
      else if (d.includes('EXXON') || d.includes('FUEL') || d.includes('SHELL')) cat = 'Vehicle/Fuel'
      else if (d.includes('SIMPLISAFE')) cat = 'Security'
      newTx.push({ id: `imp-${Date.now()}-${i}`, date, desc, amount, category: cat, type: 'expense', source: 'CSV Import' })
      imported++
    }
    setTransactions(prev => [...prev, ...newTx])
    alert(`Imported ${imported} transactions`)
  }

  // Tax
  const standardDeduction = 30750
  const qbiDeduction = Math.round(netProfit > 0 ? netProfit * 0.20 : 0)
  const taxableIncome = Math.max(0, netProfit - standardDeduction - qbiDeduction - mileageDeduction)
  const brackets = [{ l: 24300, r: 0.10 }, { l: 98850, r: 0.12 }, { l: 210550, r: 0.22 }, { l: 401600, r: 0.24 }, { l: 510100, r: 0.32 }, { l: 765400, r: 0.35 }, { l: Infinity, r: 0.37 }]
  let fedTax = 0; let rem = taxableIncome; let prev = 0
  for (const b of brackets) { const t = Math.min(rem, b.l - prev); if (t <= 0) break; fedTax += t * b.r; rem -= t; prev = b.l }
  fedTax = Math.round(fedTax)
  const fedOwed = Math.max(0, fedTax - 2500)
  const quarterly = Math.round(fedOwed / 4)

  if (!authed) return (
    <div style={{ minHeight: '100vh', background: '#f5f5f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, sans-serif' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 40, maxWidth: 360, width: '100%', textAlign: 'center', border: '1px solid #e0e0e0' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>&#128274;</div>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 6 }}>Top Donut — 2026 Bookkeeping</h1>
        <input type="password" value={password} onChange={e => { setPassword(e.target.value); setPwError(false) }} onKeyDown={e => e.key === 'Enter' && login()} placeholder="Password" style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${pwError ? '#D85A30' : '#ddd'}`, marginBottom: 12, boxSizing: 'border-box' }} />
        {pwError && <div style={{ color: '#D85A30', fontSize: 13, marginBottom: 12 }}>Wrong password</div>}
        <button onClick={login} style={{ width: '100%', padding: 12, borderRadius: 8, background: '#2C3E6B', color: '#fff', fontWeight: 600, border: 'none', cursor: 'pointer' }}>Unlock</button>
      </div>
    </div>
  )

  const cs = { background: '#fff', borderRadius: 12, border: '1px solid #e0e0e0', padding: '20px 24px', marginBottom: 16 }
  const ls = { fontSize: 11, color: '#888', textTransform: 'uppercase' as const, letterSpacing: '0.05em', fontWeight: 500, display: 'block', marginBottom: 6 }
  const is = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 14, boxSizing: 'border-box' as const }
  const ts = (t: string) => ({ padding: '10px 16px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: tab === t ? '#2C3E6B' : '#e8edf5', color: tab === t ? '#fff' : '#666' } as const)

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f0', fontFamily: '-apple-system, sans-serif' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
        <div style={{ background: '#2C3E6B', borderRadius: 12, padding: '24px 28px', color: '#fff', marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>TOP DONUT — 2026 Bookkeeping</h1>
          <div style={{ fontSize: 14, opacity: 0.8 }}>Kimco LLC · All-in-One Dashboard</div>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
          {[{k:'dashboard',l:'📊 Dashboard'},{k:'income',l:'💰 Income'},{k:'expenses',l:'💸 Expenses'},{k:'import',l:'📥 Import CSV'},{k:'mileage',l:'🚗 Mileage'},{k:'tax',l:'🧾 Tax'}].map(t =>
            <button key={t.k} onClick={() => setTab(t.k as any)} style={ts(t.k)}>{t.l}</button>)}
        </div>

        {/* DASHBOARD */}
        {tab === 'dashboard' && <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            {[{l:'Revenue',v:totalIncome,c:'#085041',bg:'#E8F5EE'},{l:'Expenses',v:totalExpenses,c:'#D85A30',bg:'#FCEBEB'},{l:'Net Profit',v:netProfit,c:netProfit>=0?'#085041':'#D85A30',bg:netProfit>=0?'#E8F5EE':'#FCEBEB'},{l:'Est. Tax',v:fedOwed,c:'#633806',bg:'#FAEEDA'}].map((m,i) =>
              <div key={i} style={{ background: m.bg, borderRadius: 10, padding: 16, textAlign: 'center' }}><div style={{ fontSize: 11, color: m.c, fontWeight: 500, textTransform: 'uppercase' }}>{m.l}</div><div style={{ fontSize: 24, fontWeight: 700, color: m.c }}>{fmt(m.v)}</div></div>)}
          </div>
          <div style={cs}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#2C3E6B', marginBottom: 12 }}>Monthly P&L</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ borderBottom: '2px solid #e0e0e0' }}>{['Month','Revenue','Expenses','Profit'].map(h => <th key={h} style={{ textAlign: h === 'Month' ? 'left' : 'right', padding: '8px', color: '#888', fontSize: 11 }}>{h}</th>)}</tr></thead>
              <tbody>{monthlyTotals.map((m, i) => <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}><td style={{ padding: 8, fontWeight: 600 }}>{m.month}</td><td style={{ padding: 8, textAlign: 'right', color: '#085041' }}>{fmt(m.revenue)}</td><td style={{ padding: 8, textAlign: 'right', color: '#D85A30' }}>{fmt(m.expenses)}</td><td style={{ padding: 8, textAlign: 'right', fontWeight: 700, color: m.profit >= 0 ? '#085041' : '#D85A30' }}>{fmt(m.profit)}</td></tr>)}
                <tr style={{ background: '#f5f5f0', fontWeight: 700 }}><td style={{ padding: 10 }}>TOTAL</td><td style={{ padding: 10, textAlign: 'right', color: '#085041' }}>{fmt(totalIncome)}</td><td style={{ padding: 10, textAlign: 'right', color: '#D85A30' }}>{fmt(totalExpenses)}</td><td style={{ padding: 10, textAlign: 'right', color: netProfit >= 0 ? '#085041' : '#D85A30' }}>{fmt(netProfit)}</td></tr>
              </tbody>
            </table>
          </div>
          <div style={cs}><div style={{ fontSize: 16, fontWeight: 700, color: '#2C3E6B', marginBottom: 12 }}>Top Expense Categories</div>
            {expenseByCategory.length === 0 ? <div style={{ color: '#aaa', fontSize: 13 }}>No expenses yet</div> :
              expenseByCategory.slice(0, 10).map((e, i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}><span>{e.cat}</span><span style={{ fontWeight: 600, color: '#D85A30' }}>{fmt(e.total)}</span></div>)}
          </div>
        </>}

        {/* INCOME */}
        {tab === 'income' && <div style={cs}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#2C3E6B', marginBottom: 16 }}>Monthly Revenue by Source</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ borderBottom: '2px solid #e0e0e0' }}>{['Month','Square','DoorDash','UberEats','Cash','Other','Total'].map(h => <th key={h} style={{ textAlign: h === 'Month' ? 'left' : 'right', padding: '8px 6px', color: '#888', fontSize: 11 }}>{h}</th>)}</tr></thead>
              <tbody>{MONTHS.map((m, i) => { const inc = monthlyIncome[i] || emptyMonth(); const total = inc.square + inc.doordash + inc.ubereats + inc.cash + inc.otherIncome; return (
                <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}><td style={{ padding: 6, fontWeight: 600 }}>{m}</td>
                  {(['square','doordash','ubereats','cash','otherIncome'] as const).map(f => <td key={f} style={{ padding: '4px 2px' }}><input type="number" value={inc[f] || ''} onChange={e => setMonthlyIncome(p => ({ ...p, [i]: { ...p[i], [f]: Number(e.target.value) || 0 } }))} style={{ width: '100%', padding: '4px 6px', borderRadius: 4, border: '1px solid #eee', fontSize: 13, textAlign: 'right', boxSizing: 'border-box' }} placeholder="0" /></td>)}
                  <td style={{ padding: 6, textAlign: 'right', fontWeight: 700, color: '#085041' }}>{fmt(total)}</td></tr> ) })}</tbody>
            </table>
          </div>
        </div>}

        {/* EXPENSES */}
        {tab === 'expenses' && <>
          <div style={cs}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#2C3E6B', marginBottom: 16 }}>Add Expense</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div><label style={ls}>DATE</label><input type="date" value={txDate} onChange={e => setTxDate(e.target.value)} style={is} /></div>
              <div><label style={ls}>DESCRIPTION</label><input value={txDesc} onChange={e => setTxDesc(e.target.value)} placeholder="Dawn Food Products" style={is} /></div>
              <div><label style={ls}>AMOUNT ($)</label><input type="number" value={txAmount} onChange={e => setTxAmount(e.target.value)} placeholder="0.00" style={is} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
              <div><label style={ls}>CATEGORY</label><select value={txCat} onChange={e => setTxCat(e.target.value)} style={is}>{EXPENSE_CATS.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              <div><label style={ls}>SOURCE</label><input value={txSource} onChange={e => setTxSource(e.target.value)} placeholder="Square Bank" style={is} /></div>
            </div>
            <button onClick={addTransaction} style={{ marginTop: 12, padding: '10px 24px', borderRadius: 8, background: '#2C3E6B', color: '#fff', fontWeight: 600, border: 'none', cursor: 'pointer' }}>+ Add Expense</button>
          </div>
          <div style={cs}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#2C3E6B', marginBottom: 12 }}>Expense Log ({transactions.length} · {fmt(totalExpenses)})</div>
            {transactions.length === 0 ? <div style={{ color: '#aaa', fontSize: 13 }}>No expenses yet</div> :
              <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ borderBottom: '2px solid #e0e0e0' }}>{['Date','Description','Category','Source','Amount',''].map(h => <th key={h} style={{ textAlign: h === 'Amount' ? 'right' : 'left', padding: '8px', color: '#888', fontSize: 11 }}>{h}</th>)}</tr></thead>
                <tbody>{[...transactions].reverse().slice(0, 100).map(t => <tr key={t.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{t.date}</td><td style={{ padding: '6px 8px' }}>{t.desc}</td>
                  <td style={{ padding: '6px 8px' }}><span style={{ background: '#f0f0f0', padding: '2px 8px', borderRadius: 10, fontSize: 11 }}>{t.category}</span></td>
                  <td style={{ padding: '6px 8px', color: '#888' }}>{t.source}</td><td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: '#D85A30' }}>{fmt(t.amount)}</td>
                  <td><button onClick={() => setTransactions(p => p.filter(x => x.id !== t.id))} style={{ background: 'none', border: 'none', color: '#ddd', cursor: 'pointer' }}>✕</button></td>
                </tr>)}</tbody></table></div>}
          </div>
        </>}

        {/* IMPORT */}
        {tab === 'import' && <div style={cs}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#2C3E6B', marginBottom: 12 }}>Import Bank Statement CSV</div>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>Upload CSV from Square, Austin Bank, Capital One. Auto-categorized.</div>
          <div style={{ border: '2px dashed #ddd', borderRadius: 12, padding: 32, textAlign: 'center', cursor: 'pointer' }} onClick={() => fileRef.current?.click()}>
            <div style={{ fontSize: 28, color: '#ccc' }}>&#8679;</div><div style={{ fontWeight: 500, color: '#555', marginTop: 6 }}>Click to upload CSV</div>
            <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = ev => importCSV(ev.target?.result as string); r.readAsText(f); e.target.value = '' }} />
          </div>
          <div style={{ marginTop: 16 }}><div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>— or paste CSV —</div>
            <textarea id="csv-paste" rows={5} style={{ width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 8, fontFamily: 'monospace', fontSize: 12, boxSizing: 'border-box' }} placeholder="Paste CSV..." />
            <button onClick={() => { const el = document.getElementById('csv-paste') as HTMLTextAreaElement; if (el.value) importCSV(el.value) }} style={{ marginTop: 8, padding: '8px 20px', borderRadius: 8, background: '#2C3E6B', color: '#fff', fontWeight: 600, border: 'none', cursor: 'pointer' }}>Parse & Import</button>
          </div>
        </div>}

        {/* MILEAGE */}
        {tab === 'mileage' && <>
          <div style={cs}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#2C3E6B', marginBottom: 16 }}>Log Business Mileage</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 10 }}>
              <div><label style={ls}>DATE</label><input type="date" value={mlDate} onChange={e => setMlDate(e.target.value)} style={is} /></div>
              <div><label style={ls}>FROM</label><input value={mlFrom} onChange={e => setMlFrom(e.target.value)} placeholder="Top Donuts" style={is} /></div>
              <div><label style={ls}>TO</label><input value={mlTo} onChange={e => setMlTo(e.target.value)} placeholder="Sam's Club" style={is} /></div>
              <div><label style={ls}>MILES</label><input type="number" value={mlMiles} onChange={e => setMlMiles(e.target.value)} placeholder="12.5" style={is} /></div>
              <div><label style={ls}>PURPOSE</label><input value={mlPurpose} onChange={e => setMlPurpose(e.target.value)} placeholder="Supply run" style={is} /></div>
            </div>
            <button onClick={addMileage} style={{ marginTop: 12, padding: '10px 24px', borderRadius: 8, background: '#2C3E6B', color: '#fff', fontWeight: 600, border: 'none', cursor: 'pointer' }}>+ Add Trip</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
            {[{l:'Total Miles',v:totalMiles.toFixed(1),c:'#0C447C',bg:'#E6F1FB'},{l:'Rate (2026)',v:'$0.70/mi',c:'#0C447C',bg:'#E6F1FB'},{l:'Deduction',v:fmt(mileageDeduction),c:'#085041',bg:'#E8F5EE'}].map((m,i) =>
              <div key={i} style={{ background: m.bg, borderRadius: 10, padding: 16, textAlign: 'center' }}><div style={{ fontSize: 11, color: m.c, fontWeight: 500, textTransform: 'uppercase' }}>{m.l}</div><div style={{ fontSize: 24, fontWeight: 700, color: m.c }}>{m.v}</div></div>)}
          </div>
          <div style={cs}><div style={{ fontSize: 16, fontWeight: 700, color: '#2C3E6B', marginBottom: 12 }}>Trip Log ({mileage.length})</div>
            {mileage.length === 0 ? <div style={{ color: '#aaa', fontSize: 13 }}>No trips yet</div> :
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}><thead><tr style={{ borderBottom: '2px solid #e0e0e0' }}>{['Date','From','To','Miles','Purpose',''].map(h => <th key={h} style={{ textAlign: 'left', padding: 8, color: '#888', fontSize: 11 }}>{h}</th>)}</tr></thead>
                <tbody>{[...mileage].reverse().map(m => <tr key={m.id} style={{ borderBottom: '1px solid #f0f0f0' }}><td style={{ padding: '6px 8px' }}>{m.date}</td><td style={{ padding: '6px 8px' }}>{m.from}</td><td style={{ padding: '6px 8px' }}>{m.to}</td><td style={{ padding: '6px 8px', fontWeight: 600 }}>{m.miles}</td><td style={{ padding: '6px 8px', color: '#888' }}>{m.purpose}</td><td><button onClick={() => setMileage(p => p.filter(x => x.id !== m.id))} style={{ background: 'none', border: 'none', color: '#ddd', cursor: 'pointer' }}>✕</button></td></tr>)}</tbody></table>}
          </div>
        </>}

        {/* TAX */}
        {tab === 'tax' && <div style={{ background: '#FAEEDA', border: '1px solid #FAC775', borderRadius: 12, padding: '20px 24px' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#633806', marginBottom: 16 }}>2026 Tax Estimate — S Corp (MFJ)</div>
          <div style={{ fontSize: 13, lineHeight: 2 }}>
            {[['Net Profit', fmt(netProfit), ''],['Standard Deduction (MFJ)', '-'+fmt(standardDeduction), '#085041'],['QBI Deduction (20%)', '-'+fmt(qbiDeduction), '#085041'],['Mileage ('+totalMiles.toFixed(0)+' mi × $0.70)', '-'+fmt(mileageDeduction), '#085041'],['Taxable Income', fmt(taxableIncome), ''],['Federal Tax', fmt(fedTax), '#D85A30'],['Credits (child + dependent)', '-$2,500', '#085041'],['Federal Owed', fmt(fedOwed), '#D85A30'],['Texas', '$0.00', '#085041']].map(([l, v, c], i) =>
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(186,117,23,0.2)', fontWeight: i === 4 || i === 7 ? 700 : 400 }}><span>{l}</span><span style={{ color: c || undefined }}>{v}</span></div>)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: '#633806', color: '#fff', borderRadius: 8, fontSize: 18, fontWeight: 700, marginTop: 12 }}><span>Quarterly Payment</span><span>{fmt(quarterly)}</span></div>
          <div style={{ fontSize: 11, color: '#BA7517', marginTop: 12 }}>Due: Apr 15, Jun 15, Sep 15, Jan 15. Estimate only — consult CPA.</div>
        </div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'center', alignItems: 'center' }}>
          <button onClick={saveToServer} disabled={saving} style={{ padding: '12px 28px', borderRadius: 8, background: saving ? '#aaa' : '#085041', color: '#fff', fontWeight: 700, fontSize: 15, border: 'none', cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving...' : '💾 Save'}</button>
          <button onClick={() => window.print()} style={{ padding: '12px 24px', borderRadius: 8, background: '#2C3E6B', color: '#fff', fontWeight: 600, border: 'none', cursor: 'pointer' }}>Print / PDF</button>
          {lastSaved && <span style={{ fontSize: 12, color: '#888' }}>Last saved: {lastSaved}</span>}
        </div>
        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: '#aaa', paddingBottom: 40 }}>Kimco LLC — Top Donut 2026</div>
      </div>
      <style>{`@page{margin:0.3in}@media print{footer,header,nav,button{display:none!important}body{background:#fff!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}}`}</style>
    </div>
  )
}
