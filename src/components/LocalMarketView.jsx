import { useState, useEffect, useMemo } from 'react'
import * as XLSX from 'xlsx-js-style'
import { fetchLocalItems, fetchLocalPlan, fetchLocalStock } from '../utils/db'

const COLORS = {
  red:    { t: '#A32D2D', bg: '#FCEBEB', label: 'אין מלאי' },
  orange: { t: '#854F0B', bg: '#FAEEDA', label: 'מתחת למינימום' },
  green:  { t: '#2F7D4F', bg: '#EAF3DE', label: 'תקין' },
  violet: { t: '#7D3C98', bg: '#F2E9F6', label: 'מעל מקסימום' },
}
const STATUS_COLOR = { 'מתוזמן': 'violet', 'בליקוט': 'orange', 'ממתין להרכבה': 'orange', 'בהרכבה': 'green' }
const FIRE = 'כיבוי אש'

function stockColor(stock, min, max) {
  if (stock === 0) return 'red'
  if (stock < min) return 'orange'
  if (stock <= max) return 'green'
  return 'violet'
}
function decodeStatus(status, comp) {
  if (status === 'Scheduled') return 'מתוזמן'
  if (status === 'Released') return comp === 'No' ? 'בליקוט' : 'ממתין להרכבה'
  if (status === 'Started') return 'בהרכבה'
  return status
}
function prioLabel(p) {
  if (p === 188) return 'לא משובץ'
  if (p === 161) return 'קבלנות משנה'
  return 'שבוע ' + p
}
function prioPill(p) {
  if (p === 188) return { t: 'לא משובץ', bg: '#FAEEDA', c: '#9A6A12' }
  if (p === 161) return { t: 'קבלנות', bg: '#F0E9F7', c: '#6A3D8F' }
  return { t: 'ש׳' + p, bg: '#EEF2F6', c: '#3A4A5C' }
}

// ── ייצוא אקסל מעוצב ──
const HEX = { red: 'FFA32D2D', orange: 'FF854F0B', green: 'FF2F7D4F', violet: 'FF7D3C98' }
const BG  = { red: 'FFFCEBEB', orange: 'FFFAEEDA', green: 'FFEAF3DE', violet: 'FFF2E9F6' }
const HEAD_FILL = 'FF2B6CA3'

function styleHeader(ws, ncols) {
  const R = XLSX.utils.decode_range(ws['!ref'])
  for (let c = 0; c < ncols; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c })
    if (!ws[addr]) continue
    ws[addr].s = {
      fill: { patternType: 'solid', fgColor: { rgb: HEAD_FILL } },
      font: { bold: true, color: { rgb: 'FFFFFFFF' }, sz: 11 },
      alignment: { horizontal: 'center', vertical: 'center', readingOrder: 2 },
      border: thin(),
    }
  }
  return R
}
function thin() {
  const s = { style: 'thin', color: { rgb: 'FFCDDAE6' } }
  return { top: s, bottom: s, left: s, right: s }
}
function downloadWB(wb, name) {
  XLSX.writeFile(wb, name, { bookType: 'xlsx' })
}

function exportStatus(rows, prds) {
  const aoa = [['מק"ט', 'תיאור', 'משפחה', 'מלאי', 'מינימום', 'מקסימום', 'סטטוס מלאי', 'כמות בייצור', 'מס׳ פק"עות', 'שבועות']]
  rows.forEach(i => {
    const wk = [...new Set(prds.filter(p => p.item_number === i.item).map(p => p.prio))].sort((a, b) => a - b).map(prioLabel).join(', ')
    aoa.push([i.item, i.name, i.family, i.stock, i.min, i.max, COLORS[i.color].label, i.prdQty || '', i.prdCount || '', wk])
  })
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = [{ wch: 20 }, { wch: 46 }, { wch: 14 }, { wch: 8 }, { wch: 9 }, { wch: 10 }, { wch: 15 }, { wch: 11 }, { wch: 11 }, { wch: 22 }]
  ws['!views'] = [{ rightToLeft: true }]
  styleHeader(ws, 10)
  // צביעת עמודת מלאי (D) + תא סטטוס (G) לפי הקטגוריה
  rows.forEach((i, idx) => {
    const r = idx + 1
    ;['D', 'G'].forEach(col => {
      const addr = col + (r + 1)
      if (!ws[addr]) return
      ws[addr].s = {
        fill: { patternType: 'solid', fgColor: { rgb: BG[i.color] } },
        font: { color: { rgb: HEX[i.color] }, bold: col === 'D' },
        alignment: { horizontal: 'center', readingOrder: 2 }, border: thin(),
      }
    })
  })
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'סטטוס מוצרים')
  downloadWB(wb, 'מלאי_שוק_מקומי_סטטוס.xlsx')
}

