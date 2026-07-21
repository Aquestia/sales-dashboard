import { useState, useEffect } from 'react'
import { fmt, marketSegmentByCurrency, MARKET_LABELS, MARKET_COLORS, MARKET_KEYS } from '../utils/helpers'
import * as XLSX from 'xlsx-js-style'
import { fetchSalesFiles, fetchDeliveryNotes } from '../utils/db'

// שערי ברירת מחדל (משמשים רק אם משיכת השער החי נכשלת)
const FALLBACK = { usdIls: 3.70, eurIls: 4.00 }


// ── ייצוא אקסל מעוצב: כל שורות תעודות המשלוח לפי סטטוס (שוק + פנימי/חיצוני) ──
const XL_HEAD_FILL = 'FF2B6CA3'
const _argb = hex => 'FF' + String(hex).replace('#', '').toUpperCase()
function _xlThin() {
  const s = { style: 'thin', color: { rgb: 'FFCDDAE6' } }
  return { top: s, bottom: s, left: s, right: s }
}
const DN_COLS = [
  { h: 'לקוח', w: 32, align: 'right' },
  { h: 'סוג', w: 10, align: 'center' },
  { h: 'שוק', w: 12, align: 'center' },
  { h: 'הזמנה', w: 14, align: 'center' },
  { h: 'שורה', w: 7, align: 'center' },
  { h: 'מק"ט', w: 16, align: 'center' },
  { h: 'תאריך משלוח', w: 13, align: 'center' },
  { h: 'כמות', w: 9, align: 'center' },
  { h: 'מטבע', w: 8, align: 'center' },
  { h: "מחיר יח'", w: 11, align: 'center' },
  { h: 'סכום $', w: 13, align: 'center' },
]
const DN_MONEY_C = 10
const DN_COUNT_C = 7

