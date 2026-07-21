export const fmt = n => Math.round(n).toLocaleString('he-IL')

export function isInternal(account) {
  return String(account || '').trim().toUpperCase().startsWith('CS')
}

export function isDone(status) {
  return status === 'Ended' || status === 'Reported as finished'
}

export function weekLabel(priority) {
  const p = parseInt(priority)
  return p === 188 || p === 0 || isNaN(p) ? 'לא משובץ' : `שבוע ${p}`
}

export function groupBy(arr, fn) {
  return arr.reduce((m, r) => {
    const k = fn(r)
    if (!m[k]) m[k] = []
    m[k].push(r)
    return m
  }, {})
}

// ─── פילוח שוק: שוק מקומי / נטפים / ייצוא ───
export function isNetafim(name) {
  return String(name || '').toUpperCase().includes('NETAFIM')
}

export function isConsignmentName(name) {
  return String(name || '').toUpperCase().includes('CONSIGNMENT')
}

// הזמנות + חשבוניות (יש Sale type code): הקודים המיוחדים גוברים על נטפים —
// 30=Drop · 40=Consignment · 50=India · 10=מקומי · אחרת שם NETAFIM (ולא Consignment) → נטפים · אחרת → ייצוא
export function marketSegment(saleTypeCode, customerName) {
  const code = String(saleTypeCode || '').trim()
  if (code === '30') return 'drop'
  if (code === '40') return 'consignment'
  if (code === '50') return 'india'
  if (code === '10') return 'local'
  if (isNetafim(customerName) && !isConsignmentName(customerName)) return 'netafim'
  return 'export'
}

// פשוט (חשבוניות + כל מסך שאין בו הפרדת Consignment): 10 → מקומי · שם NETAFIM → נטפים · אחרת → ייצוא
export function marketSegmentSimple(saleTypeCode, customerName) {
  if (String(saleTypeCode || '').trim() === '10') return 'local'
  if (isNetafim(customerName)) return 'netafim'
  return 'export'
}

// תעודות משלוח (אין Sale type code): Currency ILS → מקומי · אחרת NETAFIM (ולא Consignment) → נטפים · אחרת → ייצוא
export function marketSegmentByCurrency(currency, customerName) {
  if (String(currency || '').trim().toUpperCase() === 'ILS') return 'local'
  if (isNetafim(customerName)) return 'netafim'
  return 'export'
}

// שלושת כרטיסי פילוח-השוק (הנטו). Drop/Consignment/India נספרים בקטגוריות הנפרדות שלהם.
export const MARKET_KEYS = ['local', 'netafim', 'export']
export const MARKET_LABELS = { local: 'שוק מקומי', netafim: 'נטפים', export: 'ייצוא', drop: 'Drop', consignment: 'Consignment', india: 'India' }
export const MARKET_COLORS = { local: '#059669', netafim: '#7C3AED', export: '#185FA5', drop: '#9CA3AF', consignment: '#9CA3AF', india: '#9CA3AF' }
