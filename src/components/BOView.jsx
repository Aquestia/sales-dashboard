import { useState } from 'react'
import { fmt } from '../utils/helpers'

const COLS = [
  ['doc','הזמנה'],['line','שורה'],['customer','לקוח'],['item_code','מק"ט'],
  ['requested_date','תאריך מבוקש'],['back_orders_amount','Back Order $'],
  ['open_sales_amount','שווי פתוח'],['past_due','פיגור $'],['sales_status','סטטוס']
]

export default function BOView({ bo }) {
  const [search, setSearch] = useState('')

  const totalBO  = bo.reduce((s, r) => s + (r.back_orders_amount || 0), 0)
  const totalPast = bo.reduce((s, r) => s + (r.past_due || 0), 0)

  const filtered = search
    ? bo.filter(r =>
        (r.doc||'').toLowerCase().includes(search.toLowerCase()) ||
        (r.customer||'').toLowerCase().includes(search.toLowerCase()) ||
        (r.item_code||'').toLowerCase().includes(search.toLowerCase())
      )
    : bo

  const rows = [...filtered].sort((a, b) => (b.back_orders_amount || 0) - (a.back_orders_amount || 0))

  return (
    <div>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 12, marginBottom: '1.5rem' }}>
        {[
          { label: 'סה"כ Back Orders', value: '$' + fmt(totalBO),   sub: bo.length + ' שורות', accent: true },
          { label: 'פיגורים (Past Due)', value: '$' + fmt(totalPast), sub: '' },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--surface-2)', border: '0.5px solid ' + (k.accent ? 'var(--border-accent)' : 'var(--border)'), borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: k.accent ? 'var(--red)' : 'inherit' }}>{k.value}</div>
            {k.sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ marginBottom: 12 }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={'חיפוש לפי הזמנה / לקוח / מק"ט...'}
          style={{ width: 320 }} />
        {search && <span style={{ fontSize: 12, color: 'var(--text-muted)', marginRight: 10 }}>{rows.length} תוצאות</span>}
      </div>

      {/* Table */}
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
                    {k === 'back_orders_amount' ? <span style={{ fontWeight: 500, color: 'var(--red)' }}>${fmt(r[k] || 0)}</span>
                      : k === 'open_sales_amount' || k === 'past_due' ? '$' + fmt(r[k] || 0)
                      : (r[k] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