function exportMatrix(items, cols, cellSum, prds, sheetName, fileName) {
  const rows = items.filter(i => i.prdCount > 0).sort((a, b) => b.prdCount - a.prdCount || a.item.localeCompare(b.item))
  const activeCols = cols.filter(c => rows.some(i => cellSum(i.item, c) > 0))
  const header = ['מק"ט', 'שם', 'משפחה', ...activeCols.map(prioLabel), 'Σ סה"כ']
  const aoa = [header]
  rows.forEach(i => {
    let tot = 0
    const cells = activeCols.map(c => { const s = cellSum(i.item, c); tot += s; return s || '' })
    aoa.push([i.item, i.name, i.family, ...cells, tot])
  })
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = [{ wch: 20 }, { wch: 42 }, { wch: 13 }, ...activeCols.map(() => ({ wch: 13 })), { wch: 10 }]
  ws['!views'] = [{ rightToLeft: true }]
  styleHeader(ws, header.length)
  // מרכוז תאי הכמויות + גבולות
  for (let r = 1; r < aoa.length; r++) {
    for (let c = 3; c < header.length; c++) {
      const addr = XLSX.utils.encode_cell({ r, c })
      if (!ws[addr]) continue
      ws[addr].s = { alignment: { horizontal: 'center', readingOrder: 2 }, border: thin(),
        font: { bold: c === header.length - 1 } }
    }
  }
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  downloadWB(wb, fileName)
}

