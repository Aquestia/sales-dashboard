import { useState, useEffect, useMemo } from 'react'
import * as XLSX from 'xlsx-js-style'
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
const shortStatus = s => (s||'').replace('בהרכבת הרכבת ','הרכבת ').replace('בהרכבת ','הרכבת ')

// צבעי תגית סטטוס (pill) — לפי מיקום ב-STATUS_ORDER
const PILL_PALETTE = [
  ['#EAF3DE','#2F7D4F'], ['#E6F1FB','#185FA5'], ['#F2E9F6','#7D3C98'],
  ['#FAEEDA','#9A6A12'], ['#FCEBEB','#A32D2D'], ['#E7F5F3','#0E7C86'],
  ['#F0EEF9','#4B44A8'], ['#FBEFE4','#B4560F'], ['#EEF2F6','#3A4A5C'],
]
function statusPill(st) {
  const idx = STATUS_ORDER.indexOf(st)
  const [bg, c] = PILL_PALETTE[(idx < 0 ? 8 : idx) % PILL_PALETTE.length]
  return { bg, c }
}

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
    o._cls = st  // צירוף הסטטוס המסווג לשורה (לתצוגה בפאנל ובייצוא)
    byMonth[mk][st][ie].cnt += 1
    byMonth[mk][st][ie].amt += o.remaining_amount || 0
    byMonth[mk][st][ie].rows.push(o)
  })
  return { byMonth, productionMap }
}

// ── Sales order columns (always shown)
const SO_COLS = [
  ['_cls','סטטוס'],
  ['sales_order','הזמנה'],['line_number','שורה'],['customer_account','לקוח'],
  ['customer_name','שם לקוח'],['item_number','מק"ט'],['item_group','קבוצה'],
  ['status','סטטוס הזמנה'],['mode_of_delivery','משלוח'],['confirmed_ship_date','ת. אספקה'],
  ['ordered_quantity','כמות'],['deliver_remainder','יתרה'],['remaining_amount','סכום $'],
  ['_prod_info','מידע פק"ע']
]

// ── עיצוב אקסל ──
const XL_HEAD_FILL = 'FF2B6CA3'
function xlThin() {
  const s = { style: 'thin', color: { rgb: 'FFCDDAE6' } }
  return { top: s, bottom: s, left: s, right: s }
}
function argb(hex) { return 'FF' + hex.replace('#', '').toUpperCase() }

const EXPORT_COLS = [
  { h: 'סטטוס',        w: 15, align: 'right'  },
  { h: 'הזמנה',        w: 14, align: 'center' },
  { h: 'שורה',         w: 7,  align: 'center' },
  { h: 'לקוח',         w: 11, align: 'center' },
  { h: 'שם לקוח',      w: 30, align: 'right'  },
  { h: 'מק"ט',         w: 17, align: 'center' },
  { h: 'קבוצה',        w: 9,  align: 'center' },
  { h: 'סטטוס הזמנה',  w: 16, align: 'center' },
  { h: 'משלוח',        w: 9,  align: 'center' },
  { h: 'ת. אספקה',     w: 12, align: 'center' },
  { h: 'כמות',         w: 9,  align: 'center' },
  { h: 'יתרה',         w: 9,  align: 'center' },
  { h: 'סכום $',       w: 13, align: 'center', money: true },
  { h: 'סטטוס פק"ע',   w: 18, align: 'center' },
  { h: 'שבוע',         w: 11, align: 'center' },
  { h: 'מאגר',         w: 10, align: 'center' },
]
const MONEY_C = 12  // index of "סכום $"

