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
  ['open_sales_amount','שווי פתוח'], ['past_due','פיגור $'], ['sales_status','סטטוס'], ['note','הערה']
]

export default function BOView({ bo, allocation = [], purchaseOrders = [], procurementNotes = {}, production = [], salesOrders = [], dr4 = [], dr5 = [] }) {
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
              <CustomerGroup key={grp.customer} grp={grp} cols={DETAIL_COLS} allocation={allocation} purchaseOrders={purchaseOrders} procurementNotes={procurementNotes} production={production} dr4={dr4} dr5={dr5} salesOrders={salesOrders} />
            ))}
          </div>
        )
      })()}

    </div>
  )
}

function CustomerGroup({ grp, cols, allocation, purchaseOrders, procurementNotes, production, dr4, dr5, salesOrders = [] }) {
  const [open, setOpen] = useState(false)
  const [openShortage, setOpenShortage] = useState(null)
  const [notes, setNotes] = useState(procurementNotes)
  const [viewNote, setViewNote] = useState(null)

  // Lookup confirmed_ship_date from sales orders by sales_order number
  const soConfirmedDate = useMemo(() => {
    const m = {}
    salesOrders.forEach(o => { m[o.sales_order] = o.confirmed_ship_date })
    return m
  }, [salesOrders])

  function getShortages(doc) {
    return allocation.filter(a =>
      a.number === doc &&
      a.reference === 'Sales order' &&
      a.shortage_exist === 'Yes' &&
      a.missing_qty > 0
    )
  }

  // Sales order → production_number lookup
  const soProductionMap = useMemo(() => {
    const m = {}
    salesOrders.forEach(o => { m[o.sales_order] = o.production_number })
    return m
  }, [salesOrders])

  // Main production order lookup (quantity + status)
  const prodByNumber = useMemo(() => {
    const m = {}
    production.forEach(p => { m[p.production] = p })
    return m
  }, [production])

  // DR4/DR5 by PARENT production order
  const dr4ByParent = useMemo(() => {
    const m = {}
    dr4.forEach(d => {
      const k = d.parent_production_order
      if (!m[k]) m[k] = []
      m[k].push({ ...d, type: 'עב"ש' })
    })
    return m
  }, [dr4])

  const dr5ByParent = useMemo(() => {
    const m = {}
    dr5.forEach(d => {
      const k = d.parent_production_order
      if (!m[k]) m[k] = []
      m[k].push({ ...d, type: 'צבע' })
    })
    return m
  }, [dr5])

  // Allocation by number (for sub-production shortages)
  const allocByNumber = useMemo(() => {
    const m = {}
    allocation.forEach(a => {
      if (!m[a.number]) m[a.number] = []
      m[a.number].push(a)
    })
    return m
  }, [allocation])

  function bestPO(itemNumber) {
    const candidates = purchaseOrders.filter(p =>
      p.item_number === String(itemNumber) &&
      p.deliver_remainder > 0
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
                            : k === 'note'
                            ? (r.note
                                ? <span title={r.note} style={{ display: 'inline-block', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>{r.note}</span>
                                : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>אין הערה</span>)
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

                            {/* PRODUCTION shortages — deep chain */}
                            {prodItems.length > 0 && (() => {
                              const DONE = ['Ended','Reported as finished']
                              const mainPrd = soProductionMap[r.doc]
                              const mainRec = prodByNumber[mainPrd]
                              // DR4 + DR5 sub-orders for the main production order (all active, incl. blocking with no material shortage)
                              const subOrders = [
                                ...(dr4ByParent[mainPrd] || []).filter(d=>!DONE.includes(d.status)),
                                ...(dr5ByParent[mainPrd] || []).filter(d=>!DONE.includes(d.status))
                              ]
                              return (
                                <div style={{ marginBottom: purchItems.length ? 12 : 0 }}>
                                  <div style={{ fontSize:12, fontWeight:600, color:'#6B21A8', marginBottom:4 }}>
                                    🟣 חוסרי ייצור — הזמנה {r.doc} · פק"ע ראשית: {mainPrd||'—'}{mainRec ? ` · כמות להרכבה: ${Math.round(mainRec.quantity||0)} · סטטוס: ${mainRec.status||''}` : ''}
                                  </div>
                                  {subOrders.length === 0 ? (
                                    <div style={{fontSize:11,color:'#888',padding:'4px 8px'}}>
                                      אין תת-פק"עות פעילות (עב"ש/צבע) — ההרכבה ממתינה לחומרים ישירים
                                    </div>
                                  ) : subOrders.map((sub, si) => {
                                    const subAlloc = (allocByNumber[sub.production_order] || []).filter(a=>a.missing_qty>0)
                                    return (
                                      <div key={si} style={{marginBottom:8,padding:'6px 8px',background: sub.type==='עב"ש'?'#fef3c7':'#ede9fe',borderRadius:6,border:`0.5px solid ${sub.type==='עב"ש'?'#d97706':'#7c3aed'}`}}>
                                        <div style={{fontSize:11,fontWeight:600,marginBottom:6,color:sub.type==='עב"ש'?'#92400e':'#6B21A8'}}>
                                          {sub.type==='עב"ש'?'🔧 עב"ש':'🎨 צבע'} — פק"ע: {sub.production_order} · {sub.item_number} · כמות: {Math.round(sub.quantity||0)}{sub.quantity_for_parent_po?` (לאב: ${Math.round(sub.quantity_for_parent_po)})`:''} · סטטוס: {sub.status}
                                        </div>
                                        {subAlloc.length === 0 ? (
                                          <div style={{fontSize:10,color:'#4b5563'}}>✔ אין חוסר חומרים לתת-פק"ע זו — בתהליך/ממתינה (מעכבת את ההרכבה)</div>
                                        ) : (
                                          <table style={{fontSize:10,width:'100%',borderCollapse:'collapse'}}>
                                            <thead><tr>
                                              {['מק"ט','שם פריט','כמות חסרה','הזמנת רכש','ספק','תאריך אספקה','סטטוס'].map(h=>(
                                                <th key={h} style={{...CS,fontSize:10,color:'#666',borderBottom:'0.5px solid #ddd',fontWeight:600}}>{h}</th>
                                              ))}
                                            </tr></thead>
                                            <tbody>
                                              {subAlloc.map((a,ai) => {
                                                const po = bestPO(a.item_number)
                                                const eta = po?(po.confirmed_receipt_date||po.requested_receipt_date||''):''
                                                const needDate = soConfirmedDate[r.doc] || ''
                                                const late = needDate && eta && eta > needDate
                                                return (
                                                  <tr key={ai} style={{background:po?'#eaf3de':'#fbe9e7'}}>
                                                    <td style={{...CS,fontSize:10}}>{a.item_number}</td>
                                                    <td style={{...CS,fontSize:10}}>{a.product_name}</td>
                                                    <td style={{...CS,fontSize:10,fontWeight:600}}>{Math.round(a.missing_qty)}</td>
                                                    <td style={{...CS,fontSize:10}}>{po?.purchase_order||'—'}</td>
                                                    <td style={{...CS,fontSize:10}}>{po?.vendor_name||'—'}</td>
                                                    <td style={{...CS,fontSize:10}}>{eta||'—'}</td>
                                                    <td style={{...CS,fontSize:10}}>
                                                      {po?(late
                                                        ?<span style={{color:'var(--red-dark)',fontWeight:600}}>איחור צפוי</span>
                                                        :<span style={{color:'var(--green-dark)'}}>בזמן</span>)
                                                        :<span style={{color:'var(--red-dark)',fontWeight:600}}>אין הזמנת רכש</span>}
                                                    </td>
                                                  </tr>
                                                )
                                              })}
                                            </tbody>
                                          </table>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              )
                            })()}

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
                                      const needDate = soConfirmedDate[r.doc] || s.requested_delivery_date || ''
                                      const late = needDate && eta && eta > needDate
                                      return (
                                        <tr key={si} style={{ background: po?'#eaf3de':'#fbe9e7' }}>
                                          <td style={CS}>{s.item_number}</td>
                                          <td style={CS}>{s.product_name}</td>
                                          <td style={{ ...CS, fontWeight:600 }}>{Math.round(s.missing_qty)}</td>
                                          <td style={CS}>{soConfirmedDate[r.doc] || s.requested_delivery_date||'—'}</td>
                                          <td style={CS}>{po?.purchase_order||'—'}</td>
                                          <td style={CS}>{po?.vendor_name||'—'}</td>
                                          <td style={CS}>{eta||'—'}</td>
                                          <td style={CS}>{po?(late?<span style={{color:'var(--red-dark)',fontWeight:600}}>איחור צפוי</span>:<span style={{color:'var(--green-dark)'}}>בזמן</span>):<span style={{color:'var(--red-dark)',fontWeight:600}}>אין הזמנת רכש</span>}</td>
                                          <td style={CS}>
                                            <div style={{display:'flex',gap:6,alignItems:'center'}}>
                                              {notes[s.item_number]?.note_procurement && (
                                                <span style={{fontSize:10,color:'#888',maxWidth:100,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                                                  {notes[s.item_number].note_procurement}
                                                </span>
                                              )}
                                              <button onClick={()=>setViewNote({itemNumber:s.item_number,noteRksh:notes[s.item_number]?.note_procurement||'',noteTapi:notes[s.item_number]?.note_tapi||''})}
                                                title='הצג הערה' style={{fontSize:14,padding:'1px 4px',background:'none',border:'none',cursor:'pointer',color:'#888'}}>🖊️</button>
                                            </div>
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

      {/* Note view modal */}
      {viewNote && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center'}}
          onClick={()=>setViewNote(null)}>
          <div onClick={e=>e.stopPropagation()}
            style={{background:'#fff',borderRadius:12,padding:'1.5rem 1.75rem',minWidth:360,maxWidth:520,boxShadow:'0 8px 32px rgba(0,0,0,0.18)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
              <div style={{fontWeight:600,fontSize:15}}>הערות פריט</div>
              <div style={{fontSize:11,color:'#888'}}>מק"ט: {viewNote.itemNumber}</div>
            </div>

            {/* הערת רכש */}
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:600,color:'#185FA5',marginBottom:4}}>הערת רכש</div>
              <div style={{background:'#f0f6ff',borderRadius:8,padding:'10px 12px',fontSize:13,lineHeight:1.7,minHeight:44,
                color:viewNote.noteRksh?'var(--text-main)':'#aaa'}}>
                {viewNote.noteRksh || 'אין הערת רכש לפריט זה'}
              </div>
            </div>

            {/* הערת תפ"י */}
            <div style={{marginBottom:16}}>
              <div style={{fontSize:11,fontWeight:600,color:'#6B21A8',marginBottom:4}}>הערת תפ"י</div>
              <div style={{background:'#f5f0ff',borderRadius:8,padding:'10px 12px',fontSize:13,lineHeight:1.7,minHeight:44,
                color:viewNote.noteTapi?'var(--text-main)':'#aaa'}}>
                {viewNote.noteTapi || 'אין הערת תפ"י לפריט זה'}
              </div>
            </div>

            <div style={{textAlign:'left'}}>
              <button onClick={()=>setViewNote(null)}
                style={{padding:'8px 20px',borderRadius:8,background:'var(--blue-dark)',color:'#fff',border:'none',cursor:'pointer',fontWeight:600,fontSize:13}}>
                סגור
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