export default function LocalMarketView() {
  const [items, setItems] = useState(null)
  const [plan, setPlan] = useState([])
  const [stock, setStock] = useState([])
  const [tab, setTab] = useState('status')
  const [filter, setFilter] = useState('all')
  const [famSel, setFamSel] = useState('')
  const [search, setSearch] = useState('')
  const [planFam, setPlanFam] = useState(FIRE)
  const [restFam, setRestFam] = useState('')
  const [modal, setModal] = useState(null) // { kind:'prd'|'stock', ... }

  useEffect(() => {
    Promise.all([fetchLocalItems(), fetchLocalPlan(), fetchLocalStock()])
      .then(([it, pl, st]) => { setItems(it); setPlan(pl); setStock(st) })
  }, [])

  // עיבוד: סינון פק"עות למק"טים שברשימה + העשרת מק"טים
  const { enriched, prds, cols, families } = useMemo(() => {
    if (!items) return { enriched: [], prds: [], cols: [], families: [] }
    const itemSet = new Set(items.map(i => i.item_number))
    const stockByItem = {}
    stock.forEach(s => { (stockByItem[s.item_number] ||= []).push(s) })

    const prds = plan.filter(p => itemSet.has(p.item_number)).map(p => ({
      ...p,
      prio: Number(p.planning_priority),
      qty: Number(p.quantity) || 0,
      runtime: Number(p.estimated_run_time) || 0,
      decoded: decodeStatus(p.status, p.components_in_station),
    }))

    const prioSet = [...new Set(prds.map(p => p.prio))]
    const weeks = prioSet.filter(p => p !== 161 && p !== 188).sort((a, b) => a - b)
    const cols = [...weeks, ...(prioSet.includes(161) ? [161] : []), ...(prioSet.includes(188) ? [188] : [])]

    const enriched = items.map(i => {
      const stk = Number(i.stock) || 0, mn = Number(i.min_qty) || 0, mx = Number(i.max_qty) || 0
      const ip = prds.filter(p => p.item_number === i.item_number)
      return {
        item: i.item_number, name: i.description || '', family: i.family || '',
        stock: stk, min: mn, max: mx, color: stockColor(stk, mn, mx),
        prdQty: ip.reduce((s, p) => s + p.qty, 0), prdCount: ip.length,
        locs: (stockByItem[i.item_number] || []),
      }
    })
    const families = [...new Set(enriched.map(i => i.family))].sort()
    return { enriched, prds, cols, families }
  }, [items, plan, stock])

  if (items === null) return <div style={{ padding: 40, color: 'var(--text-muted)' }}>טוען נתוני מלאי שוק מקומי...</div>

  const kpis = [
    { v: enriched.length, l: 'סה"כ מק"טים' },
    { v: enriched.filter(i => i.color === 'red').length, l: 'אין מלאי', c: '#A32D2D' },
    { v: enriched.filter(i => i.color === 'orange').length, l: 'מתחת למינימום', c: '#854F0B' },
    { v: prds.length, l: 'פק"עות פעילות' },
    { v: enriched.filter(i => i.family === FIRE && (i.color === 'red' || i.color === 'orange')).length, l: 'כיבוי אש בסיכון', c: '#A32D2D' },
  ]

  const cellSum = (item, prio) => prds.filter(p => p.item_number === item && p.prio === prio).reduce((s, p) => s + p.qty, 0)

  // דוח סטטוס
  const statusRows = enriched.filter(i => {
    if (filter !== 'all' && i.color !== filter) return false
    if (famSel && i.family !== famSel) return false
    if (search) { const q = search.toLowerCase(); if (!(i.item.toLowerCase().includes(q) || i.name.toLowerCase().includes(q))) return false }
    return true
  }).sort((a, b) => ({ red: 0, orange: 1, green: 2, violet: 3 }[a.color] - { red: 0, orange: 1, green: 2, violet: 3 }[b.color]) || a.item.localeCompare(b.item))

  // טבלת תכנון (רק עם פק"ע), עמודות דינמיות
  const planItems = enriched.filter(i => (planFam ? i.family === planFam : true) && i.prdCount > 0)
    .sort((a, b) => b.prdCount - a.prdCount || a.item.localeCompare(b.item))
  const planCols = cols.filter(c => planItems.some(i => cellSum(i.item, c) > 0))

  const openPrd = (item, prio) => setModal({ kind: 'prd', item, prio })
  const openStock = (item) => setModal({ kind: 'stock', item })

  return (
    <div dir="rtl">
      <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-main)', marginBottom: 4 }}>מלאי שוק מקומי</h2>
      <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>סטטוס מוצרים · תכנון ייצור · מטריצות שבועיות</div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 16 }}>
        {kpis.map((k, i) => (
          <div key={i} style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border-card)', borderRadius: 12, padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, right: 0, width: 4, height: '100%', background: k.c || '#185FA5' }} />
            <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1, color: k.c || 'var(--text-main)' }}>{k.v}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 5 }}>{k.l}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {[['status', '📋 סטטוס מוצרים + תכנון ייצור'], ['fire', '🔥 מטריצת כיבוי אש'], ['rest', '🏭 מטריצת שאר המוצרים']].map(([k, lbl]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: '10px 18px', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer',
            border: '0.5px solid ' + (tab === k ? (k === 'fire' ? '#A32D2D' : 'var(--text-main)') : 'var(--border-card)'),
            background: tab === k ? (k === 'fire' ? '#A32D2D' : '#1A1A1A') : 'var(--bg-card)',
            color: tab === k ? '#fff' : 'var(--text-sub)',
          }}>{lbl}</button>
        ))}
      </div>

      {tab === 'status' && (
        <div style={panelStyle}>
          <SectionTitle icon="📋" title="דוח סטטוס מוצרים" sub="מלאי מצובע לפי הסף · לחץ על שורה לפירוט מלאי לפי מיקום" />
          <div style={ctrlStyle}>
            {[['all', 'הכל', null], ['red', 'אין מלאי', 'red'], ['orange', 'מתחת למינימום', 'orange'], ['green', 'תקין', 'green'], ['violet', 'מעל מקסימום', 'violet']].map(([k, lbl, c]) => (
              <button key={k} onClick={() => setFilter(k)} style={chipStyle(filter === k)}>
                {c && <span style={{ width: 9, height: 9, borderRadius: '50%', background: COLORS[c].t, display: 'inline-block', marginLeft: 6 }} />}{lbl}
              </button>
            ))}
            <select value={famSel} onChange={e => setFamSel(e.target.value)} style={selStyle}>
              <option value="">כל המשפחות</option>{families.map(f => <option key={f}>{f}</option>)}
            </select>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="חיפוש מק״ט / תיאור…" style={{ ...selStyle, marginRight: 'auto', width: 200 }} />
            <button onClick={() => exportStatus(statusRows, prds)} style={exportBtnStyle}>⬇ ייצוא לאקסל</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={tblStyle}>
              <thead><tr>{['מק״ט', 'תיאור', 'משפחה', 'מלאי', 'מין׳', 'מקס׳', 'סטטוס מלאי', 'בייצור (כמות · שבוע)'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
              <tbody>
                {statusRows.map(i => {
                  const iprios = [...new Set(prds.filter(p => p.item_number === i.item).map(p => p.prio))].sort((a, b) => a - b)
                  return (
                    <tr key={i.item} onClick={() => openStock(i.item)} style={{ cursor: 'pointer' }}>
                      <td style={{ ...tdStyle, fontFamily: 'var(--mono)', fontSize: 12 }}>{i.item}</td>
                      <td style={tdStyle}>{i.name || '—'}</td>
                      <td style={tdStyle}><span style={famTag(i.family)}>{i.family}</span></td>
                      <td style={tdStyle}><span style={stkBadge(i.color)}>{i.stock}</span></td>
                      <td style={{ ...tdStyle, fontFamily: 'var(--mono)' }}>{i.min}</td>
                      <td style={{ ...tdStyle, fontFamily: 'var(--mono)' }}>{i.max}</td>
                      <td style={tdStyle}><span style={badge(i.color)}>{COLORS[i.color].label}</span></td>
                      <td style={tdStyle}>
                        {i.prdCount === 0 ? <span style={{ color: '#CCC' }}>—</span> : (
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', whiteSpace: 'nowrap' }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#185FA5', background: '#E6F1FB', padding: '2px 9px', borderRadius: 100 }}>{i.prdQty} יח׳ · {i.prdCount} פק״ע</span>
                            {iprios.map(p => { const pp = prioPill(p); return <span key={p} style={{ fontSize: 10.5, fontWeight: 600, padding: '1px 7px', borderRadius: 5, fontFamily: 'var(--mono)', background: pp.bg, color: pp.c }}>{pp.t}</span> })}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {statusRows.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 30 }}>אין תוצאות</td></tr>}
              </tbody>
            </table>
          </div>

          <SectionTitle icon="🗓️" title="תוכנית ייצור — מלאי שוק מקומי" sub="מק״ט · שם · משפחה · שבועות. בחיתוך = סך הכמות המתוכננת מכל הפק״עות הפתוחות. לחץ על כמות לפירוט." top />
          <div style={ctrlStyle}>
            <select value={planFam} onChange={e => setPlanFam(e.target.value)} style={selStyle}>
              <option value="">כל המשפחות</option>{[FIRE, ...families.filter(f => f !== FIRE)].map(f => <option key={f}>{f}</option>)}
            </select>
            <button onClick={() => exportMatrix(enriched.filter(i => planFam ? i.family === planFam : true), cols, cellSum, prds, 'תכנון ייצור', 'מלאי_שוק_מקומי_תכנון.xlsx')} style={{ ...exportBtnStyle, marginRight: 'auto' }}>⬇ ייצוא לאקסל</button>
          </div>
          <div style={{ overflowX: 'auto', border: '1px solid #CDDAE6', borderRadius: 10 }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
              <thead><tr>
                <th style={planTh(true)}>מק״ט</th><th style={planTh(true)}>שם</th><th style={planTh(true)}>משפחה</th>
                {planCols.map(c => <th key={c} style={planTh(false)}>{prioLabel(c)}</th>)}
              </tr></thead>
              <tbody>
                {planItems.map((i, ri) => (
                  <tr key={i.item} style={{ background: ri % 2 ? '#EEF4FA' : '#fff' }}>
                    <td style={{ ...planTd, fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, textAlign: 'right' }}>{i.item}</td>
                    <td style={{ ...planTd, textAlign: 'right', color: '#3A4655', fontSize: 12, whiteSpace: 'normal', maxWidth: 280 }}>{i.name || '—'}</td>
                    <td style={{ ...planTd, textAlign: 'right' }}><span style={famTag(i.family)}>{i.family}</span></td>
                    {planCols.map(c => { const s = cellSum(i.item, c); return s > 0
                      ? <td key={c} onClick={() => openPrd(i.item, c)} style={{ ...planTd, fontFamily: 'var(--mono)', fontWeight: 700, color: '#185FA5', cursor: 'pointer', fontSize: 14 }}>{s}</td>
                      : <td key={c} style={planTd}></td> })}
                  </tr>
                ))}
                {planItems.length === 0 && <tr><td colSpan={3 + planCols.length} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 26 }}>אין מק״טים עם פק״ע להצגה</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'fire' && (
        <div style={panelStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <p style={{ fontSize: 13.5, color: 'var(--text-muted)', margin: 0 }}>מק״טי כיבוי אש עם פק״ע פתוחה. לחץ על כמות לפירוט הפק״עות.</p>
            <button onClick={() => exportMatrix(enriched.filter(i => i.family === FIRE), cols, cellSum, prds, 'כיבוי אש', 'מלאי_שוק_מקומי_כיבוי_אש.xlsx')} style={exportBtnStyle}>⬇ ייצוא לאקסל</button>
          </div>
          <Matrix items={enriched.filter(i => i.family === FIRE)} cols={cols} cellSum={cellSum} openPrd={openPrd} fire />
        </div>
      )}

      {tab === 'rest' && (
        <div style={panelStyle}>
          <div style={ctrlStyle}>
            <select value={restFam} onChange={e => setRestFam(e.target.value)} style={selStyle}>
              <option value="">כל המשפחות (חוץ מכיבוי אש)</option>{families.filter(f => f !== FIRE).map(f => <option key={f}>{f}</option>)}
            </select>
            <button onClick={() => exportMatrix(enriched.filter(i => restFam ? i.family === restFam : i.family !== FIRE), cols, cellSum, prds, 'שאר המוצרים', 'מלאי_שוק_מקומי_שאר.xlsx')} style={{ ...exportBtnStyle, marginRight: 'auto' }}>⬇ ייצוא לאקסל</button>
          </div>
          <Matrix items={enriched.filter(i => restFam ? i.family === restFam : i.family !== FIRE)} cols={cols} cellSum={cellSum} openPrd={openPrd} />
        </div>
      )}

      {modal && <Modal modal={modal} prds={prds} enriched={enriched} cols={cols} onClose={() => setModal(null)} />}
    </div>
  )
}

function Matrix({ items, cols, cellSum, openPrd, fire }) {
  const rows = items.filter(i => i.prdCount > 0).sort((a, b) => b.prdCount - a.prdCount || a.item.localeCompare(b.item))
  const headBg = fire ? '#FCEBEB' : '#E6F1FB', headCol = fire ? '#7D2B2B' : '#185FA5'
  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--border-card)', borderRadius: 10 }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
        <thead><tr>
          <th style={{ ...mxTh, background: headBg, color: headCol, textAlign: 'right' }}>מק״ט</th>
          {cols.map(c => <th key={c} style={{ ...mxTh, background: headBg, color: headCol, minWidth: 78 }}>{prioLabel(c)}</th>)}
          <th style={{ ...mxTh, background: headBg, color: headCol }}>Σ</th>
        </tr></thead>
        <tbody>
          {rows.map(i => {
            let tot = 0
            const cells = cols.map(c => { const s = cellSum(i.item, c); tot += s; return { c, s } })
            return (
              <tr key={i.item}>
                <th style={{ ...mxTd, textAlign: 'right', background: '#F7F9FB', fontWeight: 600 }}>
                  {i.item}<span style={{ ...stkMini(i.color), marginRight: 6 }}>מלאי {i.stock}</span>
                </th>
                {cells.map(({ c, s }) => s > 0
                  ? <td key={c} onClick={() => openPrd(i.item, c)} style={{ ...mxTd, fontFamily: 'var(--mono)', fontWeight: 600, color: '#185FA5', cursor: 'pointer' }}>{s}</td>
                  : <td key={c} style={{ ...mxTd, color: '#CDD5DD' }}>·</td>)}
                <td style={{ ...mxTd, fontFamily: 'var(--mono)', fontWeight: 700 }}>{tot || '·'}</td>
              </tr>
            )
          })}
          {rows.length === 0 && <tr><td colSpan={cols.length + 2} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 26 }}>אין מק״טים עם פק״ע להצגה</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

function Modal({ modal, prds, enriched, cols, onClose }) {
  const it = enriched.find(i => i.item === modal.item)
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, background: 'rgba(22,32,46,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 50 }}>
      <div style={{ background: '#fff', borderRadius: 14, maxWidth: 720, width: '100%', maxHeight: '82vh', overflow: 'auto', padding: '24px 26px', position: 'relative' }}>
        <span onClick={onClose} style={{ position: 'absolute', top: 16, left: 20, fontSize: 22, cursor: 'pointer', color: 'var(--text-muted)' }}>×</span>
        <h3 style={{ fontSize: 18, fontWeight: 700 }}>{modal.item}</h3>
        {modal.kind === 'prd' ? (() => {
          const ps = prds.filter(p => p.item_number === modal.item && p.prio === modal.prio)
          return (<>
            <div style={{ color: 'var(--text-muted)', fontSize: 13, margin: '2px 0 16px' }}>{it?.name} · {prioLabel(modal.prio)} · {ps.length} פק״עות</div>
            <table style={tblStyle}>
              <thead><tr>{['פק״ע', 'כמות', 'סטטוס', 'זמן הרכבה', 'ליקוט', 'התחלה'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
              <tbody>{ps.map((p, k) => (
                <tr key={k}>
                  <td style={{ ...tdStyle, fontFamily: 'var(--mono)', fontSize: 12 }}>{p.production}</td>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>{p.qty}</td>
                  <td style={tdStyle}><span style={badge(STATUS_COLOR[p.decoded] || 'violet')}>{p.decoded}</span></td>
                  <td style={{ ...tdStyle, fontFamily: 'var(--mono)' }}>{p.runtime}</td>
                  <td style={tdStyle}>{p.components_in_station === 'Yes' ? '✓ לוקט' : '◌ ממתין'}</td>
                  <td style={{ ...tdStyle, fontFamily: 'var(--mono)', fontSize: 11 }}>{p.start_date || '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </>)
        })() : (() => {
          const locs = (it?.locs || []).filter(l => Number(l.physical_inventory) > 0 || Number(l.total_available) > 0)
          return (<>
            <div style={{ color: 'var(--text-muted)', fontSize: 13, margin: '2px 0 14px' }}>{it?.name} · מלאי כולל {it?.stock} · פירוט לפי מיקום</div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
              <span><span style={stkBadge(it.color)}>{it.stock}</span> מלאי</span>
              <span>מינימום: <b>{it.min}</b></span><span>מקסימום: <b>{it.max}</b></span>
              <span><span style={badge(it.color)}>{COLORS[it.color].label}</span></span>
            </div>
            {locs.length ? (
              <table style={tblStyle}>
                <thead><tr>{['מחסן', 'מיקום', 'פיזי', 'זמין'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
                <tbody>{locs.map((l, k) => (
                  <tr key={k}><td style={{ ...tdStyle, fontFamily: 'var(--mono)' }}>{l.warehouse}</td><td style={{ ...tdStyle, fontFamily: 'var(--mono)' }}>{l.location}</td><td style={tdStyle}>{l.physical_inventory}</td><td style={{ ...tdStyle, fontWeight: 700 }}>{l.total_available}</td></tr>
                ))}</tbody>
              </table>
            ) : <p style={{ color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center' }}>אין יתרת מלאי במיקומים</p>}
          </>)
        })()}
      </div>
    </div>
  )
}

function SectionTitle({ icon, title, sub, top }) {
  return (
    <div style={{ marginTop: top ? 30 : 0, paddingTop: top ? 22 : 0, borderTop: top ? '2px solid var(--border-card)' : 'none' }}>
      <div style={{ fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 9, color: 'var(--text-main)' }}>
        <span style={{ width: 26, height: 26, background: '#185FA5', color: '#fff', borderRadius: 7, display: 'grid', placeItems: 'center', fontSize: 14 }}>{icon}</span>{title}
      </div>
      <div style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 14px' }}>{sub}</div>
    </div>
  )
}

const exportBtnStyle = { padding: '8px 14px', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '0.5px solid #1A6E3A', background: '#EAF3DE', color: '#1A6E3A', display: 'inline-flex', alignItems: 'center', gap: 6 }
// ── styles ──
const panelStyle = { background: 'var(--bg-card)', border: '0.5px solid var(--border-card)', borderRadius: 14, padding: '20px 22px' }
const ctrlStyle = { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }
const selStyle = { border: '0.5px solid var(--border-card)', borderRadius: 9, padding: '8px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }
const tblStyle = { width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }
const thStyle = { textAlign: 'right', padding: '9px 12px', borderBottom: '1.5px solid var(--border-tbl)', background: '#F4F6F9', fontWeight: 600, fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }
const tdStyle = { textAlign: 'right', padding: '9px 12px', borderBottom: '1px solid var(--border-tbl)', whiteSpace: 'nowrap' }
const mxTh = { border: '1px solid var(--border-card)', textAlign: 'center', padding: '9px 11px', fontWeight: 600 }
const mxTd = { border: '1px solid var(--border-card)', textAlign: 'center', padding: '9px 11px' }
const planTh = (txt) => ({ border: '1px solid #CDDAE6', padding: '8px 12px', background: '#2B6CA3', color: '#fff', fontWeight: 600, fontSize: 12.5, textAlign: txt ? 'right' : 'center', whiteSpace: 'nowrap' })
const planTd = { border: '1px solid #CDDAE6', padding: '8px 12px', textAlign: 'center', whiteSpace: 'nowrap' }
const chipStyle = (on) => ({ border: '0.5px solid ' + (on ? 'var(--text-main)' : 'var(--border-card)'), background: on ? '#1A1A1A' : '#F7F9FB', color: on ? '#fff' : 'var(--text-muted)', borderRadius: 100, padding: '6px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' })
const badge = (c) => ({ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 100, color: COLORS[c].t, background: COLORS[c].bg })
const stkBadge = (c) => ({ fontWeight: 800, fontSize: 15, display: 'inline-block', minWidth: 36, textAlign: 'center', padding: '2px 8px', borderRadius: 7, color: COLORS[c].t, background: COLORS[c].bg })
const stkMini = (c) => ({ fontFamily: 'var(--mono)', fontSize: 11, padding: '1px 6px', borderRadius: 5, fontWeight: 600, color: COLORS[c].t, background: COLORS[c].bg })
const famTag = (f) => ({ fontSize: 11, padding: '2px 9px', borderRadius: 6, background: f === FIRE ? '#A32D2D' : '#EEF1F5', color: f === FIRE ? '#fff' : '#556' })
