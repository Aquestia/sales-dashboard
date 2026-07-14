import { useState, useMemo } from 'react'
import { fmt, isInternal } from '../utils/helpers'
import { unmarkUrgentLine, unmarkUrgentOrder } from '../utils/db'

const uKey = (so, ln) => `${String(so)}|${String(ln ?? '')}`

const DETAIL_COLS = [
  ['sales_order','הזמנה'], ['line_number','שורה'], ['item_number','מק"ט'], ['item_group','קב. פריט'],
  ['status','סטטוס'], ['confirmed_ship_date','תאריך אספקה'], ['remaining_amount','סכום $']
]

export default function UrgentView({ urgent = [], salesOrders = [], allocation = [], purchaseOrders = [], procurementNotes = {}, production = [], dr4 = [], dr5 = [], onUrgentChange }) {
  const [filter, setFilter] = useState('all') // all | internal | external

  const orderIndex = useMemo(() => {
    const m = {}
    salesOrders.forEach(o => { m[uKey(o.sales_order, o.line_number)] = o })
    return m
  }, [salesOrders])

  const rows = useMemo(() => urgent.map(u => {
    const full = orderIndex[uKey(u.sales_order, u.line_number)] || null
    return {
      sales_order: u.sales_order,
      line_number: u.line_number,
      customer_account: u.customer_account,
      customer_name: full?.customer_name || u.customer_name || u.customer_account || '—',
      is_internal: (u.is_internal ?? isInternal(u.customer_account)),
      item_number: full?.item_number || '',
      item_group: full?.item_group || '',
      status: full?.status || '',
      confirmed_ship_date: full?.confirmed_ship_date || '',
      remaining_amount: full?.remaining_amount || 0,
      production_number: full?.production_number || '',
      inFile: !!full,
    }
  }), [urgent, orderIndex])

  const totalAmt = rows.reduce((s, r) => s + (r.remaining_amount || 0), 0)
  const internalRows = rows.filter(r => r.is_internal)
  const externalRows = rows.filter(r => !r.is_internal)
  const customersCount = new Set(rows.map(r => r.customer_account)).size

  const shownRows = filter === 'internal' ? internalRows : filter === 'external' ? externalRows : rows

  const custGroups = useMemo(() => {
    const m = {}
    shownRows.forEach(r => {
      const k = r.customer_name || '—'
      if (!m[k]) m[k] = { customer: k, account: r.customer_account, is_internal: r.is_internal, amount: 0, rows: [] }
      m[k].amount += r.remaining_amount || 0
      m[k].rows.push(r)
    })
    return Object.values(m).sort((a, b) => b.amount - a.amount)
  }, [shownRows])

  return (
    <div>
      <div className="page-heading">🔥 הזמנות דחופות למעקב</div>

      {/* KPIs — clickable filters */}
      <div className="kpi-row" style={{ marginBottom: '1.25rem' }}>
        <button onClick={() => setFilter('all')} className={'kpi-card' + (filter === 'all' ? ' active' : '')}
          style={{ borderTop: '3px solid #e8863c' }}>
          <div className="kpi-label">סה"כ דחופות</div>
          <div className="kpi-value" style={{ color: '#c2410c' }}>${fmt(totalAmt)}</div>
          <div className="kpi-sub">{rows.length} שורות · {customersCount} לקוחות</div>
        </button>
        <button onClick={() => setFilter(filter === 'internal' ? 'all' : 'internal')} className={'kpi-card' + (filter === 'internal' ? ' active' : '')}
          style={{ borderTop: '3px solid #185FA5' }}>
          <div className="kpi-label">לקוחות פנימיים</div>
          <div className="kpi-value">${fmt(internalRows.reduce((s, r) => s + (r.remaining_amount || 0), 0))}</div>
          <div className="kpi-sub">{internalRows.length} שורות</div>
        </button>
        <button onClick={() => setFilter(filter === 'external' ? 'all' : 'external')} className={'kpi-card' + (filter === 'external' ? ' active' : '')}
          style={{ borderTop: '3px solid #2D7D46' }}>
          <div className="kpi-label">לקוחות חיצוניים</div>
          <div className="kpi-value">${fmt(externalRows.reduce((s, r) => s + (r.remaining_amount || 0), 0))}</div>
          <div className="kpi-sub">{externalRows.length} שורות</div>
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="section-box" style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔥</div>
          <div style={{ fontSize: 14 }}>עדיין לא סומנו הזמנות דחופות.</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>עבור ל"כרטיס לקוח", בחר לקוח וסמן שורות או הזמנות שלמות כדחופות.</div>
        </div>
      ) : (
        <div className="section-box">
          <div className="section-title">
            {filter === 'internal' ? 'פנימיים' : filter === 'external' ? 'חיצוניים' : 'כל הלקוחות'} — {shownRows.length} שורות · ${fmt(shownRows.reduce((s, r) => s + (r.remaining_amount || 0), 0))}
          </div>
          {custGroups.map(grp => (
            <UrgentCustomerGroup key={grp.customer} grp={grp}
              allocation={allocation} purchaseOrders={purchaseOrders} procurementNotes={procurementNotes}
              production={production} dr4={dr4} dr5={dr5} salesOrders={salesOrders} onUrgentChange={onUrgentChange} />
          ))}
        </div>
      )}
    </div>
  )
}

