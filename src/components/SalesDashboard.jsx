import { useState, useMemo, useEffect } from 'react'
import { fmt, marketSegment, MARKET_LABELS, MARKET_COLORS, MARKET_KEYS } from '../utils/helpers'
import { fetchSalesFiles, fetchSalesOrdersByFileId, fetchInvoicesDetail } from '../utils/db'

const ORDER_COLS = [
  ['sales_order','הזמנה'],
  ['line_number','שורה'],
  ['customer_account','לקוח'],
  ['customer_name','שם לקוח'],
  ['item_number','מק"ט'],
  ['item_group','קב. פריט'],
  ['production_number','פק"ע'],
  ['status','סטטוס'],
  ['mode_of_delivery','משלוח'],
  ['confirmed_ship_date','תאריך אספקה מאושר'],
  ['requested_ship_date','תאריך מבוקש'],
  ['ordered_quantity','כמות'],
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

export default function SalesDashboard() {
  const [files, setFiles] = useState([])
  const [selectedFileId, setSelectedFileId] = useState(null)
  const [orders, setOrders] = useState([])
  const [fileInvoices, setFileInvoices] = useState([])
  const [sortCol, setSortCol] = useState('confirmed_ship_date')
  const [sortDir, setSortDir] = useState('asc')
  const [loadingFile, setLoadingFile] = useState(true)

  useEffect(() => {
    fetchSalesFiles().then(fs => {
      setFiles(fs)
      if (fs.length > 0) {
        setSelectedFileId(fs[0].id)
      } else {
        setLoadingFile(false)
      }
    })
  }, [])

  useEffect(() => {
    if (!selectedFileId) return
    setLoadingFile(true)
    Promise.all([
      fetchSalesOrdersByFileId(selectedFileId),
      fetchInvoicesDetail(selectedFileId)
    ]).then(([rows, inv]) => {
      setOrders(rows)
      setFileInvoices(inv)
      setLoadingFile(false)
    })
  }, [selectedFileId])

  const [selected, setSelected] = useState(null) // { type: 'all'|'internal'|'external'|'month', key?, cat? }

  const dropOrders   = orders.filter(r => String(r.sale_type_code).trim() === '30')
  const consignment  = orders.filter(r => String(r.sale_type_code).trim() === '40')
  const india        = orders.filter(r => String(r.sale_type_code).trim() === '50')
  const excluded     = new Set(['30','40','50'])
  const netOrders    = orders.filter(r => !excluded.has(String(r.sale_type_code).trim()))
  const netTotal     = netOrders.reduce((s, r) => s + (r.remaining_amount || 0), 0)
  const netInternal  = netOrders.filter(r => r.cat === 'Internal').reduce((s, r) => s + (r.remaining_amount || 0), 0)
  const netExternal  = netOrders.filter(r => r.cat === 'External').reduce((s, r) => s + (r.remaining_amount || 0), 0)
  const dropAmt      = dropOrders.reduce((s, r) => s + (r.remaining_amount || 0), 0)
  const consAmt      = consignment.reduce((s, r) => s + (r.remaining_amount || 0), 0)
  const indiaAmt     = india.reduce((s, r) => s + (r.remaining_amount || 0), 0)
  const totalAll     = orders.reduce((s, r) => s + (r.remaining_amount || 0), 0)
  const totalInternal = orders.filter(r => r.cat === 'Internal').reduce((s, r) => s + (r.remaining_amount || 0), 0)
  const totalExternal = orders.filter(r => r.cat === 'External').reduce((s, r) => s + (r.remaining_amount || 0), 0)

  // פילוח שוק — שוק מקומי / נטפים / ייצוא (על כלל ההזמנות הפתוחות)
  const marketOrders = { local: [], netafim: [], export: [] }
  netOrders.forEach(r => { const seg = marketSegment(r.sale_type_code, r.customer_name); if (marketOrders[seg]) marketOrders[seg].push(r) })
  const marketAmt = k => marketOrders[k].reduce((s, r) => s + (r.remaining_amount || 0), 0)

  // Monthly breakdown — רק הזמנות נטו (ללא Drop/Consignment/India)
  const months = useMemo(() => {
    const m = {}
    netOrders.forEach(r => {
      const k = monthKey(r.confirmed_ship_date)
      if (!k) return
      if (!m[k]) m[k] = { key: k, all: 0, internal: 0, external: 0, rows: [] }
      m[k].all += r.remaining_amount || 0
      if (r.cat === 'Internal') m[k].internal += r.remaining_amount || 0
      else m[k].external += r.remaining_amount || 0
      m[k].rows.push(r)
    })
    return Object.values(m).sort((a, b) => a.key.localeCompare(b.key))
  }, [netOrders])

  const unconfirmed = useMemo(() => netOrders.filter(r => !r.confirmed_ship_date), [netOrders])
  const unconfirmedAmt = unconfirmed.reduce((s, r) => s + (r.remaining_amount || 0), 0)

  const detailRows = useMemo(() => {
    if (!selected) return []
    if (selected.type === 'all')          return orders
    if (selected.type === 'drop')         return dropOrders
    if (selected.type === 'consignment')  return consignment
    if (selected.type === 'india')        return india
    if (selected.type === 'market')       return orders.filter(r => marketSegment(r.sale_type_code, r.customer_name) === selected.key)
    if (selected.type === 'net')          return netOrders
    if (selected.type === 'net-internal') return netOrders.filter(r => r.cat === 'Internal')
    if (selected.type === 'net-external') return netOrders.filter(r => r.cat === 'External')
    if (selected.type === 'unconfirmed')  return unconfirmed
    if (selected.type === 'month') {
      const m = months.find(m => m.key === selected.key)
      if (!m) return []
      if (selected.cat === 'internal') return m.rows.filter(r => r.cat === 'Internal')
      if (selected.cat === 'external') return m.rows.filter(r => r.cat === 'External')
      return m.rows
    }
    return []
  }, [selected, orders, months, dropOrders, consignment, india, netOrders, unconfirmed])

  function toggle(type, key, cat) {
    const same = selected?.type === type && selected?.key === key && selected?.cat === cat
    setSelected(same ? null : { type, key, cat })
  }

  function isActive(type, key, cat) {
    return selected?.type === type && selected?.key === key && selected?.cat === cat
  }  return (
    <div>
      <h2 className="page-heading">דוח מכירות — הזמנות פתוחות</h2>

      {/* File selector */}
      {files.length > 0 && (
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:'1.25rem', flexWrap:'wrap' }}>
          <span style={{ fontSize:13, color:'var(--text-secondary)', whiteSpace:'nowrap' }}>קובץ פעיל:</span>
          {files.map(f => (
            <button key={f.id} onClick={() => setSelectedFileId(f.id)}
              style={{ padding:'6px 14px', borderRadius:'var(--radius)', fontSize:12,
                border:'0.5px solid '+(selectedFileId===f.id?'var(--blue-dark)':'var(--border-card)'),
                background:selectedFileId===f.id?'var(--blue-bg)':'var(--bg-row)',
                color:selectedFileId===f.id?'var(--blue-dark)':'var(--text-main)',
                cursor:'pointer', fontWeight:selectedFileId===f.id?600:400 }}>
              {f.batch_date} · {f.filename}
            </button>
          ))}
          {loadingFile && <span style={{ fontSize:12, color:'var(--text-muted)' }}>טוען...</span>}
        </div>
      )}

      {/* Row 1: Total + exclusions */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8 }}>
          📦 סקירת הזמנות פתוחות
        </div>
        <div className="kpi-row" style={{ marginBottom: 0 }}>
          <button onClick={() => toggle('all')} className={'kpi-card' + (isActive('all') ? ' active' : '')}
            style={{ borderTop: '3px solid #185FA5' }}>
            <div className="kpi-label">סה"כ הזמנות פתוחות</div>
            <div className="kpi-value" style={{ color:'#185FA5' }}>${fmt(totalAll)}</div>
            <div className="kpi-sub">{orders.length} שורות</div>
          </button>
          <button onClick={() => toggle('drop')} className={'kpi-card' + (isActive('drop') ? ' active' : '')}
            style={{ borderTop: '3px solid #9CA3AF' }}>
            <div className="kpi-label">Drop Order</div>
            <div className="kpi-value">${fmt(dropAmt)}</div>
            <div className="kpi-sub">{dropOrders.length} שורות</div>
          </button>
          <button onClick={() => toggle('consignment')} className={'kpi-card' + (isActive('consignment') ? ' active' : '')}
            style={{ borderTop: '3px solid #9CA3AF' }}>
            <div className="kpi-label">Consignment</div>
            <div className="kpi-value">${fmt(consAmt)}</div>
            <div className="kpi-sub">{consignment.length} שורות</div>
          </button>
          <button onClick={() => toggle('india')} className={'kpi-card' + (isActive('india') ? ' active' : '')}
            style={{ borderTop: '3px solid #9CA3AF' }}>
            <div className="kpi-label">Aquestia India</div>
            <div className="kpi-value">${fmt(indiaAmt)}</div>
            <div className="kpi-sub">{india.length} שורות</div>
          </button>
        </div>
      </div>

      {/* Row 2: Net */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8 }}>
          🎯 נטו (ללא Drop / Consignment / India)
        </div>
        <div className="kpi-row" style={{ marginBottom: 0 }}>
          <button onClick={() => toggle('net')} className={'kpi-card' + (isActive('net') ? ' active' : '')}
            style={{ borderTop: '3px solid #D97706' }}>
            <div className="kpi-label">סה"כ נטו</div>
            <div className="kpi-value" style={{ color:'#D97706' }}>${fmt(netTotal)}</div>
            <div className="kpi-sub">{netOrders.length} שורות</div>
          </button>
          <button onClick={() => toggle('net-internal')} className={'kpi-card' + (isActive('net-internal') ? ' active' : '')}
            style={{ borderTop: '3px solid #D97706' }}>
            <div className="kpi-label">לקוחות פנימיים</div>
            <div className="kpi-value">${fmt(netInternal)}</div>
            <div className="kpi-sub">{netOrders.filter(r=>r.cat==='Internal').length} שורות</div>
          </button>
          <button onClick={() => toggle('net-external')} className={'kpi-card' + (isActive('net-external') ? ' active' : '')}
            style={{ borderTop: '3px solid #D97706' }}>
            <div className="kpi-label">לקוחות חיצוניים</div>
            <div className="kpi-value">${fmt(netExternal)}</div>
            <div className="kpi-sub">{netOrders.filter(r=>r.cat==='External').length} שורות</div>
          </button>
        </div>
      </div>

      {/* Row 2b: פילוח שוק */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8 }}>
          🌍 פילוח לפי שוק (נטו — ללא Drop / Consignment / India)
        </div>
        <div className="kpi-row" style={{ marginBottom: 0 }}>
          {MARKET_KEYS.map(k => (
            <button key={k} onClick={() => toggle('market', k)} className={'kpi-card' + (isActive('market', k) ? ' active' : '')}
              style={{ borderTop: '3px solid ' + MARKET_COLORS[k] }}>
              <div className="kpi-label">{MARKET_LABELS[k]}</div>
              <div className="kpi-value" style={{ color: MARKET_COLORS[k] }}>${fmt(marketAmt(k))}</div>
              <div className="kpi-sub">{marketOrders[k].length} שורות</div>
            </button>
          ))}
        </div>
      </div>

      {/* Row 3: Invoices */}
      {fileInvoices.length > 0 && (() => {
        const invTotal    = fileInvoices.reduce((s, r) => s + (r.invoice_amount || 0), 0)
        const invInternal = fileInvoices.filter(r => r.cat === 'Internal').reduce((s, r) => s + (r.invoice_amount || 0), 0)
        const invExternal = fileInvoices.filter(r => r.cat === 'External').reduce((s, r) => s + (r.invoice_amount || 0), 0)
        const invMarket = { local: [], netafim: [], export: [] }
        fileInvoices.forEach(r => { const seg = marketSegment(r.sale_type_code, r.name); if (invMarket[seg]) invMarket[seg].push(r) })
        const invMarketAmt = k => invMarket[k].reduce((s, r) => s + (r.invoice_amount || 0), 0)
        return (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8 }}>
              🧾 חשבוניות
            </div>
            <div className="kpi-row" style={{ marginBottom: 0 }}>
              <div className="kpi-card" style={{ cursor:'default', borderTop:'3px solid #2D7D46' }}>
                <div className="kpi-label">סה"כ חשבוניות</div>
                <div className="kpi-value" style={{ color:'#2D7D46' }}>${fmt(invTotal)}</div>
                <div className="kpi-sub">{fileInvoices.length} חשבוניות</div>
              </div>
              <div className="kpi-card" style={{ cursor:'default', borderTop:'3px solid #2D7D46' }}>
                <div className="kpi-label">לקוחות פנימיים</div>
                <div className="kpi-value">${fmt(invInternal)}</div>
                <div className="kpi-sub">{fileInvoices.filter(r=>r.cat==='Internal').length} חשבוניות</div>
              </div>
              <div className="kpi-card" style={{ cursor:'default', borderTop:'3px solid #2D7D46' }}>
                <div className="kpi-label">לקוחות חיצוניים</div>
                <div className="kpi-value">${fmt(invExternal)}</div>
                <div className="kpi-sub">{fileInvoices.filter(r=>r.cat==='External').length} חשבוניות</div>
              </div>
            </div>
            <div className="kpi-row" style={{ marginTop: 8, marginBottom: 0 }}>
              {MARKET_KEYS.map(k => (
                <div key={k} className="kpi-card" style={{ cursor:'default', borderTop:'3px solid '+MARKET_COLORS[k] }}>
                  <div className="kpi-label">{MARKET_LABELS[k]}</div>
                  <div className="kpi-value" style={{ color: MARKET_COLORS[k] }}>${fmt(invMarketAmt(k))}</div>
                  <div className="kpi-sub">{invMarket[k].length} חשבוניות</div>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Monthly table */}
      <div className="section-box" style={{ marginBottom: '1.5rem' }}>
        <div className="section-title">תאריך אספקה מאושר — לפי חודש</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['חודש','סה"כ','פנימיים','חיצוניים','שורות'].map(h => (
                  <th key={h} style={{ textAlign: 'center', padding: '8px 10px', color: 'var(--text-secondary)', borderBottom: '0.5px solid var(--border)', whiteSpace: 'nowrap', fontWeight:600 }}>{h}</th>
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
                  <td style={{ padding: '8px 10px', borderBottom: '0.5px solid var(--border)' }}>
                    <button onClick={e => { e.stopPropagation(); toggle('month', m.key, undefined) }}
                      style={{ background: isActive('month', m.key, undefined) ? 'var(--bg-accent)' : 'transparent',
                        border: 'none', cursor: 'pointer', fontWeight: 500, padding: '2px 6px', borderRadius: 4 }}>
                      ${fmt(m.all)}
                    </button>
                  </td>
                  <td style={{ padding: '8px 10px', borderBottom: '0.5px solid var(--border)' }}>
                    <button onClick={e => { e.stopPropagation(); toggle('month', m.key, 'internal') }}
                      style={{ background: isActive('month', m.key, 'internal') ? 'var(--bg-accent)' : 'transparent',
                        border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 4 }}>
                      ${fmt(m.internal)}
                    </button>
                  </td>
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
              {/* Unconfirmed row */}
              {unconfirmed.length > 0 && (
                <tr style={{ cursor: 'pointer', background: '#fffbeb' }}
                  onClick={() => toggle('unconfirmed')}>
                  <td style={{ padding: '8px 10px', borderBottom: '0.5px solid var(--border)', fontWeight: 500, color: '#92650a' }}>
                    טרם אושר
                  </td>
                  <td style={{ padding: '8px 10px', borderBottom: '0.5px solid var(--border)' }}>
                    <button onClick={e => { e.stopPropagation(); toggle('unconfirmed') }}
                      style={{ background: isActive('unconfirmed') ? 'var(--bg-accent)' : 'transparent',
                        border: 'none', cursor: 'pointer', fontWeight: 500, padding: '2px 6px', borderRadius: 4, color: '#92650a' }}>
                      ${fmt(unconfirmedAmt)}
                    </button>
                  </td>
                  <td style={{ padding: '8px 10px', borderBottom: '0.5px solid var(--border)', color: 'var(--text-muted)' }}>—</td>
                  <td style={{ padding: '8px 10px', borderBottom: '0.5px solid var(--border)', color: 'var(--text-muted)' }}>—</td>
                  <td style={{ padding: '8px 10px', borderBottom: '0.5px solid var(--border)', color: 'var(--text-muted)' }}>
                    {unconfirmed.length}
                  </td>
                </tr>
              )}
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
                : selected.type === 'market' ? MARKET_LABELS[selected.key]
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
                    <th key={k}
                      onClick={() => { if (sortCol===k) setSortDir(d=>d==='asc'?'desc':'asc'); else { setSortCol(k); setSortDir('asc') } }}
                      style={{ textAlign:'right', padding:'6px 8px', color:'var(--text-secondary)',
                        borderBottom:'0.5px solid var(--border)', whiteSpace:'nowrap',
                        cursor:'pointer', userSelect:'none',
                        background: sortCol===k ? 'var(--blue-bg)' : 'transparent' }}>
                      {l} {sortCol===k ? (sortDir==='asc'?'↑':'↓') : <span style={{opacity:0.3}}>↕</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...detailRows].sort((a,b) => {
                  const av=a[sortCol]??'', bv=b[sortCol]??''
                  const isNum = !isNaN(parseFloat(av)) && av!==''
                  const cmp = isNum ? parseFloat(av)-parseFloat(bv) : String(av).localeCompare(String(bv),'he')
                  return sortDir==='asc' ? cmp : -cmp
                }).map((r, i) => (
                  <tr key={i} style={{ background: i%2===0?'var(--surface-1)':'var(--surface-2)' }}>
                    {ORDER_COLS.map(([k]) => (
                      <td key={k} style={{ padding:'6px 8px', borderBottom:'0.5px solid var(--border)', whiteSpace:'nowrap' }}>
                        {k==='remaining_amount' ? '$'+fmt(r[k]||0)
                          : k==='production_number' ? (r[k]||'—')
                          : (r[k]??'')}
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
