import { useState, useMemo } from 'react'
import { fmt } from '../utils/helpers'

const MONTHS_HE = ['ינו','פבר','מרץ','אפר','מאי','יונ','יול','אוג','ספט','אוק','נוב','דצמ']

function monthKey(dateStr) {
  if (!dateStr) return null
  return String(dateStr).slice(0, 7)
}

function monthLabel(key) {
  if (!key) return ''
  const [y, m] = key.split('-')
  return `${MONTHS_HE[parseInt(m) - 1]} ${y}`
}

const DETAIL_COLS = [
  ['doc','הזמנה'], ['line','שורה'], ['customer','לקוח'], ['item_code','מק"ט'],
  ['requested_date','תאריך מבוקש'], ['back_orders_amount','Back Order $'],
  ['open_sales_amount','שווי פתוח'], ['past_due','פיגור $'], ['sales_status','סטטוס']
]

export default function BOView({ bo }) {
  const [selectedMonth, setSelectedMonth] = useState(null)

  const totalBO    = bo.reduce((s, r) => s + (r.back_orders_amount || 0), 0)
  const totalPast  = bo.reduce((s, r) => s + (r.past_due || 0), 0)

  // Group by requested_date month
  const months = useMemo(() => {
    const m = {}
    bo.forEach(r => {
      const k = monthKey(r.requested_date)
      if (!k) return
      if (!m[k]) m[k] = { key: k, amount: 0, cnt: 0, rows: [] }
      m[k].amount += r.back_orders_amount || 0
      m[k].cnt += 1
      m[k].rows.push(r)
    })
    return Object.values(m).sort((a, b) => a.key.localeCompare(b.key))
  }, [bo])

  const detailRows = selectedMonth
    ? (months.find(m => m.key === selectedMonth)?.rows || []).sort((a,b) => (b.back_orders_amount||0) - (a.back_orders_amount||0))
    : []

  // Chart dimensions
  const BAR_W = 56
  const GAP   = 16
  const H     = 180
  const PAD_L = 60
  const PAD_B = 40
  const PAD_T = 50
  const maxAmt = Math.max(...months.map(m => m.amount), 1)
  const chartW = PAD_L + months.length * (BAR_W + GAP) + GAP

  return (
    <div>
      <div className="page-heading">Back Orders</div>

      {/* KPIs */}
      <div className="kpi-row" style={{ marginBottom: '1.25rem' }}>
        <div className="kpi-card" style={{ cursor: 'default' }}>
          <div className="kpi-label">סה"כ Back Orders</div>
          <div className="kpi-value" style={{ color: 'var(--red-dark)' }}>${fmt(totalBO)}</div>
          <div className="kpi-sub">{bo.length} שורות</div>
        </div>
        <div className="kpi-card" style={{ cursor: 'default' }}>
          <div className="kpi-label">פיגורים (Past Due)</div>
          <div className="kpi-value">${fmt(totalPast)}</div>
          <div className="kpi-sub"></div>
        </div>
        <div className="kpi-card" style={{ cursor: 'default' }}>
          <div className="kpi-label">חודשים</div>
          <div className="kpi-value">{months.length}</div>
          <div className="kpi-sub"></div>
        </div>
      </div>

      {/* Bar chart */}
      <div className="section-box" style={{ overflowX: 'auto' }}>
        <div className="section-title">לפי תאריך מבוקש — חודשי</div>
        <svg width={chartW} height={H + PAD_T + PAD_B} style={{ display: 'block', direction: 'ltr' }}>
          {/* Y axis grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map(pct => {
            const y = PAD_T + H - pct * H
            return (
              <g key={pct}>
                <line x1={PAD_L} y1={y} x2={chartW} y2={y} stroke="#e5e5e0" strokeWidth={0.5} />
                <text x={PAD_L - 6} y={y + 4} textAnchor="end" fontSize={10} fill="#888">
                  ${fmt(pct * maxAmt)}
                </text>
              </g>
            )
          })}

          {/* Bars */}
          {months.map((m, i) => {
            const x = PAD_L + GAP + i * (BAR_W + GAP)
            const barH = Math.max(2, (m.amount / maxAmt) * H)
            const y = PAD_T + H - barH
            const active = selectedMonth === m.key
            return (
              <g key={m.key} style={{ cursor: 'pointer' }} onClick={() => setSelectedMonth(active ? null : m.key)}>
                {/* Bar */}
                <rect x={x} y={y} width={BAR_W} height={barH}
                  fill={active ? '#185FA5' : '#378ADD'} rx={4} opacity={active ? 1 : 0.75} />
                {/* Count above bar */}
                <text x={x + BAR_W / 2} y={y - 18} textAnchor="middle" fontSize={10} fill="#555" fontWeight="600">
                  {m.cnt} שורות
                </text>
                {/* Amount above bar */}
                <text x={x + BAR_W / 2} y={y - 5} textAnchor="middle" fontSize={10} fill={active ? '#185FA5' : '#378ADD'} fontWeight="600">
                  ${fmt(m.amount)}
                </text>
                {/* Month label below */}
                <text x={x + BAR_W / 2} y={PAD_T + H + 16} textAnchor="middle" fontSize={11} fill={active ? '#185FA5' : '#555'} fontWeight={active ? '600' : '400'}>
                  {monthLabel(m.key)}
                </text>
              </g>
            )
          })}

          {/* X axis line */}
          <line x1={PAD_L} y1={PAD_T + H} x2={chartW} y2={PAD_T + H} stroke="#ccc" strokeWidth={1} />
        </svg>
      </div>

      {/* Detail table - grouped by customer */}
      {selectedMonth && detailRows.length > 0 && (() => {
        // Group by customer
        const byCustomer = {}
        detailRows.forEach(r => {
          const k = r.customer || '—'
          if (!byCustomer[k]) byCustomer[k] = { customer: k, amount: 0, rows: [] }
          byCustomer[k].amount += r.back_orders_amount || 0
          byCustomer[k].rows.push(r)
        })
        const custGroups = Object.values(byCustomer).sort((a, b) => b.amount - a.amount)

        return (
          <div className="section-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div className="section-title" style={{ margin: 0 }}>
                {monthLabel(selectedMonth)} — {detailRows.length} שורות · ${fmt(detailRows.reduce((s,r)=>s+(r.back_orders_amount||0),0))}
              </div>
              <button onClick={() => setSelectedMonth(null)}
                style={{ fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>✕ סגור</button>
            </div>

            {/* Customer accordion */}
            {custGroups.map((grp, gi) => (
              <CustomerGroup key={grp.customer} grp={grp} cols={DETAIL_COLS} />
            ))}
          </div>
        )
      })()}

    </div>
  )
}

function CustomerGroup({ grp, cols }) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ borderBottom: '0.5px solid var(--border-tbl)' }}>
      {/* Customer summary row */}
      <button onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 12px', background: open ? 'var(--blue-bg)' : 'var(--bg-row)',
          border: 'none', cursor: 'pointer', textAlign: 'right', gap: 12
        }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: open ? 'var(--blue-dark)' : 'var(--text-main)', flex: 1 }}>
          {open ? '▾' : '▸'} {grp.customer}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 16 }}>{grp.rows.length} שורות</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--red-dark)', minWidth: 90, textAlign: 'left' }}>
          ${fmt(grp.amount)}
        </span>
      </button>

      {/* Expanded order rows */}
      {open && (
        <div style={{ overflowX: 'auto', background: 'var(--bg-card)', padding: '0 0 8px 0' }}>
          <table style={{ fontSize: 12 }}>
            <thead>
              <tr>
                {cols.filter(([k]) => k !== 'customer').map(([k, l]) => (
                  <th key={k} style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-muted)', borderBottom: '0.5px solid var(--border-tbl)', whiteSpace: 'nowrap' }}>{l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grp.rows.map((r, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? 'var(--bg-row)' : 'var(--bg-card)' }}>
                  {cols.filter(([k]) => k !== 'customer').map(([k]) => (
                    <td key={k} style={{ padding: '6px 8px', borderBottom: '0.5px solid var(--border-tbl)', whiteSpace: 'nowrap' }}>
                      {k === 'back_orders_amount'
                        ? <span style={{ fontWeight: 500, color: 'var(--red-dark)' }}>${fmt(r[k] || 0)}</span>
                        : k === 'open_sales_amount' || k === 'past_due'
                        ? '$' + fmt(r[k] || 0)
                        : (r[k] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
