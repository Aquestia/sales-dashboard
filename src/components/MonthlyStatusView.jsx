import { useState, useEffect, useMemo } from 'react'
import { fetchSalesFiles, fetchSalesOrdersByFileId } from '../utils/db'
import { classifyOrder, buildLookups } from '../utils/classify'
import { fmt } from '../utils/helpers'

const MONTHS_HE = ['ינו','פבר','מרץ','אפר','מאי','יונ','יול','אוג','ספט','אוק','נוב','דצמ']
function monthKey(d) { if (!d) return null; return String(d).slice(0,7) }
function monthLabel(k) { if (!k) return ''; const [y,m]=k.split('-'); return `${MONTHS_HE[parseInt(m)-1]} ${y}` }

const STATUS_ORDER = [
  'ארוז','באריזה','סיים ייצור','מלאי תוצ"ג','חלקי חילוף',
  'בהרכבת הרכבת מתכת','בהרכבת הרכבת פלסטיק','בהרכבת הרכבת נווטים',
  'בהרכבת מפעלון','בהרכבת מדי מים','בהרכבה','עב"ש','צבע','בליקוט','מתוזמן'
]
const shortStatus = s => s.replace('בהרכבת הרכבת ','הרכבת ').replace('בהרכבת ','הרכבת ')

function buildMonthData(orders, production, dr4, dr5) {
  const { productionMap, dr4ByParent, dr5ByParent } = buildLookups(production, dr4, dr5)
  const byMonth = {}
  orders.forEach(o => {
    const mk = monthKey(o.confirmed_ship_date)
    if (!mk) return
    const st = classifyOrder(o, productionMap, dr4ByParent, dr5ByParent)
    const ie = o.cat === 'Internal' ? 'I' : 'E'
    if (!byMonth[mk]) byMonth[mk] = {}
    if (!byMonth[mk][st]) byMonth[mk][st] = { I:{cnt:0,amt:0}, E:{cnt:0,amt:0} }
    byMonth[mk][st][ie].cnt += 1
    byMonth[mk][st][ie].amt += o.remaining_amount || 0
  })
  return byMonth
}

function DiffCell({ aAmt, bAmt, style={} }) {
  const diff = bAmt - aAmt
  if (diff === 0 || (!aAmt && !bAmt)) return <td style={style}><span style={{color:'#bbb'}}>—</span></td>
  const up = diff > 0
  return (
    <td style={style}>
      <span style={{ color: up ? '#2a7a1a' : '#a32d2d', fontWeight:700 }}>
        {up ? '↑' : '↓'} ${fmt(Math.abs(diff))}
      </span>
    </td>
  )
}

