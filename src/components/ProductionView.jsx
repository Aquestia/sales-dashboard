import { useState } from 'react'
import { fmt, isDone, weekLabel, groupBy } from '../utils/helpers'
import ShortageTable from './ShortageTable'

const PROD_COLS = [
  ['production','פק"ע'],['reference_number','הזמנה'],['customer_name','לקוח'],
  ['item_number','פריט'],['quantity','כמות'],['status','סטטוס'],['start_date','ת. התחלה'],
  ['_week','שבוע תכנון'],['shortage_exist','מחסור']
]

export default function ProductionView({ production, allocation, purchaseOrders }) {
  const [openKey, setOpenKey] = useState(null)

  function hasRealShortage(p) {
    return p.shortage_exist === 'Yes' && !isDone(p.status)
  }

  const total = production.length
  const shortageCount = production.filter(p => hasRealShortage(p)).length
  const unscheduled = production.filter(p => {
    const pp = parseInt(p.planning_priority)
    return pp === 188 || pp === 0 || isNaN(pp)
  }).length

  const kpis = [
    { label: 'פק"עות פתוחות',   value: total },
    { label: 'מחסור ברכיבים',   value: shortageCount, accent: true },
    { label: 'לא משובץ לשבוע',  value: unscheduled },
  ]

  const DIMS = [
    {
      key: 'week', label: 'לפי שבוע תכנון',
      items: () => {
        const g = groupBy(production, p => weekLabel(p.planning_priority))
        return Object.entries(g)
          .map(([k, v]) => ({ key: k, cnt: v.length }))
          .sort((a, b) => a.key === 'לא משובץ' ? 1 : b.key === 'לא משובץ' ? -1 : a.key.localeCompare(b.key))
      },
      filter: (p, val) => weekLabel(p.planning_priority) === val
    },
    {
      key: 'status', label: 'לפי סטטוס',
      items: () => {
        const g = groupBy(production, p => p.status)
        return Object.entries(g).map(([k, v]) => ({ key: k, cnt: v.length })).sort((a, b) => b.cnt - a.cnt)
      },
      filter: (p, val) => p.status === val
    },
    {
      key: 'shortage', label: 'מחסור ברכיבים',
      items: () => [
        { key: 'yes', label: 'יש מחסור',   cnt: production.filter(p => hasRealShortage(p)).length },
        { key: 'no',  label: 'אין מחסור',  cnt: production.filter(p => !hasRealShortage(p)).length },
      ],
      filter: (p, val) => val === 'yes' ? hasRealShortage(p) : !hasRealShortage(p)
    }
  ]

  function getDetailRows() {
    if (!openKey) return []
    const [dimKey, val] = openKey.split('|val|')
    const dim = DIMS.find(d => d.key === dimKey)
    return dim ? production.filter(p => dim.filter(p, val)) : []
  }

  return (
    <div>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 12, marginBottom: '1.5rem' }}>
        {kpis.map(k => (
          <div key={k.label} style={{ background: 'var(--surface-2)', border: '0.5px solid ' + (k.accent ? 'var(--border-accent)' : 'var(--border)'), borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: k.accent ? 'var(--red)' : 'inherit' }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Dims */}
      {DIMS.map(dim => (
        <div key={dim.key} style={{ marginBottom: '1.3rem' }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>{dim.label}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {dim.items().map(it => {
              const k = `${dim.key}|val|${it.key}`
              const active = openKey === k
              return (
                <button key={it.key} onClick={() => setOpenKey(active ? null : k)}
                  style={{ textAlign: 'right', padding: '8px 12px', borderRadius: 'var(--radius)',
                    border: '0.5px solid ' + (active ? 'var(--border-accent)' : 'var(--border)'),
                    background: active ? 'var(--bg-accent)' : 'var(--surface-1)', cursor: 'pointer', fontSize: 12 }}>
                  <div style={{ fontWeight: 500 }}>{it.label || it.key}</div>
                  <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>{it.cnt} פק"עות</div>
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {/* Detail table + shortage */}
      {openKey && (() => {
        const detailRows = getDetailRows()
        return (
          <div style={{ border: '0.5px solid var(--border)', borderRadius: 12, padding: '1rem 1.1rem', background: 'var(--surface-2)' }}>
            <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 10 }}>{detailRows.length} פק"עות</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    {PROD_COLS.map(([k, l]) => (
                      <th key={k} style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-secondary)', borderBottom: '0.5px solid var(--border)', whiteSpace: 'nowrap' }}>{l}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detailRows.map((r, i) => (
                    <tr key={i} style={{ background: isDone(r.status) ? '#eaf3de' : 'transparent' }}>
                      {PROD_COLS.map(([k]) => (
                        <td key={k} style={{ padding: '6px 8px', borderBottom: '0.5px solid var(--border)', whiteSpace: 'nowrap' }}>
                          {k === '_week' ? weekLabel(r.planning_priority)
                            : k === 'status' ? (isDone(r.status) ? 'פק"ע הסתיימה' : r.status)
                            : k === 'shortage_exist' ? (hasRealShortage(r) ? 'כן' : 'לא')
                            : (r[k] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Per-prod shortage details */}
            {detailRows.filter(r => hasRealShortage(r)).map((r, i) => (
              <div key={i}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 12 }}>
                  פק"ע {r.production} · הזמנה {r.reference_number}
                </div>
                <ShortageTable prodNumber={r.production} allocation={allocation} purchaseOrders={purchaseOrders} />
              </div>
            ))}
          </div>
        )
      })()}
    </div>
  )
}
