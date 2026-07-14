import { useState, useEffect, useMemo } from 'react'
import { fmt } from '../utils/helpers'
import { classifyOrder, buildLookups } from '../utils/classify'

const MONTHS_HE = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
const DOW_HE = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'] // ראשון → שבת

// מיפוי שם/קוד מדינה → ISO alpha-2 עבור Nager.Date
const COUNTRY_ISO = {
  israel: 'IL', italy: 'IT', italia: 'IT', france: 'FR', germany: 'DE', deutschland: 'DE',
  spain: 'ES', 'españa': 'ES', portugal: 'PT', netherlands: 'NL', holland: 'NL', belgium: 'BE',
  'united kingdom': 'GB', uk: 'GB', 'great britain': 'GB', england: 'GB', ireland: 'IE',
  switzerland: 'CH', austria: 'AT', poland: 'PL', 'czech republic': 'CZ', czechia: 'CZ',
  greece: 'GR', sweden: 'SE', norway: 'NO', denmark: 'DK', finland: 'FI', hungary: 'HU',
  romania: 'RO', bulgaria: 'BG', croatia: 'HR', slovenia: 'SI', slovakia: 'SK',
  'united states': 'US', usa: 'US', us: 'US', canada: 'CA', mexico: 'MX', brazil: 'BR', brasil: 'BR',
  turkey: 'TR', 'türkiye': 'TR', russia: 'RU', ukraine: 'UA', luxembourg: 'LU',
  china: 'CN', india: 'IN', japan: 'JP', australia: 'AU', 'south africa': 'ZA',
}

function isoFromCountry(c) {
  if (!c) return null
  const s = String(c).trim()
  if (/^[A-Za-z]{2}$/.test(s)) return s.toUpperCase() // כבר קוד ISO
  return COUNTRY_ISO[s.toLowerCase()] || null
}

// שם המדינה (לתצוגה) לפי קוד ISO
const ISO_NAME_HE = {
  IL: 'ישראל', IT: 'איטליה', FR: 'צרפת', DE: 'גרמניה', ES: 'ספרד', PT: 'פורטוגל',
  NL: 'הולנד', BE: 'בלגיה', GB: 'בריטניה', IE: 'אירלנד', CH: 'שווייץ', AT: 'אוסטריה',
  PL: 'פולין', CZ: "צ'כיה", GR: 'יוון', SE: 'שוודיה', NO: 'נורווגיה', DK: 'דנמרק',
  FI: 'פינלנד', HU: 'הונגריה', RO: 'רומניה', BG: 'בולגריה', HR: 'קרואטיה', SI: 'סלובניה',
  SK: 'סלובקיה', US: 'ארה"ב', CA: 'קנדה', MX: 'מקסיקו', BR: 'ברזיל', TR: 'טורקיה',
  LU: 'לוקסמבורג', CN: 'סין', IN: 'הודו', JP: 'יפן', AU: 'אוסטרליה', ZA: 'דרום אפריקה',
}

