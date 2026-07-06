import { useState, useEffect } from 'react'
import { fmt } from '../utils/helpers'
import { fetchSalesFiles, fetchInvoicesDetail } from '../utils/db'

export default function InvoicesView() {
  const [files, setFiles] = useState([])
  const [selectedFileId, setSelectedFileId] = useState(null)
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')

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
    fetchInvoicesDetail(selectedFileId).then(inv => {
      setInvoices(inv)
      setLoading(false)
    })
  }, [selectedFileId])

const COLS = [
  ['invoice','חשבונית'],['invoice_account','לקוח'],['name','שם לקוח'],
  ['sales_order','הזמנה'],['invoice_date','תאריך'],['currency','מטבע'],
  ['invoice_amount','סכום חשבוניות'],['cat','סוג']
]

  const totalAmt = invoices.reduce((s, r) => s + (r.invoice_amount || 0), 0)

  let rows = catFilter === 'all' ? invoices : invoices.filter(r => r.cat === catFilter)
  if (search) {
    const q = search.toLowerCase()
    rows = rows.filter(r =>
      (r.invoice||'').toLowerCase().includes(q) ||
      (r.name||'').toLowerCase().includes(q) ||
      (r.invoice_account||'').toLowerCase().includes(q) ||
      (r.sales_order||'').toLowerCase().includes(q)
    )
  }
  rows = [...rows].sort((a, b) => (b.invoice_date||'').localeCompare(a.invoice_date||''))

  const [selDay, setSelDay] = useState(null)

  return (
    <div>
      {/* File selector */}
      {files.length > 0 && (
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:'1.25rem', flexWrap:'wrap' }}>
          <span style={{ fontSize:13, color:'var(--text-secondary)', whiteSpace:'nowrap' }}>קובץ פעיל:</span>
          {files.map(f => (
            <button key={f.id} onClick={() => setSelectedFileId(f.id)}
              style={{ padding:'6px 14px', borderRadius:'var(--radius)', fontSize:12,
                border:'0.5px solid '+(selectedFileId===f.id?'var(--blue-dark)':'var(--border-card)'),
                background:selectedFileId===f.id?'var(--blue-bg)':'var(--bg-row)',
                color:selectedFileId===f.id?'var(--blue-dark)':'var(--text-main)',
                cursor:'pointer', fontWeight:selectedFileId===f.id?600:400 }}>
              {f.batch_date} · {f.filename}
            </button>
          ))}
          {loading && <span style={{ fontSize:12, color:'var(--text-muted)' }}>טוען...</span>}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 12, marginBottom: '1.5rem' }}>
        {[
          { label: 'סה"כ חשבוניות', value: '$' + fmt(totalAmt), sub: invoices.length + ' חשבוניות' },
          { label: 'לקוחות פנימיים', value: '$' + fmt(invoices.filter(r=>r.cat==='Internal').reduce((s,r)=>s+(r.invoice_amount||0),0)), sub: '' },
          { label: 'לקוחות חיצוניים', value: '$' + fmt(invoices.filter(r=>r.cat==='External').reduce((s,r)=>s+(r.invoice_amount||0),0)), sub: '' },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--surface-2)', border: '0.5px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{k.value}</div>
            {k.sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* Daily bar chart */}
      {(() => {
        // Group by date
        const byDate = {}
        invoices.forEach(r => {
          const d = r.invoice_date || 'ללא תאריך'
          if (!byDate[d]) byDate[d] = { date: d, amt: 0, cnt: 0, rows: [] }
          byDate[d].amt += r.invoice_amount || 0
          byDate[d].cnt += 1
          byDate[d].rows.push(r)
        })
        const days = Object.values(byDate).sort((a,b) => a.date.localeCompare(b.date))
        if (days.length === 0) return null

        const BAR_W = 64, GAP = 20, H = 160, PAD_L = 70, PAD_B = 36, PAD_T = 48
        const maxAmt = Math.max(...days.map(d => d.amt), 1)
        const chartW = Math.max(PAD_L + days.length * (BAR_W + GAP) + GAP, 600)
        return (
          <div className="section-box" style={{ marginBottom:'1rem' }}>
            <div className="section-title">חשבוניות יומי</div>
            <div style={{ overflowX:'auto', textAlign:'center' }}>
              <svg width={chartW} height={H + PAD_T + PAD_B} style={{ display:'inline-block', direction:'ltr' }}>
                {[0, 0.25, 0.5, 0.75, 1].map(pct => {
                  const y = PAD_T + H - pct * H
                  return (
                    <g key={pct}>
                      <line x1={PAD_L} y1={y} x2={chartW} y2={y} stroke="#e5e5e0" strokeWidth={0.5} />
                      <text x={PAD_L-6} y={y+4} textAnchor="end" fontSize={10} fill="#888">${fmt(pct*maxAmt)}</text>
                    </g>
                  )
                })}
                {days.map((d, i) => {
                  const x = PAD_L + GAP + i * (BAR_W + GAP)
                  const barH = Math.max(2, (d.amt / maxAmt) * H)
                  const y = PAD_T + H - barH
                  const active = selDay === d.date
                  const dateLabel = d.date.length >= 10 ? d.date.slice(5).replace('-','.') : d.date
                  return (
                    <g key={d.date} style={{ cursor:'pointer' }} onClick={() => setSelDay(active ? null : d.date)}>
                      <rect x={x} y={y} width={BAR_W} height={barH}
                        fill={active ? '#185FA5' : '#378ADD'} rx={4} opacity={active?1:0.8} />
                      <text x={x+BAR_W/2} y={y-18} textAnchor="middle" fontSize={10} fill="#555" fontWeight="600">
                        {d.cnt} חשבוניות
                      </text>
                      <text x={x+BAR_W/2} y={y-5} textAnchor="middle" fontSize={10} fill={active?'#185FA5':'#378ADD'} fontWeight="600">
                        ${fmt(d.amt)}
                      </text>
                      <text x={x+BAR_W/2} y={PAD_T+H+18} textAnchor="middle" fontSize={11} fill={active?'#185FA5':'#555'} fontWeight={active?'600':'400'}>
                        {dateLabel}
                      </text>
                    </g>
                  )
                })}
                <line x1={PAD_L} y1={PAD_T+H} x2={chartW} y2={PAD_T+H} stroke="#ccc" strokeWidth={1} />
              </svg>
            </div>

            {/* Detail rows for selected day */}
            {selDay && (() => {
              const dayRows = byDate[selDay]?.rows || []
              const dayAmt = dayRows.reduce((s,r)=>s+(r.invoice_amount||0),0)
              return (
                <div style={{ marginTop:12, borderTop:'0.5px solid var(--border-card)', paddingTop:12 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                    <div style={{ fontWeight:600, fontSize:14 }}>
                      {selDay} — {dayRows.length} חשבוניות · ${fmt(dayAmt)}
                    </div>
                    <button onClick={()=>setSelDay(null)} style={{ fontSize:12, color:'var(--text-muted)', background:'none', border:'none', cursor:'pointer' }}>✕ סגור</button>
                  </div>
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ fontSize:12, width:'100%', borderCollapse:'collapse' }}>
                      <thead>
                        <tr>
                          {['חשבונית','לקוח','שם לקוח','הזמנה','מטבע','סכום $','סוג'].map(h=>(
                            <th key={h} style={{ textAlign:'right', padding:'6px 8px', color:'var(--text-muted)', borderBottom:'0.5px solid var(--border-tbl)', whiteSpace:'nowrap', fontWeight:600 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...dayRows].sort((a,b)=>(b.invoice_amount||0)-(a.invoice_amount||0)).map((r,i)=>(
                          <tr key={i} style={{ background: i%2===0?'var(--bg-row)':'var(--bg-card)' }}>
                            <td style={{ padding:'6px 8px', borderBottom:'0.5px solid var(--border-tbl)', whiteSpace:'nowrap' }}>{r.invoice}</td>
                            <td style={{ padding:'6px 8px', borderBottom:'0.5px solid var(--border-tbl)', whiteSpace:'nowrap' }}>{r.invoice_account}</td>
                            <td style={{ padding:'6px 8px', borderBottom:'0.5px solid var(--border-tbl)', whiteSpace:'nowrap' }}>{r.name}</td>
                            <td style={{ padding:'6px 8px', borderBottom:'0.5px solid var(--border-tbl)', whiteSpace:'nowrap' }}>{r.sales_order}</td>
                            <td style={{ padding:'6px 8px', borderBottom:'0.5px solid var(--border-tbl)', whiteSpace:'nowrap' }}>{r.currency}</td>
                            <td style={{ padding:'6px 8px', borderBottom:'0.5px solid var(--border-tbl)', whiteSpace:'nowrap', fontWeight:600 }}>${fmt(r.invoice_amount||0)}</td>
                            <td style={{ padding:'6px 8px', borderBottom:'0.5px solid var(--border-tbl)', whiteSpace:'nowrap' }}>{r.cat==='Internal'?'פנימי':'חיצוני'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })()}
          </div>
        )
      })()}
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="חיפוש לפי חשבונית / לקוח / הזמנה..."
          style={{ width: 280 }} />
        {['all','Internal','External'].map(v => (
          <button key={v} onClick={() => setCatFilter(v)}
            style={{ padding: '7px 14px', borderRadius: 'var(--radius)',
              border: '0.5px solid ' + (catFilter === v ? 'var(--border-accent)' : 'var(--border)'),
              background: catFilter === v ? 'var(--bg-accent)' : 'var(--surface-1)',
              cursor: 'pointer', fontSize: 13 }}>
            {v === 'all' ? 'הכל' : v === 'Internal' ? 'פנימיים' : 'חיצוניים'}
          </button>
        ))}
      </div>

      <div style={{ overflowX: 'auto', background: 'var(--surface-2)', border: '0.5px solid var(--border)', borderRadius: 12, padding: '1rem 1.1rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {COLS.map(([k, l]) => (
                <th key={k} style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-secondary)', borderBottom: '0.5px solid var(--border)', whiteSpace: 'nowrap' }}>{l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? 'var(--surface-1)' : 'var(--surface-2)' }}>
                {COLS.map(([k]) => (
                  <td key={k} style={{ padding: '6px 8px', borderBottom: '0.5px solid var(--border)', whiteSpace: 'nowrap' }}>
                    {k === 'invoice_amount' ? '$' + fmt(r[k] || 0)
                      : k === 'cat' ? (r[k] === 'Internal' ? 'פנימי' : 'חיצוני')
                      : (r[k] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>אין נתונים</div>}
      </div>
    </div>
  )
}
