import { fmt } from '../utils/helpers'

export default function ShortageTable({ prodNumber, allocation, purchaseOrders }) {
  const items = allocation.filter(a => a.number === prodNumber && a.missing_qty > 0)
  if (!items.length) return null

  function bestPO(itemNumber) {
    const candidates = purchaseOrders.filter(p =>
      p.item_number === itemNumber &&
      p.deliver_remainder > 0 &&
      p.document_status !== 'Invoice'
    )
    if (!candidates.length) return null
    return candidates.sort((a, b) => {
      const da = a.confirmed_receipt_date || a.requested_receipt_date || '9999'
      const db = b.confirmed_receipt_date || b.requested_receipt_date || '9999'
      return da.localeCompare(db)
    })[0]
  }

  return (
    <div style={{ marginTop: 8, padding: '10px 12px', background: '#fbe9e7', borderRadius: 8, border: '0.5px solid var(--red)' }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--red)', marginBottom: 6 }}>מק"טים חסרים</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>
              {['מק"ט','שם פריט','כמות חסרה','תאריך נדרש','הזמנת רכש','ספק','תאריך אספקה צפוי','סטטוס'].map(h => (
                <th key={h} style={{ textAlign: 'right', padding: '4px 6px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => {
              const po = bestPO(it.item_number)
              const needDate = it.requested_delivery_date
              const hasPO = !!po
              const eta = po ? (po.confirmed_receipt_date || po.requested_receipt_date || '') : ''
              const late = needDate && eta && eta > needDate
              return (
                <tr key={i} style={{ background: hasPO ? '#eaf3de' : 'transparent' }}>
                  <td style={{ padding: '4px 6px', borderTop: '0.5px solid var(--border)', whiteSpace: 'nowrap' }}>{it.item_number}</td>
                  <td style={{ padding: '4px 6px', borderTop: '0.5px solid var(--border)', whiteSpace: 'nowrap' }}>{it.product_name}</td>
                  <td style={{ padding: '4px 6px', borderTop: '0.5px solid var(--border)', whiteSpace: 'nowrap' }}>{Math.round(it.missing_qty)}</td>
                  <td style={{ padding: '4px 6px', borderTop: '0.5px solid var(--border)', whiteSpace: 'nowrap' }}>{needDate || '—'}</td>
                  <td style={{ padding: '4px 6px', borderTop: '0.5px solid var(--border)', whiteSpace: 'nowrap' }}>{po?.purchase_order || '—'}</td>
                  <td style={{ padding: '4px 6px', borderTop: '0.5px solid var(--border)', whiteSpace: 'nowrap' }}>{po?.vendor_name || '—'}</td>
                  <td style={{ padding: '4px 6px', borderTop: '0.5px solid var(--border)', whiteSpace: 'nowrap' }}>{eta || '—'}</td>
                  <td style={{ padding: '4px 6px', borderTop: '0.5px solid var(--border)', whiteSpace: 'nowrap' }}>
                    {hasPO
                      ? (late ? <span style={{ color: 'var(--red)', fontWeight: 500 }}>איחור צפוי</span> : <span style={{ color: '#1d9e75' }}>בזמן</span>)
                      : <span style={{ color: 'var(--red)', fontWeight: 500 }}>אין הזמנת רכש פתוחה</span>
                    }
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