function exportToExcel(rows, filename, productionMap) {
  const aoa = [EXPORT_COLS.map(c => c.h)]
  let total = 0
  rows.forEach(r => {
    const prod = productionMap?.[r.production_number]
    const wk = prod ? (prod.planning_priority === 188 || !prod.planning_priority ? 'לא משובץ' : `שבוע ${prod.planning_priority}`) : ''
    total += r.remaining_amount || 0
    aoa.push([
      shortStatus(r._cls || ''),
      r.sales_order || '', r.line_number ?? '', r.customer_account || '',
      r.customer_name || '', r.item_number || '', r.item_group || '',
      r.status || '', r.mode_of_delivery || '', r.confirmed_ship_date || '',
      r.ordered_quantity ?? '', r.deliver_remainder ?? '',
      Math.round(r.remaining_amount || 0),
      prod?.status || '', wk, prod?.pool || '',
    ])
  })
  // שורת סה"כ
  const totRow = EXPORT_COLS.map(() => '')
  totRow[0] = 'סה"כ'
  totRow[MONEY_C] = Math.round(total)
  aoa.push(totRow)

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = EXPORT_COLS.map(c => ({ wch: c.w }))
  ws['!views'] = [{ rightToLeft: true }]
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 0, c: EXPORT_COLS.length - 1 } }) }

  const lastR = aoa.length - 1
  for (let r = 0; r < aoa.length; r++) {
    const isHead = r === 0
    const isTot = r === lastR
    for (let c = 0; c < EXPORT_COLS.length; c++) {
      const addr = XLSX.utils.encode_cell({ r, c })
      if (!ws[addr]) continue
      if (isHead) {
        ws[addr].s = {
          fill: { patternType: 'solid', fgColor: { rgb: XL_HEAD_FILL } },
          font: { bold: true, color: { rgb: 'FFFFFFFF' }, sz: 11 },
          alignment: { horizontal: 'center', vertical: 'center', readingOrder: 2, wrapText: true },
          border: xlThin(),
        }
      } else {
        const bg = isTot ? 'FFE8EDF5' : (r % 2 === 0 ? 'FFF6F9FC' : 'FFFFFFFF')
        ws[addr].s = {
          fill: { patternType: 'solid', fgColor: { rgb: bg } },
          font: { sz: 10.5, bold: isTot, color: { rgb: 'FF333333' } },
          alignment: { horizontal: EXPORT_COLS[c].align, vertical: 'center', readingOrder: 2 },
          border: xlThin(),
        }
        if (c === MONEY_C && typeof ws[addr].v === 'number') ws[addr].z = '"$"#,##0'
      }
    }
  }
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'הזמנות')
  XLSX.writeFile(wb, filename + '.xlsx', { bookType: 'xlsx' })
}

