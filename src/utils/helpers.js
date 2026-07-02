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