function exportDeliveryNotesExcel(enriched) {
  if (!enriched || enriched.length === 0) return
  const catLabel = c => c === 'Internal' ? 'פנימי' : 'חיצוני'
  const blank = () => DN_COLS.map(() => '')
  const aoa = []
  const meta = []
  const push = (arr, kind, seg) => { aoa.push(arr); meta.push({ kind, seg }) }
  const sumUsd = arr => Math.round(arr.reduce((s, r) => s + (r.usd || 0), 0))

  // כותרת
  const title = blank(); title[0] = 'תעודות משלוח ללא חשבוניות — ייצוא לפי סטטוס'
  push(title, 'title')
  push(blank(), 'blank')

  // סיכום לפי שוק
  const sh1 = blank(); sh1[0] = 'סיכום לפי שוק'; push(sh1, 'sumhead')
  MARKET_KEYS.forEach(k => {
    const g = enriched.filter(r => r.seg === k)
    const row = blank(); row[0] = MARKET_LABELS[k]; row[DN_COUNT_C] = g.length; row[DN_MONEY_C] = sumUsd(g)
    push(row, 'sumrow')
  })
  // סיכום לפי סוג
  const sh2 = blank(); sh2[0] = 'סיכום לפי סוג'; push(sh2, 'sumhead')
  ;['Internal', 'External'].forEach(c => {
    const g = enriched.filter(r => r.cat === c)
    const row = blank(); row[0] = catLabel(c); row[DN_COUNT_C] = g.length; row[DN_MONEY_C] = sumUsd(g)
    push(row, 'sumrow')
  })
  const gs = blank(); gs[0] = 'סה"כ כללי'; gs[DN_COUNT_C] = enriched.length; gs[DN_MONEY_C] = sumUsd(enriched)
  push(gs, 'grand')
  push(blank(), 'blank')

  // כותרת טבלת פירוט
  push(DN_COLS.map(c => c.h), 'header')

  // קבוצות לפי שוק, מיון פנימי→חיצוני ואז לקוח
  MARKET_KEYS.forEach(k => {
    const g = enriched.filter(r => r.seg === k).sort((a, b) =>
      a.cat === b.cat ? String(a.customer || '').localeCompare(String(b.customer || ''), 'he') : (a.cat === 'Internal' ? -1 : 1))
    if (g.length === 0) return
    const gh = blank(); gh[0] = MARKET_LABELS[k] + ' — ' + g.length + ' תעודות'
    push(gh, 'group', k)
    g.forEach(r => {
      push([
        r.customer || '', catLabel(r.cat), MARKET_LABELS[r.seg] || '',
        r.sales_order || '', r.line_number ?? '', r.item_number || '',
        r.ship_date || '', r.quantity ?? '', r.currency || '',
        (r.unit_price ?? '') === '' ? '' : Number(r.unit_price),
        Math.round(r.usd || 0),
      ], 'row', k)
    })
    const sub = blank(); sub[0] = 'סה"כ ' + MARKET_LABELS[k]; sub[DN_COUNT_C] = g.length; sub[DN_MONEY_C] = sumUsd(g)
    push(sub, 'subtotal', k)
  })
  const grand = blank(); grand[0] = 'סה"כ כללי'; grand[DN_COUNT_C] = enriched.length; grand[DN_MONEY_C] = sumUsd(enriched)
  push(grand, 'grand')

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = DN_COLS.map(c => ({ wch: c.w }))
  ws['!views'] = [{ rightToLeft: true }]
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: DN_COLS.length - 1 } }]
  const headerRowIdx = meta.findIndex(m => m.kind === 'header')
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: headerRowIdx, c: 0 }, e: { r: headerRowIdx, c: DN_COLS.length - 1 } }) }

  for (let r = 0; r < aoa.length; r++) {
    const { kind, seg } = meta[r]
    for (let c = 0; c < DN_COLS.length; c++) {
      const addr = XLSX.utils.encode_cell({ r, c })
      if (!ws[addr]) ws[addr] = { t: 's', v: '' }
      if (kind === 'blank') { ws[addr].s = { fill: { patternType: 'solid', fgColor: { rgb: 'FFFFFFFF' } } }; continue }
      let fill, font, align = DN_COLS[c].align
      if (kind === 'title')        { fill = 'FF1F4E78'; font = { bold: true, sz: 14, color: { rgb: 'FFFFFFFF' } }; align = 'center' }
      else if (kind === 'sumhead') { fill = 'FFDDE7F0'; font = { bold: true, sz: 11, color: { rgb: 'FF1F4E78' } }; align = c === 0 ? 'right' : 'center' }
      else if (kind === 'header')  { fill = XL_HEAD_FILL; font = { bold: true, sz: 11, color: { rgb: 'FFFFFFFF' } }; align = 'center' }
      else if (kind === 'group')   { fill = _argb(MARKET_COLORS[seg]); font = { bold: true, sz: 11, color: { rgb: 'FFFFFFFF' } }; align = c === 0 ? 'right' : 'center' }
      else if (kind === 'subtotal'){ fill = 'FFEFF3F8'; font = { bold: true, sz: 10.5, color: { rgb: 'FF333333' } } }
      else if (kind === 'grand')   { fill = 'FFD9E2EC'; font = { bold: true, sz: 11, color: { rgb: 'FF1F4E78' } } }
      else                         { fill = r % 2 === 0 ? 'FFF6F9FC' : 'FFFFFFFF'; font = { sz: 10.5, color: { rgb: 'FF333333' } } }
      ws[addr].s = {
        fill: { patternType: 'solid', fgColor: { rgb: fill } },
        font,
        alignment: { horizontal: align, vertical: 'center', readingOrder: 2, wrapText: kind === 'header' },
        border: _xlThin(),
      }
      if (c === DN_MONEY_C && typeof ws[addr].v === 'number') ws[addr].z = '"$"#,##0'
    }
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'תעודות משלוח')
  const today = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, 'תעודות_משלוח_לפי_סטטוס_' + today + '.xlsx', { bookType: 'xlsx' })
}

