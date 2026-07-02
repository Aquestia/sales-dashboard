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
  return s.replace('בהרכבת הרכבת ','הרכבת ').replace('בהרכבת ','הרכבת ')
}

function buildMonthData(orders, production, dr4, dr5) {
  const { productionMap, dr4ByParent, dr5ByParent } = buildLookups(production, dr4, dr5)
  const byMonth = {}
  orders.forEach(o => {
    const mk = monthKey(o.confirmed_ship_date)
    if (!mk) return
    const status = classifyOrder(o, productionMap, dr4ByParent, dr5ByParent)
    const ie = o.cat === 'Internal' ? 'Internal' : 'External'
    if (!byMonth[mk]) byMonth[mk] = {}
    if (!byMonth[mk][status]) byMonth[mk][status] = { Internal:{cnt:0,amt:0}, External:{cnt:0,amt:0} }
    byMonth[mk][status][ie].cnt += 1
    byMonth[mk][status][ie].amt += o.remaining_amount || 0
  })
  return byMonth
}

function StatusTable({ monthKey: mk, aData, bData, aFile, bFile, color }) {
  const statuses = [...new Set([
    ...Object.keys(aData || {}),
    ...Object.keys(bData || {})
  ])].sort((a,b) => {
    const ai = STATUS_ORDER.indexOf(a), bi = STATUS_ORDER.indexOf(b)
    return (ai===-1?99:ai) - (bi===-1?99:bi)
  })

  const cs = { padding:'5px 8px', fontSize:12, borderBottom:'0.5px solid #e5e5e0', whiteSpace:'nowrap', textAlign:'left' }
  const hs = { ...cs, color:'#888', fontSize:11, fontWeight:500, background:'#f8f8f6' }

  const totA = { I:{cnt:0,amt:0}, E:{cnt:0,amt:0} }
  const totB = { I:{cnt:0,amt:0}, E:{cnt:0,amt:0} }
  Object.values(aData||{}).forEach(s => { totA.I.cnt+=s.Internal?.cnt||0; totA.I.amt+=s.Internal?.amt||0; totA.E.cnt+=s.External?.cnt||0; totA.E.amt+=s.External?.amt||0 })
  Object.values(bData||{}).forEach(s => { totB.I.cnt+=s.Internal?.cnt||0; totB.I.amt+=s.Internal?.amt||0; totB.E.cnt+=s.External?.cnt||0; totB.E.amt+=s.External?.amt||0 })

  const fileALabel = aFile ? `${aFile.batch_date}` : '—'
  const fileBLabel = bFile ? `${bFile.batch_date}` : '—'

  return (
    <div style={{ border:'0.5px solid #e5e5e0', borderRadius:10, overflow:'hidden', flex:1, minWidth:0 }}>
      <div style={{ background:color, color:'#fff', padding:'10px 14px', fontWeight:600, fontSize:14 }}>
        {monthLabel(mk)}
      </div>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead>
            <tr>
              <th style={{ ...hs, textAlign:'right' }}>סטטוס</th>
              <th colSpan={2} style={{ ...hs, textAlign:'center', borderRight:'1px solid #ddd' }}>{fileALabel}</th>
              <th colSpan={2} style={{ ...hs, textAlign:'center' }}>{fileBLabel}</th>
            </tr>
            <tr>
              <th style={{ ...hs, textAlign:'right' }}></th>
              <th style={hs}>פנימי</th>
              <th style={{ ...hs, borderRight:'1px solid #ddd' }}>חיצוני</th>
              <th style={hs}>פנימי</th>
              <th style={hs}>חיצוני</th>
            </tr>
          </thead>
          <tbody>
            {statuses.map((st,i) => {
              const a = aData?.[st], b = bData?.[st]
              return (
                <tr key={st} style={{ background: i%2===0?'#fafaf8':'#fff' }}>
                  <td style={{ ...cs, textAlign:'right', fontWeight:500 }}>{shortStatus(st)}</td>
                  <td style={cs}>{a?.Internal?.cnt||0} · <span style={{color:'#555'}}>${fmt(a?.Internal?.amt||0)}</span></td>
                  <td style={{ ...cs, borderRight:'1px solid #ddd' }}>{a?.External?.cnt||0} · <span style={{color:'#555'}}>${fmt(a?.External?.amt||0)}</span></td>
                  <td style={cs}>{b?.Internal?.cnt||0} · <span style={{color:'#555'}}>${fmt(b?.Internal?.amt||0)}</span></td>
                  <td style={cs}>{b?.External?.cnt||0} · <span style={{color:'#555'}}>${fmt(b?.External?.amt||0)}</span></td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight:600, background:'#f0f4f9' }}>
              <td style={{ ...cs, textAlign:'right' }}>סה"כ</td>
              <td style={cs}>{totA.I.cnt} · ${fmt(totA.I.amt)}</td>
              <td style={{ ...cs, borderRight:'1px solid #ddd' }}>{totA.E.cnt} · ${fmt(totA.E.amt)}</td>
              <td style={cs}>{totB.I.cnt} · ${fmt(totB.I.amt)}</td>
              <td style={cs}>{totB.E.cnt} · ${fmt(totB.E.amt)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

export default function MonthlyStatusView({ production, dr4, dr5 }) {
  const [allFiles, setAllFiles]       = useState([])
  const [selected, setSelected]       = useState([]) // max 2 file ids
  const [running, setRunning]         = useState(false)
  const [activeFiles, setActiveFiles] = useState([]) // the 2 files being compared
  const [ordersA, setOrdersA]         = useState([])
  const [ordersB, setOrdersB]         = useState([])
  const [loading, setLoading]         = useState(false)

  useEffect(() => {
    fetchSalesFiles().then(files => {
      setAllFiles(files)
      // auto-select 2 most recent
      if (files.length >= 2) setSelected([files[0].id, files[1].id])
      else if (files.length === 1) setSelected([files[0].id])
    })
  }, [])

  function toggleSelect(id) {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= 2) return prev // max 2
      return [...prev, id]
    })
  }

  async function runComparison() {
    if (selected.length !== 2) return
    setLoading(true)
    const [idA, idB] = selected
    const [a, b] = await Promise.all([
      fetchSalesOrdersByFileId(idA),
      fetchSalesOrdersByFileId(idB)
    ])
    setOrdersA(a)
    setOrdersB(b)
    setActiveFiles([
      allFiles.find(f => f.id === idA),
      allFiles.find(f => f.id === idB)
    ])
    setLoading(false)
    setRunning(true)
  }

  const monthDataA = useMemo(() => buildMonthData(ordersA, production, dr4, dr5), [ordersA, production, dr4, dr5])
  const monthDataB = useMemo(() => buildMonthData(ordersB, production, dr4, dr5), [ordersB, production, dr4, dr5])

  const now = new Date()
  const displayMonths = [0, 1].map(offset => {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
  })
  const COLORS = ['#D97706','#1D6FA5']

  return (
    <div>
      <div className="page-heading">מצב הזמנות — השוואה יומית</div>

      {/* File selector */}
      <div className="section-box" style={{ marginBottom:'1.25rem' }}>
        <div className="section-title">בחר שני קבצים להשוואה ({selected.length}/2 נבחרו)</div>

        {allFiles.length === 0 && (
          <div style={{ fontSize:13, color:'var(--text-muted)' }}>אין קבצים שמורים. העלה קובץ ראשי תחילה.</div>
        )}

        <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:12 }}>
          {allFiles.map((f, i) => {
            const isSel = selected.includes(f.id)
            const isDisabled = !isSel && selected.length >= 2
            return (
              <button key={f.id} onClick={() => !isDisabled && toggleSelect(f.id)}
                style={{
                  padding:'8px 14px', borderRadius:'var(--radius)', fontSize:12,
                  border:'0.5px solid ' + (isSel ? 'var(--blue-dark)' : 'var(--border-card)'),
                  background: isSel ? 'var(--blue-bg)' : 'var(--bg-row)',
                  color: isSel ? 'var(--blue-dark)' : isDisabled ? 'var(--text-hint)' : 'var(--text-main)',
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  opacity: isDisabled ? 0.5 : 1,
                  display:'flex', flexDirection:'column', alignItems:'flex-start', gap:2
                }}>
                <span style={{ fontWeight:600 }}>{isSel ? `✓ ` : ''}{f.batch_date}</span>
                <span style={{ color:'var(--text-muted)', fontSize:11 }}>{f.filename} · {new Date(f.uploaded_at).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'})}</span>
              </button>
            )
          })}
        </div>

        <button onClick={runComparison} disabled={selected.length !== 2 || loading}
          style={{
            padding:'9px 24px', borderRadius:'var(--radius)', fontSize:14, fontWeight:600,
            background: selected.length === 2 ? 'var(--blue-dark)' : '#ccc',
            color:'#fff', border:'none',
            cursor: selected.length === 2 ? 'pointer' : 'not-allowed'
          }}>
          {loading ? 'טוען...' : '▶ הפעל השוואה'}
        </button>
      </div>

      {/* Comparison tables */}
      {running && (
        <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
          {displayMonths.map((mk, i) => (
            <StatusTable
              key={mk}
              monthKey={mk}
              aData={monthDataA[mk]}
              bData={monthDataB[mk]}
              aFile={activeFiles[0]}
              bFile={activeFiles[1]}
              color={COLORS[i]}
            />
          ))}
        </div>
      )}
    </div>
  )
}
