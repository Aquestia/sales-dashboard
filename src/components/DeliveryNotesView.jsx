import { useState, useEffect } from 'react'
import { fmt } from '../utils/helpers'
import { fetchSalesFiles, fetchDeliveryNotes } from '../utils/db'

// שערי ברירת מחדל (משמשים רק אם משיכת השער החי נכשלת)
const FALLBACK = { usdIls: 3.70, eurIls: 4.00 }

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

  const enriched = rows.map(r => ({ ...r, usd: toUSD(r) }))

  // ─── מלבנים ───
  const totalUsd = enriched.reduce((s, r) => s + r.usd, 0)
  const intRows  = enriched.filter(r => r.cat === 'Internal')
  const extRows  = enriched.filter(r => r.cat === 'External')
  const intUsd   = intRows.reduce((s, r) => s + r.usd, 0)
  const extUsd   = extRows.reduce((s, r) => s + r.usd, 0)

  // ─── סינון ───
  let filtered = catFilter === 'all' ? enriched : enriched.filter(r => r.cat === catFilter)
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
      </div>

      {/* טבלה מחולקת לפי לקוחות */}
      <div style={{ overflowX: 'auto', background: 'var(--bg-card)', border: '0.5px solid var(--border-card)', borderRadius: 12, padding: '1rem 1.1rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 28 }}></th>
              <th style={th}>לקוח</th>
              <th style={th}>סוג</th>
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
        <td style={td}>{g.cnt}</td>
        <td style={{ ...td, textAlign: 'left', fontWeight: 600 }}>${fmt(g.usd)}</td>
      </tr>
      {open && (
        <tr>
          <td></td>
          <td colSpan={4} style={{ padding: '0 8px 10px' }}>
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
