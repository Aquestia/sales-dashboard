import { useState, useMemo } from 'react'
import { fmt } from '../utils/helpers'
import { saveProcurementNote } from '../utils/db'

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

export default function BOView({ bo, allocation = [], purchaseOrders = [], procurementNotes = {}, production = [] }) {
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

  // Chart dimensions - full width
  const BAR_W = 72
  const GAP   = 24
  const H     = 200
  const PAD_L = 70
  const PAD_B = 44
  const PAD_T = 54
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
          <div className="kpi-label">חודשים</div>
          <div className="kpi-value">{months.length}</div>
        </div>
      </div>

      {/* Bar chart */}
      <div className="section-box" style={{ overflowX: 'auto', textAlign: 'center' }}>
        <div className="section-title">לפי תאריך מבוקש — חודשי</div>
        <svg width={Math.max(chartW, 600)} height={H + PAD_T + PAD_B} style={{ display: 'inline-block', direction: 'ltr' }}>
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
              <CustomerGroup key={grp.customer} grp={grp} cols={DETAIL_COLS} allocation={allocation} purchaseOrders={purchaseOrders} procurementNotes={procurementNotes} production={production} />
            ))}
          </div>
        )
      })()}

    </div>
  )
}

function CustomerGroup({ grp, cols, allocation, purchaseOrders, procurementNotes, production }) {
  const [open, setOpen] = useState(false)
  const [openShortage, setOpenShortage] = useState(null)
  const [notes, setNotes] = useState(procurementNotes)
  const [editingNote, setEditingNote] = useState(null) // item_number
  const [saving, setSaving] = useState(false) // doc key

  async function saveNote(itemNumber, noteText) {
    setSaving(true)
    const existing = notes[itemNumber] || {}
    await saveProcurementNote(itemNumber, {
      note_procurement: noteText,
      note_tapi: existing.note_tapi || '',
      treatment_status: existing.treatment_status || '',
    })
    setNotes(prev => ({ ...prev, [itemNumber]: { ...existing, note_procurement: noteText } }))
    setEditingNote(null)
    setSaving(false)
  }

  function getShortages(doc) {
    return allocation.filter(a =>
      a.number === doc &&
      a.reference === 'Sales order' &&
      a.shortage_exist === 'Yes' &&
      a.missing_qty > 0
    )
  }

  // Build production lookup by item_number
  const prodByItem = useMemo(() => {
    const m = {}
    production.forEach(p => {
      if (!m[p.item_number]) m[p.item_number] = []
      m[p.item_number].push(p)
    })
    return m
  }, [production])

  function bestPO(itemNumber) {
    const candidates = purchaseOrders.filter(p =>
      p.item_number === String(itemNumber) &&
      p.deliver_remainder > 0 &&
      p.document_status !== 'Invoice'
    )
    return candidates.sort((a, b) => {
      const da = a.confirmed_receipt_date || a.requested_receipt_date || '9999'
      const db = b.confirmed_receipt_date || b.requested_receipt_date || '9999'
      return da.localeCompare(db)
    })[0] || null
  }

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
                <th style={{ padding: '6px 8px', color: 'var(--text-muted)', borderBottom: '0.5px solid var(--border-tbl)', whiteSpace: 'nowrap' }}>חוסר</th>
                {cols.filter(([k]) => k !== 'customer').map(([k, l]) => (
                  <th key={k} style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-muted)', borderBottom: '0.5px solid var(--border-tbl)', whiteSpace: 'nowrap' }}>{l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grp.rows.map((r, i) => {
                const shortages = getShortages(r.doc)
                const hasShortage = shortages.length > 0
                const shortageKey = `${r.doc}-${r.line}`
                const isOpen = openShortage === shortageKey

                return (
                  <>
                    <tr key={i} style={{ background: i % 2 === 0 ? 'var(--bg-row)' : 'var(--bg-card)' }}>
                      <td style={{ padding: '6px 8px', borderBottom: '0.5px solid var(--border-tbl)', whiteSpace: 'nowrap', textAlign: 'center' }}>
                        {hasShortage && (() => {
                          const hasPurch = shortages.some(s => s.default_order_type === 'Purchase order' || !s.default_order_type)
                          const hasProd  = shortages.some(s => s.default_order_type === 'Production')
                          return (
                            <button onClick={() => setOpenShortage(isOpen ? null : shortageKey)}
                              title="לחץ לפירוט חוסרים"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, padding: 0 }}>
                              {hasProd && !hasPurch ? '🟣' : !hasProd && hasPurch ? '🔴' : '🟣🔴'}
                            </button>
                          )
                        })()}
                      </td>
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
                    {/* Shortage detail — split by type */}
                    {isOpen && (() => {
                      const purchItems = shortages.filter(s => s.default_order_type === 'Purchase order' || !s.default_order_type)
                      const prodItems  = shortages.filter(s => s.default_order_type === 'Production')
                      const CS = { padding:'4px 8px', whiteSpace:'nowrap', fontSize:11, textAlign:'right' }
                      return (
                        <tr key={shortageKey + '-shortage'}>
                          <td colSpan={cols.length} style={{ padding:'8px 12px', background:'#fefcf8', borderBottom:'0.5px solid var(--border-tbl)' }}>

                            {/* PRODUCTION shortages — purple */}
                            {prodItems.length > 0 && (
                              <div style={{ marginBottom: purchItems.length ? 12 : 0 }}>
                                <div style={{ fontSize:12, fontWeight:600, color:'#6B21A8', marginBottom:6 }}>🟣 חוסרי ייצור — הזמנה {r.doc}</div>
                                <table style={{ fontSize:11, width:'100%', borderCollapse:'collapse' }}>
                                  <thead><tr>
                                    {['מק"ט חסר','שם פריט','כמות חסרה','תאריך נדרש','פק"ע','סטטוס','שבוע','מאגר','מחסור בפק"ע'].map(h=>(
                                      <th key={h} style={{ ...CS, color:'var(--text-muted)', borderBottom:'0.5px solid var(--border-tbl)', fontWeight:600 }}>{h}</th>
                                    ))}
                                  </tr></thead>
                                  <tbody>
                                    {prodItems.map((s,si) => {
                                      const prods = prodByItem[s.item_number] || []
                                      const ap = prods.find(p=>!['Ended','Reported as finished'].includes(p.status)) || prods[0]
                                      return (
                                        <tr key={si} style={{ background: ap ? '#f3e8ff' : '#fbe9e7' }}>
                                          <td style={CS}>{s.item_number}</td>
                                          <td style={CS}>{s.product_name}</td>
                                          <td style={{ ...CS, fontWeight:600 }}>{Math.round(s.missing_qty)}</td>
                                          <td style={CS}>{s.requested_delivery_date||'—'}</td>
                                          <td style={CS}>{ap?.production||'—'}</td>
                                          <td style={CS}>{ap?.status||'—'}</td>
                                          <td style={CS}>{ap?.planning_priority===188||!ap?.planning_priority?'לא משובץ':`שבוע ${ap?.planning_priority}`}</td>
                                          <td style={CS}>{ap?.pool||'—'}</td>
                                          <td style={CS}>{ap?.shortage_exist==='Yes'?<span style={{color:'var(--red-dark)',fontWeight:600}}>⚠ כן</span>:<span style={{color:'var(--green-dark)'}}>לא</span>}</td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}

                            {/* PURCHASE shortages — red */}
                            {purchItems.length > 0 && (
                              <div>
                                <div style={{ fontSize:12, fontWeight:600, color:'var(--red-dark)', marginBottom:6 }}>🔴 חוסרי רכש — הזמנה {r.doc}</div>
                                <table style={{ fontSize:11, width:'100%', borderCollapse:'collapse' }}>
                                  <thead><tr>
                                    {['מק"ט','שם פריט','כמות חסרה','תאריך נדרש','הזמנת רכש','ספק','תאריך אספקה','סטטוס','הערה'].map(h=>(
                                      <th key={h} style={{ ...CS, color:'var(--text-muted)', borderBottom:'0.5px solid var(--border-tbl)', fontWeight:600 }}>{h}</th>
                                    ))}
                                  </tr></thead>
                                  <tbody>
                                    {purchItems.map((s,si) => {
                                      const po = bestPO(s.item_number)
                                      const eta = po?(po.confirmed_receipt_date||po.requested_receipt_date||''):''
                                      const late = s.requested_delivery_date && eta && eta > s.requested_delivery_date
                                      return (
                                        <tr key={si} style={{ background: po?'#eaf3de':'#fbe9e7' }}>
                                          <td style={CS}>{s.item_number}</td>
                                          <td style={CS}>{s.product_name}</td>
                                          <td style={{ ...CS, fontWeight:600 }}>{Math.round(s.missing_qty)}</td>
                                          <td style={CS}>{s.requested_delivery_date||'—'}</td>
                                          <td style={CS}>{po?.purchase_order||'—'}</td>
                                          <td style={CS}>{po?.vendor_name||'—'}</td>
                                          <td style={CS}>{eta||'—'}</td>
                                          <td style={CS}>{po?(late?<span style={{color:'var(--red-dark)',fontWeight:600}}>איחור צפוי</span>:<span style={{color:'var(--green-dark)'}}>בזמן</span>):<span style={{color:'var(--red-dark)',fontWeight:600}}>אין הזמנת רכש</span>}</td>
                                          <td style={{ ...CS, minWidth:160 }}>
                                            {editingNote===s.item_number?(
                                              <div style={{display:'flex',gap:4}}>
                                                <input defaultValue={notes[s.item_number]?.note_procurement||''} id={`note-${s.item_number}`} style={{height:26,fontSize:11,flex:1}} autoFocus />
                                                <button onClick={()=>saveNote(s.item_number,document.getElementById(`note-${s.item_number}`).value)} disabled={saving} style={{fontSize:11,padding:'2px 8px',background:'var(--blue-dark)',color:'#fff',border:'none',borderRadius:4,cursor:'pointer'}}>{saving?'...':'💾'}</button>
                                                <button onClick={()=>setEditingNote(null)} style={{fontSize:11,padding:'2px 6px',background:'none',border:'0.5px solid var(--border-tbl)',borderRadius:4,cursor:'pointer'}}>✕</button>
                                              </div>
                                            ):(
                                              <div style={{display:'flex',gap:6,alignItems:'center'}}>
                                                <span style={{fontSize:11,color:notes[s.item_number]?.note_procurement?'var(--text-main)':'var(--text-hint)'}}>{notes[s.item_number]?.note_procurement||'הוסף הערה...'}</span>
                                                <button onClick={()=>setEditingNote(s.item_number)} style={{fontSize:11,padding:'1px 6px',background:'none',border:'0.5px solid var(--border-tbl)',borderRadius:4,cursor:'pointer',color:'var(--text-muted)'}}>✏️</button>
                                              </div>
                                            )}
                                          </td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })()}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