function UrgentCustomerGroup({ grp, allocation, purchaseOrders, procurementNotes, production, dr4, dr5, salesOrders = [], onUrgentChange }) {
  const [open, setOpen] = useState(false)
  const [openShortage, setOpenShortage] = useState(null)
  const [viewNote, setViewNote] = useState(null)
  const [busy, setBusy] = useState(false)

  const soConfirmedDate = useMemo(() => {
    const m = {}
    salesOrders.forEach(o => { m[o.sales_order] = o.confirmed_ship_date })
    return m
  }, [salesOrders])

  const dr4ByParent = useMemo(() => {
    const m = {}
    dr4.forEach(d => { const k = d.parent_production_order; if (!m[k]) m[k] = []; m[k].push({ ...d, type: 'עב"ש' }) })
    return m
  }, [dr4])

  const dr5ByParent = useMemo(() => {
    const m = {}
    dr5.forEach(d => { const k = d.parent_production_order; if (!m[k]) m[k] = []; m[k].push({ ...d, type: 'צבע' }) })
    return m
  }, [dr5])

  const allocByNumber = useMemo(() => {
    const m = {}
    allocation.forEach(a => { if (!m[a.number]) m[a.number] = []; m[a.number].push(a) })
    return m
  }, [allocation])

  function getShortages(doc) {
    return allocation.filter(a =>
      a.number === doc && a.reference === 'Sales order' && a.shortage_exist === 'Yes' && a.missing_qty > 0)
  }

  function bestPO(itemNumber) {
    const candidates = purchaseOrders.filter(p =>
      p.item_number === String(itemNumber) && p.deliver_remainder > 0 && p.document_status !== 'Invoice')
    return candidates.sort((a, b) => {
      const da = a.confirmed_receipt_date || a.requested_receipt_date || '9999'
      const db = b.confirmed_receipt_date || b.requested_receipt_date || '9999'
      return da.localeCompare(db)
    })[0] || null
  }

  async function removeLine(r) {
    if (busy) return
    setBusy(true)
    try {
      await unmarkUrgentLine(r.sales_order, r.line_number)
      onUrgentChange && await onUrgentChange()
    } finally { setBusy(false) }
  }

  const CS = { padding: '4px 8px', whiteSpace: 'nowrap', fontSize: 11, textAlign: 'right' }

  return (
    <div style={{ borderBottom: '0.5px solid var(--border-tbl)' }}>
      {/* Customer summary row */}
      <button onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 12px', background: open ? 'var(--blue-bg)' : 'var(--bg-row)',
          border: 'none', cursor: 'pointer', textAlign: 'right', gap: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: open ? 'var(--blue-dark)' : 'var(--text-main)', flex: 1 }}>
          {open ? '▾' : '▸'} {grp.customer}
          <span style={{ fontSize: 10, fontWeight: 500, marginRight: 8, padding: '1px 7px', borderRadius: 10,
            background: grp.is_internal ? '#e5effb' : '#e6f4ea', color: grp.is_internal ? '#185FA5' : '#2D7D46' }}>
            {grp.is_internal ? 'פנימי' : 'חיצוני'}
          </span>
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 16 }}>{grp.rows.length} שורות</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#c2410c', minWidth: 90, textAlign: 'left' }}>${fmt(grp.amount)}</span>
      </button>

      {/* Expanded order rows */}
      {open && (
        <div style={{ overflowX: 'auto', background: 'var(--bg-card)', padding: '0 0 8px 0' }}>
          <table style={{ fontSize: 12, width: '100%' }}>
            <thead>
              <tr>
                <th style={{ padding: '6px 8px', color: 'var(--text-muted)', borderBottom: '0.5px solid var(--border-tbl)', whiteSpace: 'nowrap' }}>חוסר</th>
                {DETAIL_COLS.map(([k, l]) => (
                  <th key={k} style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-muted)', borderBottom: '0.5px solid var(--border-tbl)', whiteSpace: 'nowrap' }}>{l}</th>
                ))}
                <th style={{ padding: '6px 8px', color: 'var(--text-muted)', borderBottom: '0.5px solid var(--border-tbl)', whiteSpace: 'nowrap' }}>פעולה</th>
              </tr>
            </thead>
            <tbody>
              {grp.rows.map((r, i) => {
                const shortages = getShortages(r.sales_order)
                const hasShortage = shortages.length > 0
                const shortageKey = uKey(r.sales_order, r.line_number)
                const isOpen = openShortage === shortageKey
                return (
                  <>
                    <tr key={i} style={{ background: i % 2 === 0 ? 'var(--bg-row)' : 'var(--bg-card)' }}>
                      <td style={{ padding: '6px 8px', borderBottom: '0.5px solid var(--border-tbl)', whiteSpace: 'nowrap', textAlign: 'center' }}>
                        {hasShortage && (() => {
                          const hasPurch = shortages.some(s => s.default_order_type === 'Purchase order' || !s.default_order_type)
                          const hasProd = shortages.some(s => s.default_order_type === 'Production')
                          return (
                            <button onClick={() => setOpenShortage(isOpen ? null : shortageKey)} title="לחץ לפירוט חוסרים"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, padding: 0 }}>
                              {hasProd && !hasPurch ? '🟣' : !hasProd && hasPurch ? '🔴' : '🟣🔴'}
                            </button>
                          )
                        })()}
                      </td>
                      {DETAIL_COLS.map(([k]) => (
                        <td key={k} style={{ padding: '6px 8px', borderBottom: '0.5px solid var(--border-tbl)', whiteSpace: 'nowrap' }}>
                          {k === 'remaining_amount'
                            ? <span style={{ fontWeight: 500 }}>${fmt(r[k] || 0)}</span>
                            : (r[k] ?? '') || (k === 'item_number' && !r.inFile ? <span style={{ color: 'var(--text-muted)' }}>לא בקובץ הפעיל</span> : '')}
                        </td>
                      ))}
                      <td style={{ padding: '6px 8px', borderBottom: '0.5px solid var(--border-tbl)', whiteSpace: 'nowrap', textAlign: 'center' }}>
                        <button onClick={() => removeLine(r)} disabled={busy} title="הסר מהמעקב (החזר לרגיל)"
                          style={{ background: 'none', border: '0.5px solid #e2c6a6', borderRadius: 6, cursor: busy ? 'default' : 'pointer', fontSize: 11, padding: '2px 8px', color: '#9a5b1e' }}>
                          ✕ הסר
                        </button>
                      </td>
                    </tr>
                    {isOpen && (() => {
                      const purchItems = shortages.filter(s => s.default_order_type === 'Purchase order' || !s.default_order_type)
                      const prodItems = shortages.filter(s => s.default_order_type === 'Production')
                      return (
                        <tr key={shortageKey + '-shortage'}>
                          <td colSpan={DETAIL_COLS.length + 2} style={{ padding: '8px 12px', background: '#fefcf8', borderBottom: '0.5px solid var(--border-tbl)' }}>
                            {prodItems.length > 0 && (() => {
                              const DONE = ['Ended', 'Reported as finished']
                              const mainPrd = r.production_number
                              const subOrders = [
                                ...(dr4ByParent[mainPrd] || []).filter(d => !DONE.includes(d.status)),
                                ...(dr5ByParent[mainPrd] || []).filter(d => !DONE.includes(d.status))
                              ]
                              const subOrdersWithShortage = subOrders.filter(sub => (allocByNumber[sub.production_order] || []).filter(a => a.missing_qty > 0).length > 0)
                              return (
                                <div style={{ marginBottom: purchItems.length ? 12 : 0 }}>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: '#6B21A8', marginBottom: 4 }}>
                                    🟣 חוסרי ייצור — הזמנה {r.sales_order} · פק"ע ראשית: {mainPrd || '—'}
                                  </div>
                                  {subOrdersWithShortage.length === 0 ? (
                                    <div style={{ fontSize: 11, color: '#888', padding: '4px 8px' }}>אין תת-פק"עות עם חוסרים פעילים</div>
                                  ) : subOrdersWithShortage.map((sub, si) => {
                                    const subAlloc = (allocByNumber[sub.production_order] || []).filter(a => a.missing_qty > 0)
                                    return (
                                      <div key={si} style={{ marginBottom: 8, padding: '6px 8px', background: sub.type === 'עב"ש' ? '#fef3c7' : '#ede9fe', borderRadius: 6, border: `0.5px solid ${sub.type === 'עב"ש' ? '#d97706' : '#7c3aed'}` }}>
                                        <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: sub.type === 'עב"ש' ? '#92400e' : '#6B21A8' }}>
                                          {sub.type === 'עב"ש' ? '🔧 עב"ש' : '🎨 צבע'} — פק"ע: {sub.production_order} · {sub.item_number} · סטטוס: {sub.status}
                                        </div>
                                        <table style={{ fontSize: 10, width: '100%', borderCollapse: 'collapse' }}>
                                          <thead><tr>
                                            {['מק"ט', 'שם פריט', 'כמות חסרה', 'הזמנת רכש', 'ספק', 'תאריך אספקה', 'סטטוס'].map(h => (
                                              <th key={h} style={{ ...CS, fontSize: 10, color: '#666', borderBottom: '0.5px solid #ddd', fontWeight: 600 }}>{h}</th>
                                            ))}
                                          </tr></thead>
                                          <tbody>
                                            {subAlloc.map((a, ai) => {
                                              const po = bestPO(a.item_number)
                                              const eta = po ? (po.confirmed_receipt_date || po.requested_receipt_date || '') : ''
                                              const needDate = soConfirmedDate[r.sales_order] || ''
                                              const late = needDate && eta && eta > needDate
                                              return (
                                                <tr key={ai} style={{ background: po ? '#eaf3de' : '#fbe9e7' }}>
                                                  <td style={{ ...CS, fontSize: 10 }}>{a.item_number}</td>
                                                  <td style={{ ...CS, fontSize: 10 }}>{a.product_name}</td>
                                                  <td style={{ ...CS, fontSize: 10, fontWeight: 600 }}>{Math.round(a.missing_qty)}</td>
                                                  <td style={{ ...CS, fontSize: 10 }}>{po?.purchase_order || '—'}</td>
                                                  <td style={{ ...CS, fontSize: 10 }}>{po?.vendor_name || '—'}</td>
                                                  <td style={{ ...CS, fontSize: 10 }}>{eta || '—'}</td>
                                                  <td style={{ ...CS, fontSize: 10 }}>
                                                    {po ? (late ? <span style={{ color: 'var(--red-dark)', fontWeight: 600 }}>איחור צפוי</span> : <span style={{ color: 'var(--green-dark)' }}>בזמן</span>) : <span style={{ color: 'var(--red-dark)', fontWeight: 600 }}>אין הזמנת רכש</span>}
                                                  </td>
                                                </tr>
                                              )
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    )
                                  })}
                                </div>
                              )
                            })()}

                            {purchItems.length > 0 && (
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--red-dark)', marginBottom: 6 }}>🔴 חוסרי רכש — הזמנה {r.sales_order}</div>
                                <table style={{ fontSize: 11, width: '100%', borderCollapse: 'collapse' }}>
                                  <thead><tr>
                                    {['מק"ט', 'שם פריט', 'כמות חסרה', 'תאריך נדרש', 'הזמנת רכש', 'ספק', 'תאריך אספקה', 'סטטוס', 'הערה'].map(h => (
                                      <th key={h} style={{ ...CS, color: 'var(--text-muted)', borderBottom: '0.5px solid var(--border-tbl)', fontWeight: 600 }}>{h}</th>
                                    ))}
                                  </tr></thead>
                                  <tbody>
                                    {purchItems.map((s, si) => {
                                      const po = bestPO(s.item_number)
                                      const eta = po ? (po.confirmed_receipt_date || po.requested_receipt_date || '') : ''
                                      const needDate = soConfirmedDate[r.sales_order] || s.requested_delivery_date || ''
                                      const late = needDate && eta && eta > needDate
                                      return (
                                        <tr key={si} style={{ background: po ? '#eaf3de' : '#fbe9e7' }}>
                                          <td style={CS}>{s.item_number}</td>
                                          <td style={CS}>{s.product_name}</td>
                                          <td style={{ ...CS, fontWeight: 600 }}>{Math.round(s.missing_qty)}</td>
                                          <td style={CS}>{soConfirmedDate[r.sales_order] || s.requested_delivery_date || '—'}</td>
                                          <td style={CS}>{po?.purchase_order || '—'}</td>
                                          <td style={CS}>{po?.vendor_name || '—'}</td>
                                          <td style={CS}>{eta || '—'}</td>
                                          <td style={CS}>{po ? (late ? <span style={{ color: 'var(--red-dark)', fontWeight: 600 }}>איחור צפוי</span> : <span style={{ color: 'var(--green-dark)' }}>בזמן</span>) : <span style={{ color: 'var(--red-dark)', fontWeight: 600 }}>אין הזמנת רכש</span>}</td>
                                          <td style={CS}>
                                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                              {procurementNotes[s.item_number]?.note_procurement && (
                                                <span style={{ fontSize: 10, color: '#888', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                  {procurementNotes[s.item_number].note_procurement}
                                                </span>
                                              )}
                                              <button onClick={() => setViewNote({ itemNumber: s.item_number, noteRksh: procurementNotes[s.item_number]?.note_procurement || '', noteTapi: procurementNotes[s.item_number]?.note_tapi || '' })}
                                                title="הצג הערה" style={{ fontSize: 14, padding: '1px 4px', background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>🖊️</button>
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

      {viewNote && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setViewNote(null)}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 12, padding: '1.5rem 1.75rem', minWidth: 360, maxWidth: 520, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>הערות פריט</div>
              <div style={{ fontSize: 11, color: '#888' }}>מק"ט: {viewNote.itemNumber}</div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#185FA5', marginBottom: 4 }}>הערת רכש</div>
              <div style={{ background: '#f0f6ff', borderRadius: 8, padding: '10px 12px', fontSize: 13, lineHeight: 1.7, minHeight: 44, color: viewNote.noteRksh ? 'var(--text-main)' : '#aaa' }}>
                {viewNote.noteRksh || 'אין הערת רכש לפריט זה'}
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#6B21A8', marginBottom: 4 }}>הערת תפ"י</div>
              <div style={{ background: '#f5f0ff', borderRadius: 8, padding: '10px 12px', fontSize: 13, lineHeight: 1.7, minHeight: 44, color: viewNote.noteTapi ? 'var(--text-main)' : '#aaa' }}>
                {viewNote.noteTapi || 'אין הערת תפ"י לפריט זה'}
              </div>
            </div>
            <div style={{ textAlign: 'left' }}>
              <button onClick={() => setViewNote(null)}
                style={{ padding: '8px 20px', borderRadius: 8, background: 'var(--blue-dark)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                סגור
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