function DetailPanel({ status, monthKey: mk, rows, productionMap, fileLabel, onClose }) {
  const [sortCol, setSortCol] = useState('remaining_amount')
  const [sortDir, setSortDir] = useState('desc')
  const CS = { padding:'5px 8px', fontSize:11, borderBottom:'0.5px solid #e8e8e2', whiteSpace:'nowrap', textAlign:'right' }

  const totalAmt = rows.reduce((s, r) => s + (r.remaining_amount || 0), 0)
  const sorted = [...rows].sort((a, b) => {
    const av=a[sortCol]??'', bv=b[sortCol]??''
    const isNum = !isNaN(parseFloat(av)) && av!==''
    const cmp = isNum ? parseFloat(av)-parseFloat(bv) : String(av).localeCompare(String(bv),'he')
    return sortDir==='asc' ? cmp : -cmp
  })

  return (
    <div style={{ border:'0.5px solid var(--border-card)', borderRadius:10, padding:'1rem 1.2rem', marginTop:16, background:'#fff' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <div>
          <span style={{ fontWeight:600, fontSize:14 }}>
            {status === '__ALL__' ? '📋 כל הסטטוסים' : shortStatus(status)} · {monthLabel(mk)}
          </span>
          <span style={{ fontSize:12, color:'var(--text-muted)', marginRight:10 }}>
            {fileLabel} · {rows.length} שורות · ${fmt(totalAmt)}
          </span>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => exportToExcel(sorted, status === '__ALL__' ? `כל_הסטטוסים_${mk}` : `${shortStatus(status)}_${mk}`, productionMap)}
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
              {SO_COLS.map(([k,l]) => (
                <th key={k}
                  onClick={() => { if(sortCol===k) setSortDir(d=>d==='asc'?'desc':'asc'); else {setSortCol(k);setSortDir('asc')} }}
                  style={{ ...CS, fontWeight:600, color:'#555', borderBottom:'1px solid #ddd',
                    cursor:'pointer', userSelect:'none',
                    background: sortCol===k?'#e6f1fb':'transparent' }}>
                  {k==='_prod_info'?'פק"ע · שבוע · מאגר':l} {sortCol===k?(sortDir==='asc'?'↑':'↓'):<span style={{opacity:0.3}}>↕</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => {
              const prod = productionMap?.[r.production_number]
              const isDone = prod && ['Ended','Reported as finished'].includes(prod.status)
              return (
                <tr key={i} style={{ background: isDone ? '#eaf3de' : i%2===0?'#fafaf8':'#fff' }}>
                  {SO_COLS.map(([k]) => (
                    <td key={k} style={CS}>
                      {k === '_cls' ? (() => {
                          const p = statusPill(r._cls)
                          return <span style={{ background:p.bg, color:p.c, fontWeight:600, fontSize:10,
                            padding:'2px 8px', borderRadius:100, whiteSpace:'nowrap' }}>{shortStatus(r._cls)}</span>
                        })()
                        : k === 'remaining_amount' ? `$${fmt(r[k]||0)}`
                        : k === '_prod_info' ? (
                          prod
                            ? <span style={{ fontSize:10 }}>
                                {prod.production} · {prod.planning_priority===188||!prod.planning_priority?'לא משובץ':`שבוע ${prod.planning_priority}`} · {prod.pool||'—'}
                              </span>
                            : <span style={{ color:'#ccc' }}>—</span>
                        )
                        : (r[k] ?? '')}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight:700, background:'#e8edf5' }}>
              <td colSpan={12} style={{ ...CS, textAlign:'left' }}>סה"כ</td>
              <td style={{ ...CS, fontWeight:700 }}>${fmt(totalAmt)}</td>
              <td style={CS}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function ChangeCell({ aAmt, bAmt, style={} }) {
  // bAmt = newer (B=left=עדכני), aAmt = older (A=right=קודם)
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

  function AmtCell({ amt, colKey, ie, file }) {
    const key = `${mk}|${colKey}|${ie}|${file}`
    const isActive = activeKey === key
    return (
      <td onClick={amt ? () => onCellClick(key) : undefined}
        style={{ ...CS, cursor: amt ? 'pointer' : 'default',
          background: isActive ? '#d0e8f8' : undefined }}>
        {amt ? `$${fmt(amt)}` : '—'}
      </td>
    )
  }

  function TotAmtCell({ amt, st, file, bgColor }) {
    const key = `${mk}|${st}|all|${file}`
    const isActive = activeKey === key
    return (
      <td onClick={amt ? () => onCellClick(key) : undefined}
        style={{ ...CS, fontWeight:600, cursor: amt ? 'pointer' : 'default',
          background: isActive ? '#d0e8f8' : bgColor }}>
        {amt ? `$${fmt(amt)}` : '—'}
      </td>
    )
  }

  return (
    <div style={{ border:'0.5px solid #ddd', borderRadius:10, overflow:'hidden', marginBottom:16 }}>
      <div style={{ background:color, color:'#fff', padding:'10px 16px', fontWeight:700, fontSize:15, textAlign:'center' }}>{monthLabel(mk)}</div>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead>
            <tr>
              <th rowSpan={2} style={{ ...HS, textAlign:'right', borderLeft:'2px solid #ccc', borderRight:'none' }}>סטטוס</th>
              {/* A = RIGHT = קודם = brown */}
              <th colSpan={4} style={{ ...HS, background:'#f5efe0', textAlign:'center', borderLeft:'2px solid #b8860b' }}>
                📅 {aFile?.batch_date||'—'}
                <span style={{fontSize:10, fontWeight:500, marginRight:6, color:'#7a5a00'}}> {aFile?.filename}</span>
                <span style={{fontSize:11, fontWeight:700, color:'#7a5a00'}}>(קודם)</span>
              </th>
              {/* B = LEFT = עדכני = blue */}
              <th colSpan={4} style={{ ...HS, background:'#dceefb', textAlign:'center', borderLeft:'2px solid #1565a0' }}>
                📅 {bFile?.batch_date||'—'}
                <span style={{fontSize:10, fontWeight:500, marginRight:6, color:'#1565a0'}}> {bFile?.filename}</span>
                <span style={{fontSize:11, fontWeight:700, color:'#1565a0'}}>(עדכני)</span>
              </th>
              <th rowSpan={2} style={{ ...HS, background:'#eef5ea', textAlign:'center' }}>שינוי</th>
            </tr>
            <tr>
              {/* A sub-headers = brown */}
              <th style={{ ...HS, background:'#f5efe0', color:'#7a5a00' }}>פנימי $</th>
              <th style={{ ...HS, background:'#f5efe0', color:'#7a5a00' }}>חיצוני $</th>
              <th style={{ ...HS, background:'#e8d9b0', color:'#7a5a00', fontWeight:700 }}>סכום כולל</th>
              <th style={{ ...HS, background:'#f5efe0', color:'#7a5a00', borderLeft:'2px solid #b8860b' }}>שורות</th>
              {/* B sub-headers = blue */}
              <th style={{ ...HS, background:'#dceefb', color:'#1565a0' }}>פנימי $</th>
              <th style={{ ...HS, background:'#dceefb', color:'#1565a0' }}>חיצוני $</th>
              <th style={{ ...HS, background:'#b8dcf5', color:'#1565a0', fontWeight:700 }}>סכום כולל</th>
              <th style={{ ...HS, background:'#dceefb', color:'#1565a0', borderLeft:'2px solid #1565a0' }}>שורות</th>
            </tr>
          </thead>
          <tbody>
            {statuses.map((st,i) => {
              const a = aData?.[st], b = bData?.[st]
              const aTot=(a?.I?.amt||0)+(a?.E?.amt||0), bTot=(b?.I?.amt||0)+(b?.E?.amt||0)
              const aCnt=(a?.I?.cnt||0)+(a?.E?.cnt||0), bCnt=(b?.I?.cnt||0)+(b?.E?.cnt||0)
              return (
                <tr key={st} style={{ background:i%2===0?'#fafaf8':'#fff' }}>
                  <td style={{ ...CS, textAlign:'right', fontWeight:500, borderRight:'1px solid #ccc' }}>{shortStatus(st)}</td>
                  {/* A section: פנימי | חיצוני | סכום כולל | שורות */}
                  <AmtCell amt={a?.I?.amt} colKey={st} ie="I" file="A" />
                  <AmtCell amt={a?.E?.amt} colKey={st} ie="E" file="A" />
                  <TotAmtCell amt={aTot} st={st} file="A" bgColor="#f0e4c0" />
                  <td style={{ ...CS, color:'#777', borderLeft:'2px solid #b8860b' }}>{aCnt||'—'}</td>
                  {/* B section: פנימי | חיצוני | סכום כולל | שורות */}
                  <AmtCell amt={b?.I?.amt} colKey={st} ie="I" file="B" />
                  <AmtCell amt={b?.E?.amt} colKey={st} ie="E" file="B" />
                  <TotAmtCell amt={bTot} st={st} file="B" bgColor="#b8dcf5" />
                  <td style={{ ...CS, color:'#777', borderLeft:'2px solid #1565a0' }}>{bCnt||'—'}</td>
                  {/* Change */}
                  <ChangeCell aAmt={aTot} bAmt={bTot} style={{ ...CS, background:'#f0f8ec' }} />
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight:700, background:'#e8edf5', fontSize:13 }}>
              <td style={{ ...CS, textAlign:'right', borderRight:'1px solid #ccc' }}>סה"כ</td>
              <td style={CS}>${fmt(tA.iA)}</td>
              <td style={CS}>${fmt(tA.eA)}</td>
              <td onClick={tA.tot ? () => onCellClick(`${mk}|__ALL__|all|A`) : undefined}
                title="הצג את כל השורות מכל הסטטוסים"
                style={{ ...CS, fontWeight:700, cursor: tA.tot ? 'pointer' : 'default',
                  background: activeKey === `${mk}|__ALL__|all|A` ? '#d0e8f8' : '#e8d9b0' }}>${fmt(tA.tot)}</td>
              <td style={{ ...CS, borderLeft:'2px solid #b8860b' }}>{tA.cnt}</td>
              <td style={CS}>${fmt(tB.iA)}</td>
              <td style={CS}>${fmt(tB.eA)}</td>
              <td onClick={tB.tot ? () => onCellClick(`${mk}|__ALL__|all|B`) : undefined}
                title="הצג את כל השורות מכל הסטטוסים"
                style={{ ...CS, fontWeight:700, cursor: tB.tot ? 'pointer' : 'default',
                  background: activeKey === `${mk}|__ALL__|all|B` ? '#a8d4f0' : '#b8dcf5' }}>${fmt(tB.tot)}</td>
              <td style={{ ...CS, borderLeft:'2px solid #1565a0' }}>{tB.cnt}</td>
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

    // RIGHT side (A, first in HTML) = older = קודם
    // LEFT side  (B, later in HTML) = newer = עדכני
    const sortKey = f => f.batch_date + '_' + f.uploaded_at
    const [olderFile, newerFile] = sortKey(fileA) >= sortKey(fileB)
      ? [fileB, fileA] : [fileA, fileB]

    const [oldOrders, newOrders] = await Promise.all([
      fetchSalesOrdersByFileId(olderFile.id),
      fetchSalesOrdersByFileId(newerFile.id)
    ])
    setOrdersA(oldOrders)   // A = right = older
    setOrdersB(newOrders)   // B = left  = newer
    setActiveFiles([olderFile, newerFile])
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
    const monthData = build.byMonth[mk]
    if (!monthData) return null
    let rows = []
    if (st === '__ALL__') {
      // כל השורות מכל הסטטוסים בחודש/קובץ הזה
      Object.values(monthData).forEach(stData => {
        rows.push(...(stData.I?.rows || []), ...(stData.E?.rows || []))
      })
    } else {
      const stData = monthData[st]
      if (!stData) return null
      if (ie === 'all') rows = [...(stData.I?.rows || []), ...(stData.E?.rows || [])]
      else rows = stData[ie]?.rows || []
    }
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