function StatusTable({ mk, aData, bData, aFile, bFile, color }) {
  const statuses = [...new Set([...Object.keys(aData||{}), ...Object.keys(bData||{})])]
    .sort((a,b) => {
      const ai=STATUS_ORDER.indexOf(a), bi=STATUS_ORDER.indexOf(b)
      return (ai<0?99:ai)-(bi<0?99:bi)
    })

  const CS = { padding:'6px 10px', fontSize:12, borderBottom:'0.5px solid #e8e8e2', whiteSpace:'nowrap', textAlign:'center', verticalAlign:'middle' }
  const HS = { ...CS, fontWeight:600, fontSize:11, color:'#555', background:'#f5f5f0' }

  function sum(data) {
    let iA=0,eA=0,iC=0,eC=0
    Object.values(data||{}).forEach(s=>{iA+=s.I?.amt||0;eA+=s.E?.amt||0;iC+=s.I?.cnt||0;eC+=s.E?.cnt||0})
    return {iA,eA,iC,eC,tot:iA+eA,cnt:iC+eC}
  }
  const tA=sum(aData), tB=sum(bData)

  return (
    <div style={{ border:'0.5px solid #ddd', borderRadius:10, overflow:'hidden', marginBottom:16 }}>
      {/* Month title */}
      <div style={{ background:color, color:'#fff', padding:'10px 16px', fontWeight:700, fontSize:15, textAlign:'center' }}>
        {monthLabel(mk)}
      </div>

      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <colgroup>
            <col style={{width:130}} />
            <col /><col /><col /><col style={{borderRight:'2px solid #ccc'}} /><col style={{borderRight:'2px solid #999'}} />
            <col /><col /><col /><col style={{borderRight:'2px solid #ccc'}} /><col style={{borderRight:'2px solid #999'}} />
            <col />
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={2} style={{ ...HS, textAlign:'right', borderRight:'0.5px solid #ddd', borderBottom:'1px solid #ddd' }}>סטטוס</th>
              <th colSpan={5} style={{ ...HS, background:'#eaf0f8', borderBottom:'1px solid #ddd', borderRight:'2px solid #999' }}>{aFile?.batch_date||'—'}</th>
              <th colSpan={5} style={{ ...HS, background:'#f5f0e8', borderBottom:'1px solid #ddd', borderRight:'2px solid #999' }}>{bFile?.batch_date||'—'}</th>
              <th rowSpan={2} style={{ ...HS, background:'#eef5ea', borderBottom:'1px solid #ddd' }}>שינוי<br/>כולל</th>
            </tr>
            <tr>
              <th style={{ ...HS, background:'#eaf0f8' }}>פנימי $</th>
              <th style={{ ...HS, background:'#eaf0f8' }}>חיצוני $</th>
              <th style={{ ...HS, background:'#dce8f5' }}>סכום כולל</th>
              <th style={{ ...HS, background:'#eaf0f8' }}>שורות</th>
              <th style={{ ...HS, background:'#dce8f5', borderRight:'2px solid #999' }}>שינוי</th>
              <th style={{ ...HS, background:'#f5f0e8' }}>פנימי $</th>
              <th style={{ ...HS, background:'#f5f0e8' }}>חיצוני $</th>
              <th style={{ ...HS, background:'#ede5d8' }}>סכום כולל</th>
              <th style={{ ...HS, background:'#f5f0e8' }}>שורות</th>
              <th style={{ ...HS, background:'#ede5d8', borderRight:'2px solid #999' }}>שינוי</th>
            </tr>
          </thead>
          <tbody>
            {statuses.map((st, i) => {
              const a = aData?.[st] || { I:{cnt:0,amt:0}, E:{cnt:0,amt:0} }
              const b = bData?.[st] || { I:{cnt:0,amt:0}, E:{cnt:0,amt:0} }
              const aTot = (a.I?.amt||0)+(a.E?.amt||0)
              const bTot = (b.I?.amt||0)+(b.E?.amt||0)
              const aCnt = (a.I?.cnt||0)+(a.E?.cnt||0)
              const bCnt = (b.I?.cnt||0)+(b.E?.cnt||0)
              return (
                <tr key={st} style={{ background: i%2===0?'#fafaf8':'#fff' }}>
                  <td style={{ ...CS, textAlign:'right', fontWeight:500, borderRight:'0.5px solid #ddd' }}>{shortStatus(st)}</td>
                  <td style={CS}>{a.I?.amt ? `$${fmt(a.I.amt)}` : '—'}</td>
                  <td style={CS}>{a.E?.amt ? `$${fmt(a.E.amt)}` : '—'}</td>
                  <td style={{ ...CS, fontWeight:600, background:'#f0f5fb' }}>{aTot ? `$${fmt(aTot)}` : '—'}</td>
                  <td style={{ ...CS, color:'#777' }}>{aCnt||'—'}</td>
                  <DiffCell aAmt={0} bAmt={aTot} style={{ ...CS, background:'#f0f5fb', borderRight:'2px solid #999' }} />
                  <td style={CS}>{b.I?.amt ? `$${fmt(b.I.amt)}` : '—'}</td>
                  <td style={CS}>{b.E?.amt ? `$${fmt(b.E.amt)}` : '—'}</td>
                  <td style={{ ...CS, fontWeight:600, background:'#f8f2e8' }}>{bTot ? `$${fmt(bTot)}` : '—'}</td>
                  <td style={{ ...CS, color:'#777' }}>{bCnt||'—'}</td>
                  <DiffCell aAmt={0} bAmt={bTot} style={{ ...CS, background:'#f8f2e8', borderRight:'2px solid #999' }} />
                  <DiffCell aAmt={aTot} bAmt={bTot} style={{ ...CS, background:'#f0f8ec' }} />
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight:700, background:'#e8edf5', fontSize:13 }}>
              <td style={{ ...CS, textAlign:'right', borderRight:'0.5px solid #ddd' }}>סה"כ</td>
              <td style={CS}>${fmt(tA.iA)}</td>
              <td style={CS}>${fmt(tA.eA)}</td>
              <td style={{ ...CS, background:'#d8e4f0' }}>${fmt(tA.tot)}</td>
              <td style={CS}>{tA.cnt}</td>
              <td style={{ ...CS, borderRight:'2px solid #999' }}></td>
              <td style={CS}>${fmt(tB.iA)}</td>
              <td style={CS}>${fmt(tB.eA)}</td>
              <td style={{ ...CS, background:'#eddfc8' }}>${fmt(tB.tot)}</td>
              <td style={CS}>{tB.cnt}</td>
              <td style={{ ...CS, borderRight:'2px solid #999' }}></td>
              <DiffCell aAmt={tA.tot} bAmt={tB.tot} style={{ ...CS, background:'#dff0d8', fontSize:14 }} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

export default function MonthlyStatusView({ production, dr4, dr5 }) {
  const [allFiles, setAllFiles] = useState([])
  const [selected, setSelected] = useState([])
  const [running, setRunning]   = useState(false)
  const [activeFiles, setActiveFiles] = useState([])
  const [ordersA, setOrdersA] = useState([])
  const [ordersB, setOrdersB] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchSalesFiles().then(files => {
      setAllFiles(files)
      if (files.length >= 2) setSelected([files[0].id, files[1].id])
      else if (files.length === 1) setSelected([files[0].id])
    })
  }, [])

  function toggleSelect(id) {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x=>x!==id)
      if (prev.length >= 2) return prev
      return [...prev, id]
    })
    setRunning(false)
  }

  async function runComparison() {
    if (selected.length !== 2) return
    setLoading(true)
    const [idA, idB] = selected
    const [a, b] = await Promise.all([fetchSalesOrdersByFileId(idA), fetchSalesOrdersByFileId(idB)])
    setOrdersA(a); setOrdersB(b)
    setActiveFiles([allFiles.find(f=>f.id===idA), allFiles.find(f=>f.id===idB)])
    setLoading(false); setRunning(true)
  }

  const monthDataA = useMemo(() => buildMonthData(ordersA, production, dr4, dr5), [ordersA, production, dr4, dr5])
  const monthDataB = useMemo(() => buildMonthData(ordersB, production, dr4, dr5), [ordersB, production, dr4, dr5])

  const now = new Date()
  const displayMonths = [0,1].map(offset => {
    const d = new Date(now.getFullYear(), now.getMonth()+offset, 1)
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
  })
  const COLORS = ['#D97706','#1D6FA5']

  return (
    <div>
      <div className="page-heading">מצב הזמנות — השוואה יומית</div>

      {/* File selector */}
      <div className="section-box" style={{ marginBottom:'1.25rem' }}>
        <div className="section-title">בחר שני קבצים להשוואה ({selected.length}/2 נבחרו)</div>
        {allFiles.length === 0 && <div style={{ fontSize:13, color:'var(--text-muted)' }}>אין קבצים שמורים. העלה קובץ ראשי תחילה.</div>}
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:12 }}>
          {allFiles.map((f, i) => {
            const isSel = selected.includes(f.id)
            const isDisabled = !isSel && selected.length >= 2
            return (
              <button key={f.id} onClick={() => !isDisabled && toggleSelect(f.id)}
                style={{ padding:'8px 14px', borderRadius:'var(--radius)', fontSize:12,
                  border:'0.5px solid '+(isSel?'var(--blue-dark)':'var(--border-card)'),
                  background: isSel?'var(--blue-bg)':'var(--bg-row)',
                  color: isSel?'var(--blue-dark)':isDisabled?'var(--text-hint)':'var(--text-main)',
                  cursor: isDisabled?'not-allowed':'pointer', opacity:isDisabled?0.5:1,
                  display:'flex', flexDirection:'column', alignItems:'flex-start', gap:2 }}>
                <span style={{ fontWeight:600 }}>{isSel?'✓ ':''}{f.batch_date}</span>
                <span style={{ color:'var(--text-muted)', fontSize:11 }}>{f.filename} · {new Date(f.uploaded_at).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'})}</span>
              </button>
            )
          })}
        </div>
        <button onClick={runComparison} disabled={selected.length!==2||loading}
          style={{ padding:'9px 24px', borderRadius:'var(--radius)', fontSize:14, fontWeight:600,
            background:selected.length===2?'var(--blue-dark)':'#ccc',
            color:'#fff', border:'none', cursor:selected.length===2?'pointer':'not-allowed' }}>
          {loading?'טוען...':'▶ הפעל השוואה'}
        </button>
      </div>

      {/* Tables */}
      {running && displayMonths.map((mk,i) => (
        <StatusTable key={mk} mk={mk}
          aData={monthDataA[mk]} bData={monthDataB[mk]}
          aFile={activeFiles[0]} bFile={activeFiles[1]}
          color={COLORS[i]} />
      ))}
    </div>
  )
}
