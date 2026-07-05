import { useState, useEffect, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { fetchSalesFiles, fetchSalesOrdersByFileId } from '../utils/db'
import { classifyOrder, buildLookups } from '../utils/classify'
import { fmt } from '../utils/helpers'

const MONTHS_HE = ['ינו','פבר','מרץ','אפר','מאי','יונ','יול','אוג','ספט','אוק','נוב','דצמ']
function monthKey(d) { if (!d) return null; return String(d).slice(0,7) }
function monthLabel(k) { if (!k) return ''; const [y,m]=k.split('-'); return `${MONTHS_HE[parseInt(m)-1]} ${y}` }

const STATUS_ORDER = [
  'ארוז','באריזה','סיים ייצור','מלאי תוצ"ג','חלקי חילוף',
  'בהרכבת הרכבת מתכת','בהרכבת הרכבת פלסטיק','בהרכבת הרכבת נווטים',
  'בהרכבת מפעלון','בהרכבת מדי מים','בהרכבה','עב"ש','צבע','בליקוט','מתוזמן'
]
const shortStatus = s => s.replace('בהרכבת הרכבת ','הרכבת ').replace('בהרכבת ','הרכבת ')

// statuses that have no production order
const NO_PROD_STATUSES = ['מלאי תוצ"ג', 'חלקי חילוף']

const EXCLUDED_SALE_TYPES = new Set(['30', '40', '50'])

function buildMonthData(orders, production, dr4, dr5) {
  const { productionMap, dr4ByParent, dr5ByParent } = buildLookups(production, dr4, dr5)
  const byMonth = {}
  // Exclude DROP ORDER (30), CONSIGNMENT (40), AQUESTIA INDIA (50)
  const filtered = orders.filter(o => !EXCLUDED_SALE_TYPES.has(String(o.sale_type_code || '').trim()))
  filtered.forEach(o => {
    const mk = monthKey(o.confirmed_ship_date)
    if (!mk) return
    const st = classifyOrder(o, productionMap, dr4ByParent, dr5ByParent)
    const ie = o.cat === 'Internal' ? 'I' : 'E'
    if (!byMonth[mk]) byMonth[mk] = {}
    if (!byMonth[mk][st]) byMonth[mk][st] = {
      I:{cnt:0,amt:0,rows:[]}, E:{cnt:0,amt:0,rows:[]}
    }
    byMonth[mk][st][ie].cnt += 1
    byMonth[mk][st][ie].amt += o.remaining_amount || 0
    byMonth[mk][st][ie].rows.push(o)
  })
  return { byMonth, productionMap }
}

// ── Production columns
const PROD_COLS = [
  ['production','פק"ע'],['reference_number','הזמנה'],['customer_name','לקוח'],
  ['item_number','מק"ט'],['name','תיאור'],['quantity','כמות'],['status','סטטוס'],
  ['planning_priority','שבוע'],['pool','מאגר'],['shortage_exist','מחסור'],
  ['components_in_station','חומרים בתחנה'],['start_date','תאריך התחלה']
]
// ── Sales order columns
const SO_COLS = [
  ['sales_order','הזמנה'],['line_number','שורה'],['customer_account','לקוח'],
  ['customer_name','שם לקוח'],['item_number','מק"ט'],['item_group','קבוצה'],
  ['status','סטטוס'],['mode_of_delivery','משלוח'],['confirmed_ship_date','ת. אספקה'],
  ['ordered_quantity','כמות'],['deliver_remainder','יתרה'],['remaining_amount','סכום $']
]

function exportToExcel(rows, cols, filename) {
  const data = rows.map(r => {
    const obj = {}
    cols.forEach(([k,l]) => { obj[l] = r[k] ?? '' })
    return obj
  })
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'נתונים')
  XLSX.writeFile(wb, filename + '.xlsx')
}

