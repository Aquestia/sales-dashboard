import * as XLSX from 'xlsx-js-style'

// ─────────────────────────────────────────────────────────────
// מנוע ייצוא Excel מעוצב — משותף לכל מסכי דאשבורד המכירות
// ─────────────────────────────────────────────────────────────

const HEAD_FILL   = 'FF2B6CA3'
const TITLE_FILL  = 'FF14446E'
const TOTAL_FILL  = 'FFE8EDF5'
const ROW_A       = 'FFF6F9FC'
const ROW_B       = 'FFFFFFFF'
const BORDER_RGB  = 'FFCDDAE6'

function thinBorder() {
  const s = { style: 'thin', color: { rgb: BORDER_RGB } }
  return { top: s, bottom: s, left: s, right: s }
}

const FMT = {
  money:   '"$"#,##0',
  money2:  '"$"#,##0.00',
  number:  '#,##0',
  decimal: '#,##0.00',
  percent: '0.0%',
  date:    'dd/mm/yyyy',
}

function alignOf(col) {
  if (col.align) return col.align
  if (col.type && col.type !== 'text') return 'center'
  return 'right'
}

function valueOf(row, col) {
  const raw = typeof col.value === 'function' ? col.value(row) : row[col.key]
  if (raw === null || raw === undefined || raw === '') return ''
  switch (col.type) {
    case 'money':
    case 'number':
      return typeof raw === 'number' ? raw : (parseFloat(raw) || 0)
    case 'decimal':
    case 'percent':
      return typeof raw === 'number' ? raw : (parseFloat(raw) || 0)
    default:
      return raw
  }
}

/**
 * ייצוא גיליון מעוצב.
 * @param {Object}   opts
 * @param {Array}    opts.columns  [{ key, header, width, type, align, value(row) }]
 * @param {Array}    opts.rows     מערך אובייקטים
 * @param {string}   opts.filename שם הקובץ (ללא סיומת)
 * @param {string}   opts.sheetName שם הלשונית
 * @param {string}   opts.title    כותרת עליונה (merged) — אופציונלי
 * @param {string}   opts.subtitle כותרת משנה — אופציונלי
 * @param {Object}   opts.totals   { [colKey]: value } — שורת סה"כ. אם לא סופק — יחושב אוטומטית לעמודות money/number
 * @param {boolean}  opts.autoTotals ברירת מחדל true
 */
export function exportStyledExcel({
  columns, rows, filename, sheetName = 'נתונים',
  title = '', subtitle = '', totals = null, autoTotals = true,
}) {
  const nCols = columns.length
  const aoa = []
  let headerRowIdx = 0

  if (title) {
    aoa.push([title, ...Array(nCols - 1).fill('')])
    headerRowIdx++
  }
  if (subtitle) {
    aoa.push([subtitle, ...Array(nCols - 1).fill('')])
    headerRowIdx++
  }

  aoa.push(columns.map(c => c.header))

  rows.forEach(r => aoa.push(columns.map(c => valueOf(r, c))))

  // ── שורת סה"כ ──
  let totalRowIdx = -1
  const wantTotals = totals || autoTotals
  if (wantTotals && rows.length > 0) {
    const tot = columns.map((c, i) => {
      if (totals && Object.prototype.hasOwnProperty.call(totals, c.key)) return totals[c.key]
      if (c.noTotal) return ''
      if (c.type === 'money' || c.type === 'number') {
        return rows.reduce((s, r) => {
          const v = valueOf(r, c)
          return s + (typeof v === 'number' ? v : 0)
        }, 0)
      }
      return i === 0 ? 'סה"כ' : ''
    })
    if (!tot[0]) tot[0] = 'סה"כ'
    aoa.push(tot)
    totalRowIdx = aoa.length - 1
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = columns.map(c => ({ wch: c.width || 14 }))
  ws['!views'] = [{ rightToLeft: true }]
  ws['!rows'] = []
  if (title)    ws['!rows'][0] = { hpt: 24 }
  if (subtitle) ws['!rows'][title ? 1 : 0] = { hpt: 18 }
  ws['!rows'][headerRowIdx] = { hpt: 26 }

  // merge לכותרות
  ws['!merges'] = []
  if (title)    ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: nCols - 1 } })
  if (subtitle) ws['!merges'].push({ s: { r: title ? 1 : 0, c: 0 }, e: { r: title ? 1 : 0, c: nCols - 1 } })

  // סינון אוטומטי על שורת הכותרות
  ws['!autofilter'] = {
    ref: XLSX.utils.encode_range(
      { s: { r: headerRowIdx, c: 0 }, e: { r: headerRowIdx, c: nCols - 1 } }
    )
  }

  // ── עיצוב תאים ──
  for (let r = 0; r < aoa.length; r++) {
    for (let c = 0; c < nCols; c++) {
      const addr = XLSX.utils.encode_cell({ r, c })
      if (!ws[addr]) { ws[addr] = { t: 's', v: '' } }
      const col = columns[c]

      if (title && r === 0) {
        ws[addr].s = {
          fill: { patternType: 'solid', fgColor: { rgb: TITLE_FILL } },
          font: { bold: true, sz: 13, color: { rgb: 'FFFFFFFF' } },
          alignment: { horizontal: 'center', vertical: 'center', readingOrder: 2 },
        }
      } else if (subtitle && r === (title ? 1 : 0)) {
        ws[addr].s = {
          fill: { patternType: 'solid', fgColor: { rgb: 'FFEDF3F9' } },
          font: { sz: 10.5, color: { rgb: 'FF444444' }, italic: true },
          alignment: { horizontal: 'center', vertical: 'center', readingOrder: 2 },
        }
      } else if (r === headerRowIdx) {
        ws[addr].s = {
          fill: { patternType: 'solid', fgColor: { rgb: HEAD_FILL } },
          font: { bold: true, sz: 11, color: { rgb: 'FFFFFFFF' } },
          alignment: { horizontal: 'center', vertical: 'center', readingOrder: 2, wrapText: true },
          border: thinBorder(),
        }
      } else {
        const isTot = r === totalRowIdx
        const bg = isTot ? TOTAL_FILL : ((r - headerRowIdx) % 2 === 1 ? ROW_A : ROW_B)
        ws[addr].s = {
          fill: { patternType: 'solid', fgColor: { rgb: bg } },
          font: { sz: 10.5, bold: isTot, color: { rgb: 'FF333333' } },
          alignment: { horizontal: alignOf(col), vertical: 'center', readingOrder: 2 },
          border: thinBorder(),
        }
        if (col.type && FMT[col.type] && typeof ws[addr].v === 'number') {
          ws[addr].z = FMT[col.type]
        }
      }
    }
  }

  const wb = XLSX.utils.book_new()
  wb.Workbook = { Views: [{ RTL: true }] }   // גיליון מימין לשמאל
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31))
  XLSX.writeFile(wb, `${filename}.xlsx`, { bookType: 'xlsx' })
}

// כפתור ייצוא — סגנון אחיד לכל הדאשבורד
export const EXPORT_BTN_STYLE = {
  padding: '6px 14px',
  borderRadius: 'var(--radius)',
  border: '0.5px solid #bcd9b0',
  background: '#f0f8ec',
  color: '#2a7a1a',
  fontWeight: 600,
  fontSize: 12,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}