// תאריך → 'YYYY-MM-DD' (מקומי, ללא הסטת UTC)
function ymd(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export default function ShipmentPlanView({
  salesOrders = [], customers = [], production = [], allocation = [],
  purchaseOrders = [], dr4 = [], dr5 = [], procurementNotes = {}
}) {
  const today = new Date()
  const [ym, setYm] = useState({ y: today.getFullYear(), m: today.getMonth() })
  const [sel, setSel] = useState(null) // { date, customer }
  const [ilHol, setIlHol] = useState({}) // { 'YYYY-MM-DD': [titles] }
  const [euHol, setEuHol] = useState({}) // { ISO: { 'YYYY-MM-DD': [titles] } }
  const [holLoading, setHolLoading] = useState(false)

  const monthKey = `${ym.y}-${String(ym.m + 1).padStart(2, '0')}`

  // לקוח (account + name) → קוד מדינה
  const custCountry = useMemo(() => {
    const m = {}
    customers.forEach(c => {
      const iso = isoFromCountry(c.country)
      if (!iso) return
      if (c.customer_account) m[c.customer_account] = iso
      if (c.name) m[c.name] = iso
    })
    return m
  }, [customers])

  function orderCountry(o) {
    return custCountry[o.customer_account] || custCountry[o.customer_name] || null
  }

  // container_date → customer → [orders]
  const byDate = useMemo(() => {
    const m = {}
    salesOrders.forEach(o => {
      if (!o.container_date) return
      const d = String(o.container_date).slice(0, 10)
      if (!m[d]) m[d] = {}
      const cust = o.customer_name || o.customer_account || '—'
      if (!m[d][cust]) m[d][cust] = []
      m[d][cust].push(o)
    })
    return m
  }, [salesOrders])

  // מדינות ייחודיות שיש להן משלוח בחודש המוצג (לצורך משיכת חגים)
  const monthCountries = useMemo(() => {
    const set = new Set()
    Object.keys(byDate).forEach(d => {
      if (d.slice(0, 7) !== monthKey) return
      Object.values(byDate[d]).flat().forEach(o => {
        const iso = orderCountry(o)
        if (iso && iso !== 'IL') set.add(iso)
      })
    })
    return [...set]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byDate, monthKey, custCountry])

  // חגי ישראל — Hebcal (פעם בשנה)
  useEffect(() => {
    let cancelled = false
    const url = `https://www.hebcal.com/hebcal?v=1&cfg=json&year=${ym.y}&month=x&maj=on&mod=on&mf=off&min=off&nx=off&ss=off&geo=none&lg=h`
    fetch(url)
      .then(r => r.json())
      .then(json => {
        if (cancelled) return
        const m = {}
        ;(json.items || []).forEach(it => {
          const d = String(it.date).slice(0, 10)
          if (!m[d]) m[d] = []
          if (!m[d].includes(it.title)) m[d].push(it.title)
        })
        setIlHol(m)
      })
      .catch(() => { if (!cancelled) setIlHol({}) })
    return () => { cancelled = true }
  }, [ym.y])

  // חגי אירופה/מדינות — Nager.Date (לכל מדינה בחודש)
  useEffect(() => {
    let cancelled = false
    const missing = monthCountries.filter(iso => !euHol[iso])
    if (missing.length === 0) return
    setHolLoading(true)
    Promise.all(missing.map(iso =>
      fetch(`https://date.nager.at/api/v3/PublicHolidays/${ym.y}/${iso}`)
        .then(r => r.ok ? r.json() : [])
        .then(arr => ({ iso, arr }))
        .catch(() => ({ iso, arr: [] }))
    )).then(results => {
      if (cancelled) return
      setEuHol(prev => {
        const next = { ...prev }
        results.forEach(({ iso, arr }) => {
          const m = {}
          ;(arr || []).forEach(h => {
            const d = String(h.date).slice(0, 10)
            if (!m[d]) m[d] = []
            m[d].push(h.localName || h.name)
          })
          next[iso] = m
        })
        return next
      })
      setHolLoading(false)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthCountries, ym.y])

  // חגי מדינה ליום מסוים — רק למדינות שיש להן לקוח באותו יום
  function countryHolidaysForDay(dateStr) {
    const cell = byDate[dateStr]
    if (!cell) return []
    const isos = new Set()
    Object.values(cell).flat().forEach(o => {
      const iso = orderCountry(o)
      if (iso && iso !== 'IL') isos.add(iso)
    })
    const out = []
    isos.forEach(iso => {
      const hols = euHol[iso]?.[dateStr]
      if (hols && hols.length) {
        out.push({ iso, name: ISO_NAME_HE[iso] || iso, titles: hols })
      }
    })
    return out
  }

  const lookups = useMemo(() => buildLookups(production, dr4, dr5), [production, dr4, dr5])

  // בניית תאי הלוח
  const firstDow = new Date(ym.y, ym.m, 1).getDay() // 0=ראשון
  const daysInMonth = new Date(ym.y, ym.m + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const todayStr = ymd(today.getFullYear(), today.getMonth(), today.getDate())

  function prevMonth() {
    setSel(null)
    setYm(({ y, m }) => m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 })
  }
  function nextMonth() {
    setSel(null)
    setYm(({ y, m }) => m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 })
  }
  function goToday() {
    setSel(null)
    setYm({ y: today.getFullYear(), m: today.getMonth() })
  }

  // סה"כ משלוחים בחודש
  const monthShipCount = useMemo(() => {
    let cnt = 0
    Object.keys(byDate).forEach(d => {
      if (d.slice(0, 7) === monthKey) cnt += Object.keys(byDate[d]).length
    })
    return cnt
  }, [byDate, monthKey])

  return (
    <div>
      <div className="page-heading">תוכנית משלוחים</div>

      {/* Header: month nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={nextMonth} style={navBtn}>‹</button>
          <div style={{ fontSize: 18, fontWeight: 600, minWidth: 150, textAlign: 'center' }}>
            {MONTHS_HE[ym.m]} {ym.y}
          </div>
          <button onClick={prevMonth} style={navBtn}>›</button>
          <button onClick={goToday} style={{ ...navBtn, width: 'auto', padding: '0 12px', fontSize: 13 }}>היום</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, color: 'var(--text-muted)' }}>
          {holLoading && <span>טוען חגים...</span>}
          <span>🚢 {monthShipCount} משלוחים החודש</span>
        </div>
      </div>

      {/* Weekday header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 6 }}>
        {DOW_HE.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', padding: '4px 0' }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
        {cells.map((d, i) => {
          if (d === null) return <div key={`e${i}`} style={{ minHeight: 96 }} />
          const dateStr = ymd(ym.y, ym.m, d)
          const cell = byDate[dateStr] || {}
          const custNames = Object.keys(cell)
          const ilHolidays = ilHol[dateStr] || []
          const cHolidays = countryHolidaysForDay(dateStr)
          const isToday = dateStr === todayStr
          const isSelDate = sel?.date === dateStr

          return (
            <div key={dateStr} style={{
              minHeight: 96, borderRadius: 10, padding: '6px 7px',
              border: '0.5px solid ' + (isSelDate ? 'var(--border-accent)' : 'var(--border)'),
              background: isToday ? 'var(--bg-accent)' : 'var(--surface-1)',
              display: 'flex', flexDirection: 'column', gap: 4, overflow: 'hidden'
            }}>
              {/* Day number + holiday markers */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: isToday ? 700 : 500, color: isToday ? 'var(--blue-dark)' : 'var(--text-main)' }}>{d}</span>
                <span style={{ display: 'flex', gap: 2 }}>
                  {ilHolidays.length > 0 && <span title={ilHolidays.join(', ')}>🇮🇱</span>}
                  {cHolidays.map(ch => (
                    <span key={ch.iso} title={`${ch.name}: ${ch.titles.join(', ')}`} style={{ fontSize: 11 }}>🎌</span>
                  ))}
                </span>
              </div>

              {/* Israel holiday label */}
              {ilHolidays.length > 0 && (
                <div style={{ fontSize: 9, color: '#b45309', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {ilHolidays[0]}
                </div>
              )}
              {/* Country holiday labels */}
              {cHolidays.map(ch => (
                <div key={ch.iso} style={{ fontSize: 9, color: '#7c3aed', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {ch.name}: {ch.titles[0]}
                </div>
              ))}

              {/* Customer chips */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 2 }}>
                {custNames.map(cn => {
                  const active = sel?.date === dateStr && sel?.customer === cn
                  return (
                    <button key={cn} onClick={() => setSel(active ? null : { date: dateStr, customer: cn })}
                      title={cn}
                      style={{
                        fontSize: 10.5, textAlign: 'right', padding: '3px 6px', borderRadius: 6,
                        border: '0.5px solid ' + (active ? 'var(--blue-dark)' : 'var(--border-tbl)'),
                        background: active ? 'var(--blue-dark)' : 'var(--blue-bg)',
                        color: active ? '#fff' : 'var(--blue-dark)',
                        cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        fontWeight: 500
                      }}>
                      {cn}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Detail panel */}
      {sel && (
        <ShipmentDetail
          sel={sel} monthKey={monthKey}
          salesOrders={salesOrders} allocation={allocation} purchaseOrders={purchaseOrders}
          procurementNotes={procurementNotes} lookups={lookups} dr4={dr4} dr5={dr5}
          onClose={() => setSel(null)}
        />
      )}

      {/* Legend */}
      <div style={{ marginTop: '1.25rem', fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <span>🇮🇱 חג ישראלי</span>
        <span>🎌 חג במדינת לקוח</span>
        <span>🔴 חוסר רכש</span>
        <span>🟣 חוסר ייצור</span>
      </div>
    </div>
  )
}

const navBtn = {
  width: 34, height: 34, borderRadius: 8, border: '0.5px solid var(--border)',
  background: 'var(--surface-1)', cursor: 'pointer', fontSize: 18, fontWeight: 600,
  color: 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'center'
}

// ============ Detail panel ============
function ShipmentDetail({ sel, monthKey, salesOrders, allocation, purchaseOrders, procurementNotes, lookups, dr4, dr5, onClose }) {
  const { productionMap, dr4ByParent, dr5ByParent } = lookups

  // בלוק א' — משובץ לקונטיינר בתאריך שנבחר
  const containerRows = useMemo(() =>
    salesOrders.filter(o =>
      (o.customer_name === sel.customer || o.customer_account === sel.customer) &&
      String(o.container_date || '').slice(0, 10) === sel.date
    ), [salesOrders, sel])

  // בלוק ב' — טרם שובץ: אותו לקוח, confirmed_ship_date בחודש המוצג, ללא container_date
  const unassignedRows = useMemo(() =>
    salesOrders.filter(o =>
      (o.customer_name === sel.customer || o.customer_account === sel.customer) &&
      !o.container_date &&
      String(o.confirmed_ship_date || '').slice(0, 7) === monthKey
    ), [salesOrders, sel, monthKey])

  const sumRemaining = rows => rows.reduce((s, r) => s + (r.remaining_amount || 0), 0)

  return (
    <div className="section-box" style={{ marginTop: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>
          {sel.customer} · {sel.date}
        </div>
        <button onClick={onClose} style={{ fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>✕ סגור</button>
      </div>

      {/* בלוק א' */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--blue-dark)', marginBottom: 8 }}>
          📦 משובץ לקונטיינר {sel.date} — {containerRows.length} שורות · ${fmt(sumRemaining(containerRows))}
        </div>
        {containerRows.length === 0
          ? <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '6px 0' }}>אין שורות משובצות לתאריך זה</div>
          : <OrderTable rows={containerRows} dateField="container_date"
              allocation={allocation} purchaseOrders={purchaseOrders} procurementNotes={procurementNotes}
              productionMap={productionMap} dr4ByParent={dr4ByParent} dr5ByParent={dr5ByParent}
              salesOrders={salesOrders} />}
      </div>

      {/* בלוק ב' */}
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--red-dark)', marginBottom: 8 }}>
          ⚠️ טרם שובץ למשלוח — תאריך אספקה בחודש {monthKey} · {unassignedRows.length} שורות · ${fmt(sumRemaining(unassignedRows))}
        </div>
        {unassignedRows.length === 0
          ? <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '6px 0' }}>כל השורות של הלקוח לחודש זה כבר משובצות ✓</div>
          : <OrderTable rows={unassignedRows} dateField="confirmed_ship_date"
              allocation={allocation} purchaseOrders={purchaseOrders} procurementNotes={procurementNotes}
              productionMap={productionMap} dr4ByParent={dr4ByParent} dr5ByParent={dr5ByParent}
              salesOrders={salesOrders} />}
      </div>
    </div>
  )
}

// ============ Order table with status + shortage drill-down ============
function OrderTable({ rows, dateField, allocation, purchaseOrders, procurementNotes, productionMap, dr4ByParent, dr5ByParent, salesOrders }) {
  const [openShortage, setOpenShortage] = useState(null)

  const soConfirmedDate = useMemo(() => {
    const m = {}
    salesOrders.forEach(o => { m[o.sales_order] = o.confirmed_ship_date })
    return m
  }, [salesOrders])

  const allocByNumber = useMemo(() => {
    const m = {}
    allocation.forEach(a => {
      if (!m[a.number]) m[a.number] = []
      m[a.number].push(a)
    })
    return m
  }, [allocation])

  function getShortages(doc) {
    return allocation.filter(a =>
      a.number === doc && a.reference === 'Sales order' &&
      a.shortage_exist === 'Yes' && a.missing_qty > 0
    )
  }

  function bestPO(itemNumber) {
    const candidates = purchaseOrders.filter(p =>
      p.item_number === String(itemNumber) && p.deliver_remainder > 0
    )
    return candidates.sort((a, b) => {
      const da = a.confirmed_receipt_date || a.requested_receipt_date || '9999'
      const db = b.confirmed_receipt_date || b.requested_receipt_date || '9999'
      return da.localeCompare(db)
    })[0] || null
  }

  const DONE = ['Ended', 'Reported as finished']
  const CS = { padding: '4px 8px', whiteSpace: 'nowrap', fontSize: 11, textAlign: 'right' }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ fontSize: 12, width: '100%' }}>
        <thead>
          <tr>
            {['חוסר', 'הזמנה', 'שורה', 'מק"ט', 'קבוצה', 'סטטוס', dateField === 'container_date' ? 'ת. קונטיינר' : 'ת. אספקה', 'סכום'].map(h => (
              <th key={h} style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-muted)', borderBottom: '0.5px solid var(--border-tbl)', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const status = classifyOrder(r, productionMap, dr4ByParent, dr5ByParent)
            const shortages = getShortages(r.sales_order)
            const hasShortage = shortages.length > 0
            const key = `${r.sales_order}-${r.line_number}`
            const isOpen = openShortage === key
            const hasPurch = shortages.some(s => s.default_order_type === 'Purchase order' || !s.default_order_type)
            const hasProd = shortages.some(s => s.default_order_type === 'Production')

            return (
              <>
                <tr key={i} style={{ background: i % 2 === 0 ? 'var(--bg-row)' : 'var(--bg-card)' }}>
                  <td style={{ padding: '6px 8px', borderBottom: '0.5px solid var(--border-tbl)', textAlign: 'center' }}>
                    {hasShortage && (
                      <button onClick={() => setOpenShortage(isOpen ? null : key)} title="לחץ לפירוט חוסרים"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, padding: 0 }}>
                        {hasProd && !hasPurch ? '🟣' : !hasProd && hasPurch ? '🔴' : '🟣🔴'}
                      </button>
                    )}
                  </td>
                  <td style={{ ...CS, borderBottom: '0.5px solid var(--border-tbl)' }}>{r.sales_order}</td>
                  <td style={{ ...CS, borderBottom: '0.5px solid var(--border-tbl)' }}>{r.line_number}</td>
                  <td style={{ ...CS, borderBottom: '0.5px solid var(--border-tbl)' }}>{r.item_number}</td>
                  <td style={{ ...CS, borderBottom: '0.5px solid var(--border-tbl)' }}>{r.item_group}</td>
                  <td style={{ ...CS, borderBottom: '0.5px solid var(--border-tbl)' }}>
                    <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 5, background: 'var(--surface-2)', border: '0.5px solid var(--border-tbl)' }}>{status}</span>
                  </td>
                  <td style={{ ...CS, borderBottom: '0.5px solid var(--border-tbl)' }}>{String(r[dateField] || '').slice(0, 10) || '—'}</td>
                  <td style={{ ...CS, borderBottom: '0.5px solid var(--border-tbl)', fontWeight: 500 }}>${fmt(r.remaining_amount || 0)}</td>
                </tr>

                {isOpen && (
                  <tr key={key + '-sh'}>
                    <td colSpan={8} style={{ padding: '8px 12px', background: '#fefcf8', borderBottom: '0.5px solid var(--border-tbl)' }}>
                      {(() => {
                        const purchItems = shortages.filter(s => s.default_order_type === 'Purchase order' || !s.default_order_type)
                        const prodItems = shortages.filter(s => s.default_order_type === 'Production')
                        return (
                          <>
                            {/* חוסרי ייצור */}
                            {prodItems.length > 0 && (() => {
                              const mainPrd = r.production_number
                              const subOrders = [
                                ...(dr4ByParent[mainPrd] || []).filter(d => !DONE.includes(d.status)).map(d => ({ ...d, type: 'עב"ש' })),
                                ...(dr5ByParent[mainPrd] || []).filter(d => !DONE.includes(d.status)).map(d => ({ ...d, type: 'צבע' }))
                              ]
                              const withShortage = subOrders.filter(sub => (allocByNumber[sub.production_order] || []).some(a => a.missing_qty > 0))
                              return (
                                <div style={{ marginBottom: purchItems.length ? 12 : 0 }}>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: '#6B21A8', marginBottom: 4 }}>
                                    🟣 חוסרי ייצור — הזמנה {r.sales_order} · פק"ע ראשית: {mainPrd || '—'}
                                  </div>
                                  {withShortage.length === 0
                                    ? <div style={{ fontSize: 11, color: '#888', padding: '4px 8px' }}>אין תת-פק"עות עם חוסרים פעילים</div>
                                    : withShortage.map((sub, si) => {
                                      const subAlloc = (allocByNumber[sub.production_order] || []).filter(a => a.missing_qty > 0)
                                      return (
                                        <div key={si} style={{ marginBottom: 8, padding: '6px 8px', background: sub.type === 'עב"ש' ? '#fef3c7' : '#ede9fe', borderRadius: 6, border: `0.5px solid ${sub.type === 'עב"ש' ? '#d97706' : '#7c3aed'}` }}>
                                          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: sub.type === 'עב"ש' ? '#92400e' : '#6B21A8' }}>
                                            {sub.type === 'עב"ש' ? '🔧 עב"ש' : '🎨 צבע'} — פק"ע: {sub.production_order} · {sub.item_number} · סטטוס: {sub.status}
                                          </div>
                                          <table style={{ fontSize: 10, width: '100%', borderCollapse: 'collapse' }}>
                                            <thead><tr>{['מק"ט', 'שם פריט', 'כמות חסרה', 'הזמנת רכש', 'ספק', 'ת. אספקה', 'סטטוס'].map(h => (
                                              <th key={h} style={{ ...CS, fontSize: 10, color: '#666', borderBottom: '0.5px solid #ddd', fontWeight: 600 }}>{h}</th>
                                            ))}</tr></thead>
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

                            {/* חוסרי רכש */}
                            {purchItems.length > 0 && (
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--red-dark)', marginBottom: 6 }}>🔴 חוסרי רכש — הזמנה {r.sales_order}</div>
                                <table style={{ fontSize: 11, width: '100%', borderCollapse: 'collapse' }}>
                                  <thead><tr>{['מק"ט', 'שם פריט', 'כמות חסרה', 'תאריך נדרש', 'הזמנת רכש', 'ספק', 'ת. אספקה', 'סטטוס'].map(h => (
                                    <th key={h} style={{ ...CS, color: 'var(--text-muted)', borderBottom: '0.5px solid var(--border-tbl)', fontWeight: 600 }}>{h}</th>
                                  ))}</tr></thead>
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
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </>
                        )
                      })()}
                    </td>
                  </tr>
                )}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
