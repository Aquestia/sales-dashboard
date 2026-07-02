import { useState } from 'react'
import { fmt, isInternal } from '../utils/helpers'

const COLS = [
  ['invoice','חשבונית'],['invoice_account','לקוח'],['name','שם לקוח'],
  ['sales_order','הזמנה'],['invoice_date','תאריך'],['currency','מטבע'],
  ['invoice_amount','סכום חשבוניות'],['cat','סוג']
]

export default function InvoicesView({ invoices }) {
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')

  const totalAmt = invoices.reduce((s, r) => s + (r.invoice_amount || 0), 0)

  let rows = catFilter === 'all' ? invoices : invoices.filter(r => r.cat === catFilter)
  if (search) {
    const q = search.toLowerCase()
    rows = rows.filter(r =>
      (r.invoice||'').toLowerCase().includes(q) ||
      (r.name||'').toLowerCase().includes(q) ||
      (r.invoice_account||'').toLowerCase().includes(q) ||
      (r.sales_order||'').toLowerCase().includes(q)
    )
  }
  rows = [...rows].sort((a, b) => (b.invoice_date||'').localeCompare(a.invoice_date||''))

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 12, marginBottom: '1.5rem' }}>
        {[
          { label: 'סה"כ חשבוניות', value: '$' + fmt(totalAmt), sub: invoices.length + ' חשבוניות' },
          { label: 'לקוחות פנימיים', value: '$' + fmt(invoices.filter(r=>r.cat==='Internal').reduce((s,r)=>s+(r.invoice_amount||0),0)), sub: '' },
          { label: 'לקוחות חיצוניים', value: '$' + fmt(invoices.filter(r=>r.cat==='External').reduce((s,r)=>s+(r.invoice_amount||0),0)), sub: '' },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--surface-2)', border: '0.5px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{k.value}</div>
            {k.sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="חיפוש לפי חשבונית / לקוח / הזמנה..."
          style={{ width: 280 }} />
        {['all','Internal','External'].map(v => (
          <button key={v} onClick={() => setCatFilter(v)}
            style={{ padding: '7px 14px', borderRadius: 'var(--radius)',
              border: '0.5px solid ' + (catFilter === v ? 'var(--border-accent)' : 'var(--border)'),
              background: catFilter === v ? 'var(--bg-accent)' : 'var(--surface-1)',
              cursor: 'pointer', fontSize: 13 }}>
            {v === 'all' ? 'הכל' : v === 'Internal' ? 'פנימיים' : 'חיצוניים'}
          </button>
        ))}
      </div>

      <div style={{ overflowX: 'auto', background: 'var(--surface-2)', border: '0.5px solid var(--border)', borderRadius: 12, padding: '1rem 1.1rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {COLS.map(([k, l]) => (
                <th key={k} style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-secondary)', borderBottom: '0.5px solid var(--border)', whiteSpace: 'nowrap' }}>{l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? 'var(--surface-1)' : 'var(--surface-2)' }}>
                {COLS.map(([k]) => (
                  <td key={k} style={{ padding: '6px 8px', borderBottom: '0.5px solid var(--border)', whiteSpace: 'nowrap' }}>
                    {k === 'invoice_amount' ? '$' + fmt(r[k] || 0)
                      : k === 'cat' ? (r[k] === 'Internal' ? 'פנימי' : 'חיצוני')
                      : (r[k] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>אין נתונים</div>}
      </div>
    </div>
  )
}