export default function DeliveryNotesView() {
  const [files, setFiles] = useState([])
  const [selectedFileId, setSelectedFileId] = useState(null)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  // שערי חליפין
  const [usdIls, setUsdIls] = useState(FALLBACK.usdIls)
  const [eurIls, setEurIls] = useState(FALLBACK.eurIls)
  const [rateInfo, setRateInfo] = useState({ source: '', time: '', loading: true, error: false })

  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [marketFilter, setMarketFilter] = useState('all')
  const [expanded, setExpanded] = useState({})   // { [customer]: true }

  // ─── טעינת קבצים ───
  useEffect(() => {
    fetchSalesFiles().then(fs => {
      setFiles(fs)
      if (fs.length > 0) setSelectedFileId(fs[0].id)
      else setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!selectedFileId) return
    setLoading(true)
    fetchDeliveryNotes(selectedFileId).then(dn => {
      setRows(dn)
      setLoading(false)
    })
  }, [selectedFileId])

  // ─── משיכת שער חליפין חי ───
  async function loadRates() {
    setRateInfo(p => ({ ...p, loading: true, error: false }))
    // מקור ראשי: open.er-api.com (חינמי, ללא מפתח)
    try {
      const r = await fetch('https://open.er-api.com/v6/latest/USD')
      const j = await r.json()
      if (j && j.rates && j.rates.ILS && j.rates.EUR) {
        const uIls = j.rates.ILS                    // ש"ח לכל 1$
        const eIls = j.rates.ILS / j.rates.EUR      // ש"ח לכל 1€
        setUsdIls(+uIls.toFixed(4)); setEurIls(+eIls.toFixed(4))
        setRateInfo({ source: 'open.er-api.com', time: new Date().toLocaleTimeString('he-IL'), loading: false, error: false })
        return
      }
      throw new Error('bad payload')
    } catch (e) {
      // גיבוי: frankfurter.app (ECB)
      try {
        const r2 = await fetch('https://api.frankfurter.app/latest?from=USD&to=ILS,EUR')
        const j2 = await r2.json()
        if (j2 && j2.rates && j2.rates.ILS && j2.rates.EUR) {
          const uIls = j2.rates.ILS
          const eIls = j2.rates.ILS / j2.rates.EUR
          setUsdIls(+uIls.toFixed(4)); setEurIls(+eIls.toFixed(4))
          setRateInfo({ source: 'frankfurter.app', time: new Date().toLocaleTimeString('he-IL'), loading: false, error: false })
          return
        }
        throw new Error('bad payload')
      } catch (e2) {
        setRateInfo({ source: 'ברירת מחדל', time: '', loading: false, error: true })
      }
    }
  }

  useEffect(() => { loadRates() }, [])

  // ─── המרה לדולר ───
  // ILS→$ = /usdIls · USD→$ = ×1 · EUR→$ = ×eurIls/usdIls
  function toUSD(r) {
    const base = (r.quantity || 0) * (r.unit_price || 0)
    const cur = String(r.currency || 'ILS').toUpperCase()
    const ilsRate = cur === 'ILS' ? 1 : cur === 'USD' ? usdIls : cur === 'EUR' ? eurIls : 1
    if (!usdIls) return 0
    return base * ilsRate / usdIls
  }

  const enriched = rows.map(r => ({ ...r, usd: toUSD(r), seg: marketSegmentByCurrency(r.currency, r.customer) }))

  // ─── מלבנים ───
  const totalUsd = enriched.reduce((s, r) => s + r.usd, 0)
  const intRows  = enriched.filter(r => r.cat === 'Internal')
  const extRows  = enriched.filter(r => r.cat === 'External')
  const intUsd   = intRows.reduce((s, r) => s + r.usd, 0)
  const extUsd   = extRows.reduce((s, r) => s + r.usd, 0)

  // פילוח שוק (לפי מטבע: ILS → מקומי)
  const mkt = { local: [], netafim: [], export: [] }
  enriched.forEach(r => { mkt[r.seg].push(r) })
  const mktUsd = k => mkt[k].reduce((s, r) => s + r.usd, 0)

  // ─── סינון ───
  let filtered = catFilter === 'all' ? enriched : enriched.filter(r => r.cat === catFilter)
  if (marketFilter !== 'all') filtered = filtered.filter(r => r.seg === marketFilter)
  if (search) {
    const q = search.toLowerCase()
    filtered = filtered.filter(r =>
      (r.customer || '').toLowerCase().includes(q) ||
      (r.sales_order || '').toLowerCase().includes(q) ||
      (r.item_number || '').toLowerCase().includes(q)
    )
  }

  // ─── קיבוץ לפי לקוח ───
  const byCust = {}
  filtered.forEach(r => {
    if (!byCust[r.customer]) byCust[r.customer] = { customer: r.customer, cat: r.cat, usd: 0, cnt: 0, lines: [] }
    byCust[r.customer].usd += r.usd
    byCust[r.customer].cnt += 1
    byCust[r.customer].lines.push(r)
  })
  const custGroups = Object.values(byCust).sort((a, b) => b.usd - a.usd)
  custGroups.forEach(g => { const set = new Set(g.lines.map(l => l.seg)); g.seg = set.size === 1 ? [...set][0] : 'mixed' })

  const th = { textAlign: 'right', padding: '7px 8px', color: 'var(--text-muted)', borderBottom: '0.5px solid var(--border-tbl)', whiteSpace: 'nowrap', fontWeight: 600, fontSize: 12 }
  const td = { padding: '6px 8px', borderBottom: '0.5px solid var(--border-tbl)', whiteSpace: 'nowrap', fontSize: 12 }

  return (
    <div>
      <div className="page-heading">דוח תעודות משלוח ללא חשבוניות</div>

      {/* בורר קובץ */}
      {files.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: 'var(--text-sub)', whiteSpace: 'nowrap' }}>קובץ פעיל:</span>
          {files.map(f => (
            <button key={f.id} onClick={() => setSelectedFileId(f.id)}
              style={{ padding: '6px 14px', borderRadius: 'var(--radius)', fontSize: 12,
                border: '0.5px solid ' + (selectedFileId === f.id ? 'var(--blue-dark)' : 'var(--border-card)'),
                background: selectedFileId === f.id ? 'var(--blue-bg)' : 'var(--bg-row)',
                color: selectedFileId === f.id ? 'var(--blue-dark)' : 'var(--text-main)',
                cursor: 'pointer', fontWeight: selectedFileId === f.id ? 600 : 400 }}>
              {f.batch_date} · {f.filename}
            </button>
          ))}
          {loading && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>טוען...</span>}
        </div>
      )}

      {/* פאנל שער חליפין */}
      <div className="section-box" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-sub)' }}>💱 שער חליפין</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <span style={{ color: 'var(--text-sub)' }}>1$ =</span>
              <input type="number" step="0.001" value={usdIls}
                onChange={e => setUsdIls(parseFloat(e.target.value) || 0)}
                style={{ width: 90, height: 32, textAlign: 'center' }} />
              <span style={{ color: 'var(--text-muted)' }}>₪</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <span style={{ color: 'var(--text-sub)' }}>1€ =</span>
              <input type="number" step="0.001" value={eurIls}
                onChange={e => setEurIls(parseFloat(e.target.value) || 0)}
                style={{ width: 90, height: 32, textAlign: 'center' }} />
              <span style={{ color: 'var(--text-muted)' }}>₪</span>
            </label>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, color: rateInfo.error ? 'var(--red-dark)' : 'var(--text-muted)' }}>
              {rateInfo.loading ? 'מושך שער...' :
                rateInfo.error ? '⚠ נכשלה משיכת שער — ערוך ידנית' :
                `מקור: ${rateInfo.source} · ${rateInfo.time}`}
            </span>
            <button onClick={loadRates} disabled={rateInfo.loading}
              style={{ padding: '6px 12px', borderRadius: 'var(--radius)', fontSize: 12,
                border: '0.5px solid var(--border-card)', background: 'var(--bg-row)',
                cursor: 'pointer', color: 'var(--text-sub)' }}>
              🔄 רענן שער
            </button>
          </div>
        </div>
      </div>

      {/* מלבנים */}
      <div className="kpi-row" style={{ marginBottom: '1.25rem' }}>
        {[
          { label: 'סה"כ תעודות משלוח', value: `$${fmt(totalUsd)}`, sub: `${enriched.length} תעודות`, color: '#2D7D46' },
          { label: 'לקוחות חיצוניים', value: `$${fmt(extUsd)}`, sub: `${extRows.length} תעודות`, color: 'var(--blue-dark)' },
          { label: 'לקוחות פנימיים', value: `$${fmt(intUsd)}`, sub: `${intRows.length} תעודות`, color: 'var(--amber-dark)' },
        ].map(k => (
          <div key={k.label} className="kpi-card" style={{ cursor: 'default', borderTop: `3px solid ${k.color}` }}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color: k.color }}>{k.value}</div>
            <div className="kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* פילוח שוק */}
      <div className="kpi-row" style={{ marginBottom: '1.25rem' }}>
        {MARKET_KEYS.map(k => (
          <div key={k} className="kpi-card" style={{ cursor: 'default', borderTop: `3px solid ${MARKET_COLORS[k]}` }}>
            <div className="kpi-label">{MARKET_LABELS[k]}</div>
            <div className="kpi-value" style={{ color: MARKET_COLORS[k] }}>${fmt(mktUsd(k))}</div>
            <div className="kpi-sub">{mkt[k].length} תעודות</div>
          </div>
        ))}
      </div>

      {/* חיפוש + סינון */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="חיפוש לפי לקוח / הזמנה / מק״ט..." style={{ width: 280 }} />
        {['all', 'External', 'Internal'].map(v => (
          <button key={v} onClick={() => setCatFilter(v)}
            style={{ padding: '7px 14px', borderRadius: 'var(--radius)',
              border: '0.5px solid ' + (catFilter === v ? 'var(--border-accent)' : 'var(--border)'),
              background: catFilter === v ? 'var(--bg-accent)' : 'var(--bg-card)',
              cursor: 'pointer', fontSize: 13 }}>
            {v === 'all' ? 'הכל' : v === 'Internal' ? 'פנימיים' : 'חיצוניים'}
          </button>
        ))}
        <span style={{ width:1, background:'var(--border)', margin:'0 4px' }} />
        {['all', ...MARKET_KEYS].map(v => (
          <button key={v} onClick={() => setMarketFilter(v)}
            style={{ padding: '7px 14px', borderRadius: 'var(--radius)',
              border: '0.5px solid ' + (marketFilter === v ? 'var(--border-accent)' : 'var(--border)'),
              background: marketFilter === v ? 'var(--bg-accent)' : 'var(--bg-card)',
              cursor: 'pointer', fontSize: 13,
              color: v !== 'all' ? MARKET_COLORS[v] : 'inherit' }}>
            {v === 'all' ? 'כל השווקים' : MARKET_LABELS[v]}
          </button>
        ))}
        <button onClick={() => exportDeliveryNotesExcel(enriched)} disabled={enriched.length === 0}
          style={{ marginInlineStart: 'auto', padding: '7px 16px', borderRadius: 'var(--radius)',
            border: '0.5px solid var(--border-card)', background: '#f0f8ec', color: '#2a7a1a',
            fontWeight: 600, fontSize: 13, cursor: enriched.length === 0 ? 'not-allowed' : 'pointer',
            opacity: enriched.length === 0 ? 0.5 : 1 }}>
          📥 ייצוא לאקסל (לפי סטטוס)
        </button>
      </div>

      {/* טבלה מחולקת לפי לקוחות */}
      <div style={{ overflowX: 'auto', background: 'var(--bg-card)', border: '0.5px solid var(--border-card)', borderRadius: 12, padding: '1rem 1.1rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 28 }}></th>
              <th style={th}>לקוח</th>
              <th style={th}>סוג</th>
              <th style={th}>שוק</th>
              <th style={th}>כמות תעודות</th>
              <th style={{ ...th, textAlign: 'left' }}>סכום ($)</th>
            </tr>
          </thead>
          <tbody>
            {custGroups.map((g, gi) => {
              const open = !!expanded[g.customer]
              return (
                <FragmentRows key={g.customer} g={g} gi={gi} open={open}
                  onToggle={() => setExpanded(p => ({ ...p, [g.customer]: !p[g.customer] }))}
                  th={th} td={td} />
              )
            })}
          </tbody>
          {custGroups.length > 0 && (
            <tfoot>
              <tr style={{ background: 'var(--blue-bg)', fontWeight: 700 }}>
                <td style={{ ...td, borderTop: '1px solid var(--blue-dark)' }}></td>
                <td style={{ ...td, borderTop: '1px solid var(--blue-dark)', color: 'var(--blue-dark)' }}>סה"כ</td>
                <td style={{ ...td, borderTop: '1px solid var(--blue-dark)' }}></td>
                <td style={{ ...td, borderTop: '1px solid var(--blue-dark)' }}></td>
                <td style={{ ...td, borderTop: '1px solid var(--blue-dark)', color: 'var(--blue-dark)' }}>{filtered.length}</td>
                <td style={{ ...td, borderTop: '1px solid var(--blue-dark)', textAlign: 'left', color: 'var(--blue-dark)' }}>${fmt(filtered.reduce((s, r) => s + r.usd, 0))}</td>
              </tr>
            </tfoot>
          )}
        </table>
        {custGroups.length === 0 && !loading && (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>אין תעודות משלוח לקובץ זה</div>
        )}
      </div>
    </div>
  )
}

// שורת לקוח + שורות פירוט נפתחות
function FragmentRows({ g, gi, open, onToggle, th, td }) {
  return (
    <>
      <tr onClick={onToggle}
        style={{ cursor: 'pointer', background: gi % 2 === 0 ? 'var(--bg-row)' : 'var(--bg-card)' }}>
        <td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }}>{open ? '▾' : '▸'}</td>
        <td style={{ ...td, fontWeight: 600 }}>{g.customer}</td>
        <td style={td}>
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10,
            background: g.cat === 'Internal' ? 'var(--amber-bg)' : 'var(--blue-bg)',
            color: g.cat === 'Internal' ? 'var(--amber-dark)' : 'var(--blue-dark)' }}>
            {g.cat === 'Internal' ? 'פנימי' : 'חיצוני'}
          </span>
        </td>
        <td style={td}>
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10,
            background: (g.seg === 'mixed' ? '#6B7280' : MARKET_COLORS[g.seg]) + '22',
            color: g.seg === 'mixed' ? '#6B7280' : MARKET_COLORS[g.seg] }}>
            {g.seg === 'mixed' ? 'מעורב' : MARKET_LABELS[g.seg]}
          </span>
        </td>
        <td style={td}>{g.cnt}</td>
        <td style={{ ...td, textAlign: 'left', fontWeight: 600 }}>${fmt(g.usd)}</td>
      </tr>
      {open && (
        <tr>
          <td></td>
          <td colSpan={5} style={{ padding: '0 8px 10px' }}>
            <div style={{ overflowX: 'auto', border: '0.5px solid var(--border-tbl)', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-row)' }}>
                    {['הזמנה', 'שורה', 'מק״ט', 'תאריך משלוח', 'כמות', 'מטבע', 'מחיר יח׳', 'סכום ($)'].map(h => (
                      <th key={h} style={{ ...th, borderBottom: '0.5px solid var(--border-tbl)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...g.lines].sort((a, b) => b.usd - a.usd).map((r, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-row)' }}>
                      <td style={td}>{r.sales_order}</td>
                      <td style={td}>{r.line_number}</td>
                      <td style={td}>{r.item_number}</td>
                      <td style={td}>{r.ship_date}</td>
                      <td style={td}>{fmt(r.quantity)}</td>
                      <td style={td}>{r.currency}</td>
                      <td style={td}>{r.unit_price?.toLocaleString('he-IL')}</td>
                      <td style={{ ...td, textAlign: 'left', fontWeight: 600 }}>${fmt(r.usd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
