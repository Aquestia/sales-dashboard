import { useState, useEffect, useMemo } from 'react'
import { fetchSalesFiles, fetchSalesOrdersByFileId } from '../utils/db'
import { classifyOrder, buildLookups } from '../utils/classify'
import { fmt } from '../utils/helpers'

const MONTHS_HE = ['ינו','פבר','מרץ','אפר','מאי','יונ','יול','אוג','ספט','אוק','נוב','דצמ']

function monthKey(dateStr) {
  if (!dateStr) return null
  return String(dateStr).slice(0, 7)
}
function monthLabel(key) {
  if (!key) return ''
  const [y, m] = key.split('-')
  return `${MONTHS_HE[parseInt(m)-1]} ${y}`
}

const STATUS_ORDER = [
  'ארוז','באריזה','סיים ייצור','מלאי תוצ"ג','חלקי חילוף',
  'בהרכבת הרכבת מתכת','בהרכבת הרכבת פלסטיק','בהרכבת הרכבת נווטים',
  'בהרכבת מפעלון','בהרכבת מדי מים','בהרכבה',
  'עב"ש','צבע','בליקוט','מתוזמן'
]

function shortStatus(s) {
  return s.replace('בהרכבת הרכבת ', 'הרכבת ').replace('בהרכבת ', 'הרכבת ')
}

function buildMonthData(orders, production, dr4, dr5) {
  const { productionMap, dr4ByParent, dr5ByParent } = buildLookups(production, dr4, dr5)
  const byMonth = {}
  orders.forEach(o => {
    const mk = monthKey(o.confirmed_ship_date)
    if (!mk) return
    const status = classifyOrder(o, productionMap, dr4ByParent, dr5ByParent)
    const cat = o.cat // Internal / External
    if (!byMonth[mk]) byMonth[mk] = {}
    if (!byMonth[mk][status]) byMonth[mk][status] = { Internal: { cnt: 0, amt: 0 }, External: { cnt: 0, amt: 0 } }
    const ie = cat === 'Internal' ? 'Internal' : 'External'
    byMonth[mk][status][ie].cnt += 1
    byMonth[mk][status][ie].amt += o.remaining_amount || 0
  })
  return byMonth
}

