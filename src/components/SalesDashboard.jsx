import { useState, useMemo } from 'react'
import { fmt } from '../utils/helpers'

const ORDER_COLS = [
  ['sales_order','הזמנה'],
  ['line_number','שורה'],
  ['customer_account','לקוח'],
  ['customer_name','שם לקוח'],
  ['item_number','מק"ט'],
  ['item_group','קב. פריט'],
  ['status','סטטוס'],
  ['mode_of_delivery','משלוח'],
  ['confirmed_ship_date','תאריך אספקה מאושר'],
  ['requested_ship_date','תאריך מבוקש'],
  ['ordered_quantity','כמות'],
  ['deliver_remainder','יתרה'],
  ['remaining_amount','סכום $'],
]

function monthKey(dateStr) {
  if (!dateStr) return null
  return dateStr.slice(0, 7) // YYYY-MM
}

function monthLabel(key) {
  if (!key) return ''
  const [y, m] = key.split('-')
  const months = ['ינו','פבר','מרץ','אפר','מאי','יונ','יול','אוג','ספט','אוק','נוב','דצמ']
  return `${months[parseInt(m) - 1]} ${y}`
}

export default function SalesDashboard({ orders }) {
  const [selected, setSelected] = useState(null) // { type: 'all'|'internal'|'external'|'month', key?, cat? }

  const totalAll      = orders.reduce((s, r) => s + (r.remaining_amount || 0), 0)
  const totalInternal = orders.filter(r => r.cat === 'Internal').reduce((s, r) => s + (r.remaining_amount || 0), 0)
  const totalExternal = orders.filter(r => r.cat === 'External').reduce((s, r) => s + (r.remaining_amount || 0), 0)

  // Monthly breakdown by confirmed_ship_date
  const months = useMemo(() => {
    const m = {}
    orders.forEach(r => {
      const k = monthKey(r.confirmed_ship_date)
      if (!k) return
      if (!m[k]) m[k] = { key: k, all: 0, internal: 0, external: 0, rows: [] }
      m[k].all += r.remaining_amount || 0
      if (r.cat === 'Internal') m[k].internal += r.remaining_amount || 0
      else m[k].external += r.remaining_amount || 0
      m[k].rows.push(r)
    })
    return Object.values(m).sort((a, b) => a.key.localeCompare(b.key))
  }, [orders])

  // Detail rows to show
  const detailRows = useMemo(() => {
    if (!selected) return []
    if (selected.type === 'all')      return orders
    if (selected.type === 'internal') return orders.filter(r => r.cat === 'Internal')
    if (selected.type === 'external') return orders.filter(r => r.cat === 'External')
    if (selected.type === 'month') {
      const m = months.find(m => m.key === selected.key)
      if (!m) return []
      if (selected.cat === 'internal') return m.rows.filter(r => r.cat === 'Internal')
      if (selected.cat === 'external') return m.rows.filter(r => r.cat === 'External')
      return m.rows
    }
    return []
  }, [selected, orders, months])

  function toggle(type, key, cat) {
    const same = selected?.type === type && selected?.key === key && selected?.cat === cat
    setSelected(same ? null : { type, key, cat })
  }

  function isActive(type, key, cat) {
    return selected?.type === type && selected?.key === key && selected?.cat === cat
  }

  return (
    <div>
      <h2 className="page-heading">דוח מכירות — הזמנות פתוחות</h2>

      {/* KPI Cards */}
      <div className="kpi-row">
        {[
          { label: 'סה"כ הזמנות פתוחות', value: '$' + fmt(totalAll),      sub: orders.length + ' שורות',                                 type: 'all' },
          { label: 'לקוחות פנימיים',      value: '$' + fmt(totalInternal), sub: orders.filter(r=>r.cat==='Internal').length + ' שורות',   type: 'internal' },
          { label: 'לקוחות חיצוניים',    value: '$' + fmt(totalExternal), sub: orders.filter(r=>r.cat==='External').length + ' שורות',   type: 'external' },
        ].map(k => (
          <button key={k.type} onClick={() => toggle(k.type)}
            className={'kpi-card' + (isActive(k.type) ? ' active' : '')}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value">{k.value}</div>
            <div className="kpi-sub">{k.sub}</div>
          </button>
        ))}
      </div>

      {/* Monthly table */}
      <div className="section-box" style={{ marginBottom: '1.5rem' }}>
        <div className="section-title">תאריך אספקה מאושר — לפי חודש</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['חודש','סה"כ','פנימיים','חיצוניים','שורות'].map(h => (
                  <th key={h} style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--text-secondary)', borderBottom: '0.5px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {months.map(m => (
                <tr key={m.key} style={{ cursor: 'pointer' }}
                  onClick={() => toggle('month', m.key)}>
                  <td style={{ padding: '8px 10px', borderBottom: '0.5px solid var(--border)', fontWeight: 500 }}>
                    {monthLabel(m.key)}
                  </td>
                  {/* Total */}
                  <td style={{ padding: '8px 10px', borderBottom: '0.5px solid var(--border)' }}>
                    <button onClick={e => { e.stopPropagation(); toggle('month', m.key, undefined) }}
                      style={{ background: isActive('month', m.key, undefined) ? 'var(--bg-accent)' : 'transparent',
                        border: 'none', cursor: 'pointer', fontWeight: 500, padding: '2px 6px', borderRadius: 4 }}>
                      ${fmt(m.all)}
                    </button>
                  </td>
                  {/* Internal */}
                  <td style={{ padding: '8px 10px', borderBottom: '0.5px solid var(--border)' }}>
                    <button onClick={e => { e.stopPropagation(); toggle('month', m.key, 'internal') }}
                      style={{ background: isActive('month', m.key, 'internal') ? 'var(--bg-accent)' : 'transparent',
                        border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 4 }}>
                      ${fmt(m.internal)}
                    </button>
                  </td>
                  {/* External */}
                  <td style={{ padding: '8px 10px', borderBottom: '0.5px solid var(--border)' }}>
                    <button onClick={e => { e.stopPropagation(); toggle('month', m.key, 'external') }}
                      style={{ background: isActive('month', m.key, 'external') ? 'var(--bg-accent)' : 'transparent',
                        border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 4 }}>
                      ${fmt(m.external)}
                    </button>
                  </td>
                  <td style={{ padding: '8px 10px', borderBottom: '0.5px solid var(--border)', color: 'var(--text-muted)' }}>
                    {m.rows.length}
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Total footer */}
            <tfoot>
              <tr style={{ fontWeight: 600, background: 'var(--surface-1)' }}>
                <td style={{ padding: '8px 10px', borderTop: '1px solid var(--border)' }}>סה"כ</td>
                <td style={{ padding: '8px 10px', borderTop: '1px solid var(--border)' }}>${fmt(totalAll)}</td>
                <td style={{ padding: '8px 10px', borderTop: '1px solid var(--border)' }}>${fmt(totalInternal)}</td>
                <td style={{ padding: '8px 10px', borderTop: '1px solid var(--border)' }}>${fmt(totalExternal)}</td>
                <td style={{ padding: '8px 10px', borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}>{orders.length}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Detail table */}
      {selected && detailRows.length > 0 && (
        <div className="section-box">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="section-title" style={{ margin: 0 }}>
              {selected.type === 'month'
                ? `${monthLabel(selected.key)}${selected.cat === 'internal' ? ' — פנימיים' : selected.cat === 'external' ? ' — חיצוניים' : ''}`
                : selected.type === 'internal' ? 'לקוחות פנימיים'
                : selected.type === 'external' ? 'לקוחות חיצוניים'
                : 'כל ההזמנות'}
              {' '}— {detailRows.length} שורות · ${fmt(detailRows.reduce((s,r)=>s+(r.remaining_amount||0),0))}
            </div>
            <button onClick={() => setSelected(null)}
              style={{ fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>✕ סגור</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {ORDER_COLS.map(([k, l]) => (
                    <th key={k} style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-secondary)', borderBottom: '0.5px solid var(--border)', whiteSpace: 'nowrap' }}>{l}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {detailRows.sort((a,b)=>(a.confirmed_ship_date||'').localeCompare(b.confirmed_ship_date||'')).map((r, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'var(--surface-1)' : 'var(--surface-2)' }}>
                    {ORDER_COLS.map(([k]) => (
                      <td key={k} style={{ padding: '6px 8px', borderBottom: '0.5px solid var(--border)', whiteSpace: 'nowrap' }}>
                        {k === 'remaining_amount' ? '$' + fmt(r[k] || 0) : (r[k] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
