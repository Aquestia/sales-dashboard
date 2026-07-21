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

// הזמנות + חשבוניות (יש Sale type code): code 10 → מקומי · אחרת שם NETAFIM → נטפים · אחרת → ייצוא
export function marketSegment(saleTypeCode, customerName) {
  if (String(saleTypeCode || '').trim() === '10') return 'local'
  if (isNetafim(customerName)) return 'netafim'
  return 'export'
}

// תעודות משלוח (אין Sale type code): Currency ILS → מקומי · אחרת שם NETAFIM → נטפים · אחרת → ייצוא
export function marketSegmentByCurrency(currency, customerName) {
  if (String(currency || '').trim().toUpperCase() === 'ILS') return 'local'
  if (isNetafim(customerName)) return 'netafim'
  return 'export'
}

export const MARKET_LABELS = { local: 'שוק מקומי', netafim: 'נטפים', export: 'ייצוא' }
export const MARKET_COLORS = { local: '#059669', netafim: '#7C3AED', export: '#185FA5' }
export const MARKET_KEYS = ['local', 'netafim', 'export']