function DetailPanel({ status, monthKey: mk, rows, productionMap, fileLabel, onClose }) {
  const hasProd = !NO_PROD_STATUSES.includes(status)
  const cols = hasProd ? PROD_COLS : SO_COLS

  // Build display rows
  const displayRows = hasProd
    ? rows.map(o => productionMap[o.production_number]).filter(Boolean)
    : rows

  const uniqueRows = hasProd
    ? [...new Map(displayRows.map(p => [p.production, p])).values()]
    : displayRows

  const CS = { padding:'5px 8px', fontSize:11, borderBottom:'0.5px solid #e8e8e2', whiteSpace:'nowrap', textAlign:'right' }

  return (
    <div style={{ border:'0.5px solid var(--border-card)', borderRadius:10, padding:'1rem 1.2rem', marginTop:16, background:'#fff' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <div>
          <span style={{ fontWeight:600, fontSize:14 }}>{shortStatus(status)} · {monthLabel(mk)}</span>
          <span style={{ fontSize:12, color:'var(--text-muted)', marginRight:10 }}>
            {fileLabel} · {uniqueRows.length} שורות
          </span>
          <span style={{ fontSize:11, color:'var(--text-muted)' }}>
            ({hasProd ? 'נתוני פק"עות מ-Production' : 'נתוני הזמנות מ-Sales Orders'})
          </span>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => exportToExcel(uniqueRows, cols, `${shortStatus(status)}_${mk}`)}
            style={{ padding:'6px 14px', borderRadius:'var(--radius)', border:'0.5px solid var(--border-card)',
              background:'#f0f8ec', color:'#2a7a1a', fontWeight:600, fontSize:12, cursor:'pointer' }}>
            ⬇ ייצוא Excel
          </button>
          <button onClick={onClose}
            style={{ padding:'6px 10px', borderRadius:'var(--radius)', border:'0.5px solid var(--border-card)',
              background:'none', color:'var(--text-muted)', fontSize:12, cursor:'pointer' }}>✕</button>
        </div>
      </div>

      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
          <thead>
            <tr style={{ background:'#f5f5f0' }}>
              {cols.map(([k,l]) => (
                <th key={k} style={{ ...CS, fontWeight:600, color:'#555', borderBottom:'1px solid #ddd' }}>{l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {uniqueRows.map((r, i) => (
              <tr key={i} style={{ background: i%2===0?'#fafaf8':'#fff' }}>
                {cols.map(([k]) => (
                  <td key={k} style={CS}>
                    {k === 'remaining_amount' ? `$${fmt(r[k]||0)}`
                      : k === 'planning_priority' ? (r[k]===188||r[k]===0?'לא משובץ':`שבוע ${r[k]}`)
                      : k === 'shortage_exist' ? (r[k]==='Yes'?'⚠ כן':'')
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

function ChangeCell({ aAmt, bAmt, style={} }) {
  const diff = bAmt - aAmt
  if (Math.abs(diff) < 0.01) return <td style={style}><span style={{color:'#999',fontSize:13}}>↔</span></td>
  const up = diff > 0
  return (
    <td style={style}>
      <span style={{ color:up?'#2a7a1a':'#a32d2d', fontWeight:700 }}>
        {up?'↑':'↓'} ${fmt(Math.abs(diff))}
      </span>
    </td>
  )
}

function StatusTable({ mk, aData, bData, aFile, bFile, color, productionMapA, productionMapB, onCellClick, activeKey }) {
  const statuses = [...new Set([...Object.keys(aData||{}), ...Object.keys(bData||{})])]
    .sort((a,b) => { const ai=STATUS_ORDER.indexOf(a),bi=STATUS_ORDER.indexOf(b); return (ai<0?99:ai)-(bi<0?99:bi) })

  const CS = { padding:'6px 10px', fontSize:12, borderBottom:'0.5px solid #e8e8e2', whiteSpace:'nowrap', textAlign:'center', verticalAlign:'middle' }
  const HS = { ...CS, fontWeight:600, fontSize:11, color:'#555', background:'#f5f5f0' }

  function sum(data) {
    let iA=0,eA=0,iC=0,eC=0
    Object.values(data||{}).forEach(s=>{iA+=s.I?.amt||0;eA+=s.E?.amt||0;iC+=s.I?.cnt||0;eC+=s.E?.cnt||0})
    return {iA,eA,iC,eC,tot:iA+eA,cnt:iC+eC}
  }
  const tA=sum(aData), tB=sum(bData)

  function clickable(amt, key) {
    if (!amt) return { style: CS }
    const isActive = activeKey === key
    return {
      style: { ...CS, cursor:'pointer', background: isActive ? '#d0e8f8' : undefined, fontWeight: isActive ? 700 : undefined },
      onClick: () => onCellClick(key)
    }
  }

  function AmtCell({ amt, rows, ie, file, colKey }) {
    const key = `${mk}|${colKey}|${ie}|${file}`
    const props = clickable(amt, key)
    return <td {...props}>{amt ? `$${fmt(amt)}` : '—'}</td>
  }

  function TotCell({ aAmt, bAmt, st }) {
    const keyA = `${mk}|${st}|all|A`, keyB = `${mk}|${st}|all|B`
    const aProps = clickable(aAmt, keyA)
    const bProps = clickable(bAmt, keyB)
    return <>
      <td {...aProps} style={{ ...(aProps.style||{}), fontWeight:600, background: activeKey===keyA?'#d0e8f8':'#f0f5fb' }}>{aAmt?`$${fmt(aAmt)}`:'—'}</td>
      <td style={{ ...CS, color:'#777', borderRight:'2px solid #bbb' }}>{(aData?.[st]?.I?.cnt||0)+(aData?.[st]?.E?.cnt||0)||'—'}</td>
      <td {...bProps} style={{ ...(bProps.style||{}), fontWeight:600, background: activeKey===keyB?'#d0e8f8':'#f8f2e8' }}>{bAmt?`$${fmt(bAmt)}`:'—'}</td>
      <td style={{ ...CS, color:'#777', borderRight:'2px solid #bbb' }}>{(bData?.[st]?.I?.cnt||0)+(bData?.[st]?.E?.cnt||0)||'—'}</td>
    </>
  }

  return (
    <div style={{ border:'0.5px solid #ddd', borderRadius:10, overflow:'hidden', marginBottom:16 }}>
      <div style={{ background:color, color:'#fff', padding:'10px 16px', fontWeight:700, fontSize:15, textAlign:'center' }}>{monthLabel(mk)}</div>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead>
            <tr>
              <th rowSpan={2} style={{ ...HS, textAlign:'right', borderRight:'1px solid #ccc' }}>סטטוס</th>
              <th colSpan={4} style={{ ...HS, background:'#eaf0f8', textAlign:'center', borderRight:'2px solid #bbb' }}>
                📅 {aFile?.batch_date||'—'} <span style={{fontSize:10,fontWeight:400,opacity:0.75}}>· {aFile?.filename} (עדכני)</span>
              </th>
              <th colSpan={4} style={{ ...HS, background:'#f5f0e8', textAlign:'center', borderRight:'2px solid #bbb' }}>
                📅 {bFile?.batch_date||'—'} <span style={{fontSize:10,fontWeight:400,opacity:0.75}}>· {bFile?.filename} (קודם)</span>
              </th>
              <th rowSpan={2} style={{ ...HS, background:'#eef5ea', textAlign:'center' }}>שינוי</th>
            </tr>
            <tr>
              <th style={{ ...HS, background:'#eaf0f8' }}>פנימי $</th>
              <th style={{ ...HS, background:'#eaf0f8' }}>חיצוני $</th>
              <th style={{ ...HS, background:'#dce8f5', fontWeight:700 }}>סכום כולל</th>
              <th style={{ ...HS, background:'#eaf0f8', borderRight:'2px solid #bbb' }}>שורות</th>
              <th style={{ ...HS, background:'#f5f0e8' }}>פנימי $</th>
              <th style={{ ...HS, background:'#f5f0e8' }}>חיצוני $</th>
              <th style={{ ...HS, background:'#ede5d8', fontWeight:700 }}>סכום כולל</th>
              <th style={{ ...HS, background:'#f5f0e8', borderRight:'2px solid #bbb' }}>שורות</th>
            </tr>
          </thead>
          <tbody>
            {statuses.map((st,i) => {
              const a = aData?.[st], b = bData?.[st]
              const aTot=(a?.I?.amt||0)+(a?.E?.amt||0), bTot=(b?.I?.amt||0)+(b?.E?.amt||0)
              return (
                <tr key={st} style={{ background:i%2===0?'#fafaf8':'#fff' }}>
                  <td style={{ ...CS, textAlign:'right', fontWeight:500, borderRight:'1px solid #ccc' }}>{shortStatus(st)}</td>
                  <AmtCell amt={a?.I?.amt} colKey={st} ie="I" file="A" />
                  <AmtCell amt={a?.E?.amt} colKey={st} ie="E" file="A" />
                  <TotCell aAmt={aTot} bAmt={bTot} st={st} />
                  <AmtCell amt={b?.I?.amt} colKey={st} ie="I" file="B" />
                  <AmtCell amt={b?.E?.amt} colKey={st} ie="E" file="B" />
                  <ChangeCell aAmt={aTot} bAmt={bTot} style={{ ...CS, background:'#f0f8ec' }} />
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight:700, background:'#e8edf5', fontSize:13 }}>
              <td style={{ ...CS, textAlign:'right', borderRight:'1px solid #ccc' }}>סה"כ</td>
              <td style={CS}>${fmt(tA.iA)}</td><td style={CS}>${fmt(tA.eA)}</td>
              <td style={{ ...CS, fontWeight:700, background:'#d8e4f0' }}>${fmt(tA.tot)}</td>
              <td style={{ ...CS, borderRight:'2px solid #bbb' }}>{tA.cnt}</td>
              <td style={CS}>${fmt(tB.iA)}</td><td style={CS}>${fmt(tB.eA)}</td>
              <td style={{ ...CS, fontWeight:700, background:'#eddfc8' }}>${fmt(tB.tot)}</td>
              <td style={{ ...CS, borderRight:'2px solid #bbb' }}>{tB.cnt}</td>
              <ChangeCell aAmt={tA.tot} bAmt={tB.tot} style={{ ...CS, background:'#dff0d8', fontSize:14 }} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

export default function MonthlyStatusView({ production, dr4, dr5 }) {
  const [allFiles, setAllFiles] = useState([])
  const [selected, setSelected] = useState([])
  const [running, setRunning] = useState(false)
  const [activeFiles, setActiveFiles] = useState([])
  const [ordersA, setOrdersA] = useState([])
  const [ordersB, setOrdersB] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeKey, setActiveKey] = useState(null) // clicked cell key

  useEffect(() => {
    fetchSalesFiles().then(files => {
      setAllFiles(files)
      if (files.length >= 2) setSelected([files[0].id, files[1].id])
      else if (files.length === 1) setSelected([files[0].id])
    })
  }, [])

  function toggleSelect(id) {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x=>x!==id)
      if (prev.length >= 2) return prev
      return [...prev, id]
    })
    setRunning(false)
  }

  async function runComparison() {
    if (selected.length !== 2) return
    setLoading(true); setActiveKey(null)
    const [idA, idB] = selected
    const fileA = allFiles.find(f=>f.id===idA)
    const fileB = allFiles.find(f=>f.id===idB)

    // Sort: newer = left (index 0), older = right (index 1)
    // Primary sort by batch_date, secondary by uploaded_at
    const sortKey = f => f.batch_date + '_' + f.uploaded_at
    const [newerFile, olderFile] = sortKey(fileA) >= sortKey(fileB)
      ? [fileA, fileB] : [fileB, fileA]

    const [newOrders, oldOrders] = await Promise.all([
      fetchSalesOrdersByFileId(newerFile.id),
      fetchSalesOrdersByFileId(olderFile.id)
    ])
    setOrdersA(newOrders); setOrdersB(oldOrders)
    setActiveFiles([newerFile, olderFile])
    setLoading(false); setRunning(true)
  }

  const buildA = useMemo(() => buildMonthData(ordersA, production, dr4, dr5), [ordersA, production, dr4, dr5])
  const buildB = useMemo(() => buildMonthData(ordersB, production, dr4, dr5), [ordersB, production, dr4, dr5])

  const now = new Date()
  const displayMonths = [0,1].map(offset => {
    const d = new Date(now.getFullYear(), now.getMonth()+offset, 1)
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
  })
  const COLORS = ['#D97706','#1D6FA5']

  // Parse clicked key → show detail
  function getDetail() {
    if (!activeKey || !running) return null
    const parts = activeKey.split('|')
    const [mk, st, ie, file] = parts
    const build = file === 'A' ? buildA : buildB
    const stData = build.byMonth[mk]?.[st]
    if (!stData) return null
    let rows = []
    if (ie === 'all') rows = [...(stData.I?.rows||[]), ...(stData.E?.rows||[])]
    else rows = stData[ie]?.rows || []
    const fileLabel = file === 'A' ? activeFiles[0]?.batch_date : activeFiles[1]?.batch_date
    const productionMap = build.productionMap
    return { status: st, monthKey: mk, rows, productionMap, fileLabel }
  }

  const detail = getDetail()

  return (
    <div>
      <div className="page-heading">מצב הזמנות — השוואה יומית</div>

      <div className="section-box" style={{ marginBottom:'1.25rem' }}>
        <div className="section-title">בחר שני קבצים להשוואה ({selected.length}/2 נבחרו)</div>
        {allFiles.length === 0 && <div style={{ fontSize:13, color:'var(--text-muted)' }}>אין קבצים שמורים.</div>}
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:12 }}>
          {allFiles.map(f => {
            const isSel = selected.includes(f.id)
            const isDisabled = !isSel && selected.length >= 2
            return (
              <button key={f.id} onClick={() => !isDisabled && toggleSelect(f.id)}
                style={{ padding:'8px 14px', borderRadius:'var(--radius)', fontSize:12,
                  border:'0.5px solid '+(isSel?'var(--blue-dark)':'var(--border-card)'),
                  background:isSel?'var(--blue-bg)':'var(--bg-row)',
                  color:isSel?'var(--blue-dark)':isDisabled?'var(--text-hint)':'var(--text-main)',
                  cursor:isDisabled?'not-allowed':'pointer', opacity:isDisabled?0.5:1,
                  display:'flex', flexDirection:'column', alignItems:'flex-start', gap:2 }}>
                <span style={{ fontWeight:600 }}>{isSel?'✓ ':''}{f.batch_date}</span>
                <span style={{ color:'var(--text-muted)', fontSize:11 }}>{f.filename} · {new Date(f.uploaded_at).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'})}</span>
              </button>
            )
          })}
        </div>
        <button onClick={runComparison} disabled={selected.length!==2||loading}
          style={{ padding:'9px 24px', borderRadius:'var(--radius)', fontSize:14, fontWeight:600,
            background:selected.length===2?'var(--blue-dark)':'#ccc',
            color:'#fff', border:'none', cursor:selected.length===2?'pointer':'not-allowed' }}>
          {loading?'טוען...':'▶ הפעל השוואה'}
        </button>
      </div>

      {running && displayMonths.map((mk,i) => (
        <StatusTable key={mk} mk={mk}
          aData={buildA.byMonth[mk]} bData={buildB.byMonth[mk]}
          aFile={activeFiles[0]} bFile={activeFiles[1]}
          color={COLORS[i]}
          productionMapA={buildA.productionMap}
          productionMapB={buildB.productionMap}
          onCellClick={key => setActiveKey(activeKey===key ? null : key)}
          activeKey={activeKey}
        />
      ))}

      {detail && (
        <DetailPanel
          status={detail.status}
          monthKey={detail.monthKey}
          rows={detail.rows}
          productionMap={detail.productionMap}
          fileLabel={detail.fileLabel}
          onClose={() => setActiveKey(null)}
        />
      )}
    </div>
  )
}
