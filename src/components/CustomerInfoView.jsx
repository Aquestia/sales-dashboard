import { useState } from 'react'
import { isInternal } from '../utils/helpers'

const FIELDS = [
  ['customer_account','מספר לקוח'],['name','שם'],['search_name','שם חיפוש'],
  ['phone','טלפון'],['email','אימייל'],['city','עיר'],['state','מחוז'],
  ['country','מדינה'],['zip','מיקוד'],['account_number','מספר חשבון']
]

export default function CustomerInfoView({ customers }) {
  const [query, setQuery] = useState('')
  const [account, setAccount] = useState(null)

  const q = query.toLowerCase()
  const results = q
    ? customers.filter(c => c.name?.toLowerCase().includes(q) || c.customer_account?.toLowerCase().includes(q)).slice(0, 8)
    : []

  const cust = account ? customers.find(c => c.customer_account === account) : null

  return (
    <div>
      <div style={{ marginBottom: '1.2rem' }}>
        <input value={query} onChange={e => setQuery(e.target.value)}
          placeholder="חפש לקוח לפי שם או מספר..."
          style={{ width: 320, height: 36, padding: '0 12px', borderRadius: 'var(--radius)', border: '0.5px solid var(--border-strong)', fontSize: 14 }} />
      </div>

      {results.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: '1.2rem' }}>
          {results.map(c => (
            <button key={c.customer_account} onClick={() => { setAccount(c.customer_account); setQuery('') }}
              style={{ textAlign: 'right', padding: '8px 12px', borderRadius: 'var(--radius)', border: '0.5px solid var(--border)', background: 'var(--surface-1)', cursor: 'pointer', fontSize: 12 }}>
              <div style={{ fontWeight: 500 }}>{c.name}</div>
              <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>{c.customer_account} · {isInternal(c.customer_account) ? 'פנימי' : 'חיצוני'}</div>
            </button>
          ))}
        </div>
      )}

      {cust && (
        <div style={{ background: 'var(--surface-2)', border: '0.5px solid var(--border)', borderRadius: 12, padding: '1rem 1.25rem', maxWidth: 480 }}>
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 2 }}>{cust.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14 }}>
            {isInternal(cust.customer_account) ? 'לקוח פנימי' : 'לקוח חיצוני'}
          </div>
          <table style={{ width: '100%', fontSize: 13 }}>
            <tbody>
              {FIELDS.filter(([k]) => k !== 'name').map(([k, l]) => (
                <tr key={k}>
                  <td style={{ color: 'var(--text-secondary)', padding: '5px 0', whiteSpace: 'nowrap', paddingLeft: 16 }}>{l}</td>
                  <td style={{ padding: '5px 0' }}>{cust[k] || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