function StatusTable({ monthKey: mk, todayData, yesterdayData, color }) {
  const statuses = [...new Set([
    ...Object.keys(todayData || {}),
    ...Object.keys(yesterdayData || {})
  ])].sort((a, b) => STATUS_ORDER.indexOf(a) - STATUS_ORDER.indexOf(b))

  const colStyle = { padding: '5px 8px', fontSize: 12, borderBottom: '0.5px solid #e5e5e0', whiteSpace: 'nowrap', textAlign: 'left' }
  const hStyle = { ...colStyle, color: '#888', fontSize: 11, fontWeight: 500, background: '#f8f8f6' }

  const todayTotal = { Internal: { cnt: 0, amt: 0 }, External: { cnt: 0, amt: 0 } }
  const yestTotal  = { Internal: { cnt: 0, amt: 0 }, External: { cnt: 0, amt: 0 } }
  ;['Internal','External'].forEach(ie => {
    Object.values(todayData || {}).forEach(s => { todayTotal[ie].cnt += s[ie]?.cnt||0; todayTotal[ie].amt += s[ie]?.amt||0 })
    Object.values(yesterdayData || {}).forEach(s => { yestTotal[ie].cnt += s[ie]?.cnt||0; yestTotal[ie].amt += s[ie]?.amt||0 })
  })

  return (
    <div style={{ border: '0.5px solid #e5e5e0', borderRadius: 10, overflow: 'hidden', flex: 1, minWidth: 0 }}>
      {/* Month header */}
      <div style={{ background: color, color: '#fff', padding: '10px 14px', fontWeight: 600, fontSize: 14 }}>
        {monthLabel(mk)}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ ...hStyle, textAlign: 'right' }}>סטטוס</th>
              {/* Yesterday */}
              <th colSpan={2} style={{ ...hStyle, textAlign: 'center', borderRight: '1px solid #ddd' }}>אתמול</th>
              {/* Today */}
              <th colSpan={2} style={{ ...hStyle, textAlign: 'center' }}>היום</th>
            </tr>
            <tr>
              <th style={{ ...hStyle, textAlign: 'right' }}></th>
              <th style={{ ...hStyle, textAlign: 'center' }}>פנימי</th>
              <th style={{ ...hStyle, textAlign: 'center', borderRight: '1px solid #ddd' }}>חיצוני</th>
              <th style={{ ...hStyle, textAlign: 'center' }}>פנימי</th>
              <th style={{ ...hStyle, textAlign: 'center' }}>חיצוני</th>
            </tr>
          </thead>
          <tbody>
            {statuses.map((st, i) => {
              const td = todayData?.[st]
              const yd = yesterdayData?.[st]
              return (
                <tr key={st} style={{ background: i % 2 === 0 ? '#fafaf8' : '#fff' }}>
                  <td style={{ ...colStyle, textAlign: 'right', fontWeight: 500 }}>{shortStatus(st)}</td>
                  {/* Yesterday Internal */}
                  <td style={colStyle}>{yd?.Internal?.cnt || 0} · <span style={{ color: '#555' }}>${fmt(yd?.Internal?.amt||0)}</span></td>
                  {/* Yesterday External */}
                  <td style={{ ...colStyle, borderRight: '1px solid #ddd' }}>{yd?.External?.cnt || 0} · <span style={{ color: '#555' }}>${fmt(yd?.External?.amt||0)}</span></td>
                  {/* Today Internal */}
                  <td style={colStyle}>{td?.Internal?.cnt || 0} · <span style={{ color: '#555' }}>${fmt(td?.Internal?.amt||0)}</span></td>
                  {/* Today External */}
                  <td style={colStyle}>{td?.External?.cnt || 0} · <span style={{ color: '#555' }}>${fmt(td?.External?.amt||0)}</span></td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 600, background: '#f0f4f9' }}>
              <td style={{ ...colStyle, textAlign: 'right' }}>סה"כ</td>
              <td style={colStyle}>{yestTotal.Internal.cnt} · ${fmt(yestTotal.Internal.amt)}</td>
              <td style={{ ...colStyle, borderRight: '1px solid #ddd' }}>{yestTotal.External.cnt} · ${fmt(yestTotal.External.amt)}</td>
              <td style={colStyle}>{todayTotal.Internal.cnt} · ${fmt(todayTotal.Internal.amt)}</td>
              <td style={colStyle}>{todayTotal.External.cnt} · ${fmt(todayTotal.External.amt)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

export default function MonthlyStatusView({ production, dr4, dr5 }) {
  const [files, setFiles] = useState([])
  const [todayOrders, setTodayOrders] = useState([])
  const [yesterdayOrders, setYesterdayOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const fs = await fetchSalesFiles()
      setFiles(fs)
      if (fs.length >= 1) {
        const today = await fetchSalesOrdersByFileId(fs[0].id)
        setTodayOrders(today)
      }
      if (fs.length >= 2) {
        const yesterday = await fetchSalesOrdersByFileId(fs[1].id)
        setYesterdayOrders(yesterday)
      }
      setLoading(false)
    }
    load()
  }, [])

  const todayMonths   = useMemo(() => buildMonthData(todayOrders, production, dr4, dr5), [todayOrders, production, dr4, dr5])
  const yesterdayMonths = useMemo(() => buildMonthData(yesterdayOrders, production, dr4, dr5), [yesterdayOrders, production, dr4, dr5])

  // Show current month + next 2 months
  const now = new Date()
  const displayMonths = [0, 1, 2].map(offset => {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
  })

  const COLORS = ['#D97706', '#1D6FA5', '#2D7D46']

  if (loading) return <div className="loading">טוען נתונים...</div>

  return (
    <div>
      <div className="page-heading">מצב הזמנות — השוואה יומית</div>

      {files.length === 0 && (
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          אין קבצים שמורים. העלה קובץ ראשי כדי לראות נתונים.
        </div>
      )}

      {files.length === 1 && (
        <div style={{ fontSize: 13, color: 'var(--amber-dark)', marginBottom: 12, padding: '8px 12px', background: 'var(--amber-bg)', borderRadius: 8 }}>
          יש קובץ אחד בלבד — העמוד "אתמול" יהיה ריק. העלה קובץ נוסף מחר לראות השוואה.
        </div>
      )}

      {files.length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
          היום: {files[0]?.batch_date} ({files[0]?.filename})
          {files[1] && ` · אתמול: ${files[1]?.batch_date} (${files[1]?.filename})`}
        </div>
      )}

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {displayMonths.map((mk, i) => (
          <StatusTable
            key={mk}
            monthKey={mk}
            todayData={todayMonths[mk]}
            yesterdayData={yesterdayMonths[mk]}
            color={COLORS[i]}
          />
        ))}
      </div>
    </div>
  )
}
