import { useState, useEffect } from 'react'
import { fetchSnapshotDates, fetchSnapshotByDate } from '../utils/db'
import { fmt } from '../utils/helpers'

const CATS = [
  { key: 'plan',     label: 'תוכנית',           amtKey: 'remaining_amount' },
  { key: 'niso',     label: 'תעודות משלוח',      amtKey: 'amount' },
  { key: 'invoices', label: 'חשבוניות',          amtKey: 'invoice_amount' },
]

const COLS = {
  plan:     [['sales_order','הזמנה'],['line_number','שורה'],['customer_account','לקוח'],['customer_name','שם לקוח'],['item_number','פריט'],['item_group','קבוצה'],['status','סטטוס'],['confirmed_ship_date','תאריך אספקה'],['remaining_amount','סכום']],
  niso:     [['sales_order','הזמנה'],['line_number','שורה'],['customer','לקוח'],['customer_name','שם לקוח'],['item_number','פריט'],['ship_date','תאריך שילוח'],['quantity','כמות'],['amount','סכום']],
  invoices: [['invoice','חשבונית'],['invoice_account','לקוח'],['name','שם לקוח'],['sales_order','הזמנה'],['invoice_date','תאריך'],['invoice_amount','סכום']],
}

const AMT_COL = { plan: 'remaining_amount', niso: 'amount', invoices: 'invoice_amount' }

export default function SnapshotView() {
  const [dates, setDates] = useState([])
  const [date, setDate] = useState('')
  const [data, setData] = useState({ plan: [], niso: [], invoices: [] })
  const [loading, setLoading] = useState(false)
  const [openKey, setOpenKey] = useState(null) // 'catKey|Internal|External'

  useEffect(() => {
    fetchSnapshotDates().then(ds => {
      setDates(ds)
      if (ds.length) setDate(ds[0])
    })
  }, [])

  useEffect(() => {
    if (!date) return
    setLoading(true)
    setOpenKey(null)
    fetchSnapshotByDate(date).then(d => { setData(d); setLoading(false) })
  }, [date])

  function getRows(catKey, ie) {
    const rows = data[catKey] || []
    return rows.filter(r => r.cat === ie)
  }

  function total(catKey, ie) {
    const col = AMT_COL[catKey]
    return getRows(catKey, ie).reduce((s, r) => s + (r[col] || 0), 0)
  }

  return (
    <div>
      {/* Date picker */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <label style={{ fontSize: 14, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>תאריך דיווח</label>
        <select value={date} onChange={e => setDate(e.target.value)} style={{ minWidth: 160 }}>
          {dates.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        {loading && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>טוען...</span>}
      </div>

      {/* Cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: '1.5rem' }}>
        {CATS.map(cat => (
          <div key={cat.key} style={{ background: 'var(--surface-2)', border: '0.5px solid var(--border)', borderRadius: 12, padding: '1rem 1.1rem' }}>
            <div style={{ fontWeight: 500, fontSize: 15, marginBottom: 10 }}>{cat.label}</div>
            {['External', 'Internal'].map(ie => {
              const k = `${cat.key}|${ie}`
              const active = openKey === k
              const rows = getRows(cat.key, ie)
              return (
                <button key={ie} onClick={() => setOpenKey(active ? null : k)}
                  style={{ width: '100%', textAlign: 'right', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 12px', marginBottom: 8, borderRadius: 'var(--radius)',
                    border: '0.5px solid ' + (active ? 'var(--border-accent)' : 'var(--border)'),
                    background: active ? 'var(--bg-accent)' : 'var(--surface-1)', cursor: 'pointer' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {ie === 'External' ? 'חיצוניים' : 'פנימיים'}
                    <br /><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{rows.length} שורות</span>
                  </span>
                  <span style={{ fontSize: 16, fontWeight: 500 }}>${fmt(total(cat.key, ie))}</span>
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {/* Detail table */}
      {openKey && (() => {
        const [catKey, ie] = openKey.split('|')
        const cat = CATS.find(c => c.key === catKey)
        const amtCol = AMT_COL[catKey]
        const rows = getRows(catKey, ie).sort((a, b) => (b[amtCol] || 0) - (a[amtCol] || 0))
        const cols = COLS[catKey]
        return (
          <div style={{ border: '0.5px solid var(--border)', borderRadius: 12, padding: '1rem 1.1rem', background: 'var(--surface-2)' }}>
            <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 10 }}>
              {cat.label} · {ie === 'External' ? 'חיצוניים' : 'פנימיים'} — {rows.length} שורות
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    {cols.map(([k, label]) => (
                      <th key={k} style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-secondary)', borderBottom: '0.5px solid var(--border)', whiteSpace: 'nowrap' }}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      {cols.map(([k]) => (
                        <td key={k} style={{ padding: '6px 8px', borderBottom: '0.5px solid var(--border)', whiteSpace: 'nowrap' }}>
                          {k === amtCol ? `$${fmt(r[k] || 0)}` : (r[k] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
