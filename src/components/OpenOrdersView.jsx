import { useState, useEffect } from 'react'
import { fetchOpenOrders } from '../utils/db'
import { fmt, groupBy } from '../utils/helpers'

const TODAY = new Date().toISOString().split('T')[0]

const DIMS = [
  { key: 'cat',              label: 'פנימי / חיצוני',    map: { Internal: 'פנימי', External: 'חיצוני' } },
  { key: 'status',           label: 'סטטוס' },
  { key: 'mode_of_delivery', label: 'אופן משלוח' },
  { key: 'family',           label: 'משפחת מוצר' },
  { key: 'customer_name',    label: 'לקוחות מובילים',    topN: 10 },
  { key: '_late',            label: 'איחור באספקה',      map: { true: 'באיחור', false: 'בזמן' } },
]

const COLS = [
  ['sales_order','הזמנה'],['line_number','שורה'],['customer_account','לקוח'],['customer_name','שם לקוח'],
  ['item_number','פריט'],['status','סטטוס'],['mode_of_delivery','משלוח'],['family','משפחה'],
  ['confirmed_ship_date','תאריך אספקה'],['remaining_amount','סכום'],['gm_pct','GM%']
]

export default function OpenOrdersView() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [openKey, setOpenKey] = useState(null)

  useEffect(() => {
    fetchOpenOrders().then(d => {
      const enriched = d.map(r => ({ ...r, _late: String(!!(r.confirmed_ship_date && r.confirmed_ship_date < TODAY)) }))
      setRows(enriched)
      setLoading(false)
    })
  }, [])

  const totalAmt = rows.reduce((s, r) => s + (r.remaining_amount || 0), 0)
  const totalGM  = rows.reduce((s, r) => s + (r.remaining_amount || 0) * (r.gm_pct || 0) / 100, 0)
  const lateRows = rows.filter(r => r._late === 'true')
  const lateAmt  = lateRows.reduce((s, r) => s + (r.remaining_amount || 0), 0)

  const kpis = [
    { label: 'שווי הזמנות פתוחות', value: '$' + fmt(totalAmt), sub: rows.length + ' שורות' },
    { label: 'רווח גולמי משוקלל',  value: totalAmt ? (totalGM / totalAmt * 100).toFixed(1) + '%' : '—', sub: '' },
    { label: 'הזמנות באיחור',      value: '$' + fmt(lateAmt), sub: lateRows.length + ' שורות', accent: true },
  ]

  if (loading) return <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>טוען נתונים...</div>

  function getGroup(dim) {
    const g = groupBy(rows, r => r[dim.key] ?? '—')
    let items = Object.entries(g).map(([k, v]) => ({ key: k, amount: v.reduce((s, r) => s + (r.remaining_amount || 0), 0), cnt: v.length }))
      .sort((a, b) => b.amount - a.amount)
    if (dim.topN) items = items.slice(0, dim.topN)
    return items
  }

  function getDetailRows() {
    if (!openKey) return []
    const [dimKey, val] = openKey.split('|val|')
    return rows.filter(r => String(r[dimKey] ?? '—') === val).sort((a, b) => (b.remaining_amount || 0) - (a.remaining_amount || 0)).slice(0, 100)
  }

  return (
    <div>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 12, marginBottom: '1.5rem' }}>
        {kpis.map(k => (
          <div key={k.label} style={{ background: 'var(--surface-2)', border: '0.5px solid ' + (k.accent ? 'var(--border-accent)' : 'var(--border)'), borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: k.accent ? 'var(--red)' : 'inherit' }}>{k.value}</div>
            {k.sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* Dimension chips */}
      {DIMS.map(dim => {
        const items = getGroup(dim)
        return (
          <div key={dim.key} style={{ marginBottom: '1.3rem' }}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>{dim.label}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {items.map(it => {
                const k = `${dim.key}|val|${it.key}`
                const active = openKey === k
                const label = dim.map ? (dim.map[it.key] ?? it.key) : it.key
                return (
                  <button key={it.key} onClick={() => setOpenKey(active ? null : k)}
                    style={{ textAlign: 'right', padding: '8px 12px', borderRadius: 'var(--radius)',
                      border: '0.5px solid ' + (active ? 'var(--border-accent)' : 'var(--border)'),
                      background: active ? 'var(--bg-accent)' : 'var(--surface-1)', cursor: 'pointer', fontSize: 12 }}>
                    <div style={{ fontWeight: 500 }}>{label}</div>
                    <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>${fmt(it.amount)} · {it.cnt} שורות</div>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Detail table */}
      {openKey && (() => {
        const detailRows = getDetailRows()
        const [dimKey, , val] = openKey.split('|val|')
        const dim = DIMS.find(d => d.key === dimKey)
        const label = dim?.map ? (dim.map[val] ?? val) : val
        return (
          <div style={{ border: '0.5px solid var(--border)', borderRadius: 12, padding: '1rem 1.1rem', background: 'var(--surface-2)' }}>
            <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 10 }}>{dim?.label} · {label} — {detailRows.length} שורות</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>{COLS.map(([k, l]) => <th key={k} style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-secondary)', borderBottom: '0.5px solid var(--border)', whiteSpace: 'nowrap' }}>{l}</th>)}</tr>
                </thead>
                <tbody>
                  {detailRows.map((r, i) => (
                    <tr key={i}>
                      {COLS.map(([k]) => (
                        <td key={k} style={{ padding: '6px 8px', borderBottom: '0.5px solid var(--border)', whiteSpace: 'nowrap' }}>
                          {k === 'remaining_amount' ? `$${fmt(r[k] || 0)}` : k === 'gm_pct' ? `${r[k] || 0}%` : (r[k] ?? '')}
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
