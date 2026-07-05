// Pool → assembly category name
const POOL_ASSEMBLY = {
  DR6MT:     'הרכבת מתכת',
  DR6PL:     'הרכבת פלסטיק',
  DR6NV:     'הרכבת נווטים',
  DR6MF:     'מפעלון',
  DR6MM:     'מדי מים',
  DRKBM:     'קבלני משנה',
  DR8AR:     'אריזה',
  DR8PLT:    'לוחיות',
  DRFUNC:    'בדיקות פונקציונליות',
  DRFUNC_6NV:'בדיקות פונקציונליות',
  DRFUNC_MT: 'בדיקות פונקציונליות',
  DRFUNC_PL: 'בדיקות פונקציונליות',
}

const DONE_STATUSES = ['Ended', 'Reported as finished']
const ASSEMBLY_STATUSES = ['Released', 'Scheduled']

export function classifyOrder(order, productionMap, dr4ByParent, dr5ByParent) {
  // 1. ארוז
  if ((order.qty_packed || 0) > 0) return 'ארוז'

  // 2. באריזה
  if ((order.qty_packed || 0) === 0 && (order.qty_picked || 0) > 0) return 'באריזה'

  const prod = productionMap[order.production_number]

  // 3. סיים ייצור
  if (prod && DONE_STATUSES.includes(prod.status)) return 'סיים ייצור'

  // 4. חלקי חילוף — מאגר לוגיסטיקה
  if (order.pool === 'DRLOG') return 'חלקי חילוף'

  // 5. חלקי חילוף — ללא פק"ע, קבוצת פריט שאינה FG/AS
  if (!order.production_number && !['FG', 'AS'].includes(order.item_group)) return 'חלקי חילוף'

  // 6. מלאי תוצ"ג — ללא פק"ע, קבוצת FG/AS
  if (!order.production_number && ['FG', 'AS'].includes(order.item_group)) return 'מלאי תוצ"ג'

  if (!prod) return 'מתוזמן'

  // 7. בהרכבה — Components in station = Yes (Released/Scheduled)
  if (ASSEMBLY_STATUSES.includes(prod.status) && prod.components_in_station === 'Yes') {
    const poolName = POOL_ASSEMBLY[prod.pool]
    return poolName ? 'בהרכבת ' + poolName : 'בהרכבה'
  }

  // 8. בהרכבה — Started
  if (prod.status === 'Started') {
    const poolName = POOL_ASSEMBLY[prod.pool]
    return poolName ? 'בהרכבת ' + poolName : 'בהרכבה'
  }

  // 9. עב"ש — יש DR4 פעיל תחת פק"ע זו
  if (ASSEMBLY_STATUSES.includes(prod.status)) {
    const dr4Children = dr4ByParent[prod.production] || []
    if (dr4Children.some(d => !DONE_STATUSES.includes(d.status))) return 'עב"ש'

    // 10. צבע — יש DR5 פעיל תחת פק"ע זו
    const dr5Children = dr5ByParent[prod.production] || []
    if (dr5Children.some(d => !DONE_STATUSES.includes(d.status))) return 'צבע'
  }

  // 11. בליקוט — Scheduled/Released, Components No, priority 1-99
  if (
    ASSEMBLY_STATUSES.includes(prod.status) &&
    prod.components_in_station === 'No' &&
    prod.planning_priority > 0 &&
    prod.planning_priority <= 99
  ) return 'בליקוט'

  // 12. מתוזמן
  return 'מתוזמן'
}

export function buildLookups(production, dr4, dr5) {
  const productionMap = {}
  production.forEach(p => { productionMap[p.production] = p })

  const dr4ByParent = {}
  dr4.forEach(d => {
    const k = d.parent_production_order
    if (!dr4ByParent[k]) dr4ByParent[k] = []
    dr4ByParent[k].push(d)
  })

  const dr5ByParent = {}
  dr5.forEach(d => {
    const k = d.parent_production_order
    if (!dr5ByParent[k]) dr5ByParent[k] = []
    dr5ByParent[k].push(d)
  })

  return { productionMap, dr4ByParent, dr5ByParent }
}

export const STATUS_ORDER = [
  'ארוז', 'באריזה', 'סיים ייצור', 'מלאי תוצ"ג', 'חלקי חילוף',
  'בהרכבת הרכבת מתכת', 'בהרכבת הרכבת פלסטיק', 'בהרכבת הרכבת נווטים',
  'בהרכבת מפעלון', 'בהרכבת מדי מים', 'בהרכבה',
  'עב"ש', 'צבע', 'בליקוט', 'מתוזמן'
]
