import { useState } from 'react'
import { fmt, isInternal, isDone, weekLabel } from '../utils/helpers'
import ShortageTable from './ShortageTable'

const ORDER_COLS = [
  ['sales_order','הזמנה'],['line_number','שורה'],['item_number','פריט'],['item_group','קב. פריט'],
  ['status','סטטוס'],['confirmed_ship_date','תאריך אספקה'],['remaining_amount','סכום'],['_prod','ייצור']
]

export default function CustomerCard({ customers, salesOrders, production, allocation, purchaseOrders }) {
  const [query, setQuery] = useState('')
  const [selectedAccount, setSelectedAccount] = useState(null)
  const [orderFilter, setOrderFilter] = useState(null)

  const q = query.toLowerCase()
  const custMatches = q
    ? customers.filter(c => c.name?.toLowerCase().includes(q) || c.customer_account?.toLowerCase().includes(q))
    : []
  const orderMatches = q
    ? salesOrders.filter(o => o.sales_order?.toLowerCase().includes(q))
    : []
  const orderCustAccs = [...new Set(orderMatches.map(o => o.customer_account))]
  orderCustAccs.forEach(acc => {
    if (!custMatches.find(c => c.customer_account === acc)) {
      const c = customers.find(c => c.customer_account === acc)
      if (c) custMatches.push(c)
    }
  })
  const results = custMatches.slice(0, 8)

  function selectCustomer(account, orderNum) {
    setSelectedAccount(account)
    setOrderFilter(orderNum || null)
    setQuery('')
  }

  const cust = selectedAccount ? customers.find(c => c.customer_account === selectedAccount) : null
  let orders = selectedAccount ? salesOrders.filter(o => o.customer_account === selectedAccount) : []
  if (orderFilter) orders = orders.filter(o => o.sales_order === orderFilter)

  const totalAmt = orders.reduce((s, o) => s + (o.remaining_amount || 0), 0)

  function getProd(o) {
    return production.find(p => p.reference_number === o.sales_order || p.production === o.production_number) || null
  }

  return (
    <div>
      {/* Search */}
      <div style={{ marginBottom: '1.2rem' }}>
        <input value={query} onChange={e => setQuery(e.target.value)} autoFocus={false}
          placeholder="חפש לפי שם לקוח, מספר לקוח או מספר הזמנה..."
          style={{ width: 360, height: 36, padding: '0 12px', borderRadius: 'var(--radius)', border: '0.5px solid var(--border-strong)', fontSize: 14 }} />
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: '1.2rem' }}>
          {results.map(c => {
            const matched = orderMatches.find(o => o.customer_account === c.customer_account)
            return (
              <button key={c.customer_account} onClick={() => selectCustomer(c.customer_account, matched?.sales_order)}
                style={{ textAlign: 'right', padding: '8px 12px', borderRadius: 'var(--radius)', border: '0.5px solid var(--border)', background: 'var(--surface-1)', cursor: 'pointer', fontSize: 12 }}>
                <div style={{ fontWeight: 500 }}>{c.name}</div>
                <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>
                  {c.customer_account} · {isInternal(c.customer_account) ? 'פנימי' : 'חיצוני'}
                  {matched ? ` · הזמנה ${matched.sales_order}` : ''}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Customer card */}
      {cust && (
        <>
          <div style={{ background: 'var(--surface-2)', border: '0.5px solid var(--border)', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: '1.2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 500 }}>{cust.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                  {cust.customer_account} · {isInternal(cust.customer_account) ? 'לקוח פנימי' : 'לקוח חיצוני'}
                  {cust.city ? ` · ${cust.city}` : ''}{cust.country ? ` ${cust.country}` : ''}
                </div>
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 20, fontWeight: 600 }}>${fmt(totalAmt)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{orders.length} שורות הזמנה פתוחות</div>
              </div>
            </div>
          </div>

          {orderFilter && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
              מציג רק הזמנה {orderFilter} &nbsp;·&nbsp;
              <span onClick={() => setOrderFilter(null)} style={{ color: 'var(--border-accent)', cursor: 'pointer' }}>הצג את כל ההזמנות של הלקוח</span>
            </div>
          )}

          <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {ORDER_COLS.map(([k, l]) => (
                    <th key={k} style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-secondary)', borderBottom: '0.5px solid var(--border)', whiteSpace: 'nowrap' }}>{l}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((o, i) => {
                  const prod = getProd(o)
                  const done = isDone(prod?.status)
                  const hasShortage = prod && prod.shortage_exist === 'Yes' && !done
                  return (
                    <tr key={i} style={{ background: done ? '#eaf3de' : 'transparent' }}>
                      {ORDER_COLS.map(([k]) => (
                        <td key={k} style={{ padding: '6px 8px', borderBottom: '0.5px solid var(--border)', whiteSpace: 'nowrap' }}>
                          {k === '_prod' ? (
                            prod ? (
                              <span>
                                {prod.status} · {weekLabel(prod.planning_priority)}
                                {hasShortage && <span style={{ color: 'var(--red)', fontWeight: 500 }}> · מחסור</span>}
                              </span>
                            ) : '—'
                          ) : k === 'remaining_amount' ? `$${fmt(o[k] || 0)}` : (o[k] ?? '')}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Shortage details */}
          {orders.map((o, i) => {
            const prod = getProd(o)
            if (!prod || !prod.shortage_exist === 'Yes' || isDone(prod.status)) return null
            if (prod.shortage_exist !== 'Yes') return null
            if (isDone(prod.status)) return null
            return (
              <div key={i}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>
                  הזמנה {o.sales_order} שורה {o.line_number} · פק"ע {prod.production}
                </div>
                <ShortageTable prodNumber={prod.production} allocation={allocation} purchaseOrders={purchaseOrders} />
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
