import { useState, useEffect } from 'react'
import { fetchAuthorizedUsers, addAuthorizedUser, updateAuthorizedUser, deleteAuthorizedUser, isSuperAdmin } from '../utils/db'

const EMPTY = { employee_number: '', first_name: '', last_name: '', role: '', is_admin: false }

export default function AuthUsersManager({ currentUser }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function load() {
    setLoading(true)
    const u = await fetchAuthorizedUsers()
    setUsers(u)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function add() {
    setErr('')
    if (!form.employee_number.trim()) { setErr('חובה למלא מספר עובד'); return }
    if (users.some(u => String(u.employee_number) === form.employee_number.trim())) { setErr('מספר עובד כבר קיים'); return }
    setSaving(true)
    try {
      await addAuthorizedUser({ ...form, authorized: true })
      setForm(EMPTY)
      await load()
    } catch (e) { setErr(e.message) }
    setSaving(false)
  }

  async function toggle(u) {
    await updateAuthorizedUser(u.id, { authorized: !u.authorized })
    await load()
  }

  async function remove(u) {
    if (!window.confirm(`למחוק את ${u.first_name} ${u.last_name} (מס' עובד ${u.employee_number})?`)) return
    await deleteAuthorizedUser(u.id)
    await load()
  }

  const th = { textAlign: 'right', padding: '8px 10px', fontSize: 12, color: 'var(--text-secondary)', borderBottom: '0.5px solid var(--border)', whiteSpace: 'nowrap', fontWeight: 600 }
  const td = { padding: '8px 10px', fontSize: 13, borderBottom: '0.5px solid var(--border)', whiteSpace: 'nowrap' }

  return (
    <div className="section-box" style={{ marginBottom: '1.5rem' }}>
      <div className="section-title">🔑 ניהול הרשאות אזור העלאה</div>

      {/* טופס הוספה */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <input value={form.employee_number} onChange={e => setForm(f => ({ ...f, employee_number: e.target.value }))} placeholder="מספר עובד" style={{ width: 120 }} />
        <input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} placeholder="שם" style={{ width: 130 }} />
        <input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} placeholder="שם משפחה" style={{ width: 130 }} />
        <input value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="תפקיד" style={{ width: 180 }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--text-sub)' }}>
          <input type="checkbox" checked={form.is_admin} onChange={e => setForm(f => ({ ...f, is_admin: e.target.checked }))} /> מנהל
        </label>
        <button onClick={add} disabled={saving}
          style={{ padding: '8px 18px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--blue-dark)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          {saving ? '...' : '➕ הוסף'}
        </button>
        {err && <span style={{ color: 'var(--red-dark)', fontSize: 12 }}>{err}</span>}
      </div>

      {/* טבלה */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>מס' עובד</th>
              <th style={th}>שם</th>
              <th style={th}>שם משפחה</th>
              <th style={th}>תפקיד</th>
              <th style={th}>סטטוס</th>
              <th style={th}>פעולות</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => {
              const self = u.id === currentUser.id
              const superAdmin = isSuperAdmin(u)
              const locked = self || superAdmin
              const lockTitle = superAdmin ? 'מנהל ראשי — לא ניתן לחסום או למחוק' : (self ? 'לא ניתן לחסום את עצמך' : '')
              return (
                <tr key={u.id}>
                  <td style={{ ...td, fontWeight: 600 }}>
                    {u.employee_number}
                    {superAdmin
                      ? <span style={{ marginRight: 6, fontSize: 10, padding: '1px 6px', borderRadius: 8, background: '#FAEEDA', color: '#854F0B' }}>🔒 מנהל ראשי</span>
                      : u.is_admin && <span style={{ marginRight: 6, fontSize: 10, padding: '1px 6px', borderRadius: 8, background: 'var(--blue-bg)', color: 'var(--blue-dark)' }}>מנהל</span>}
                  </td>
                  <td style={td}>{u.first_name}</td>
                  <td style={td}>{u.last_name}</td>
                  <td style={td}>{u.role}</td>
                  <td style={td}>
                    <span style={{ fontSize: 12, padding: '2px 10px', borderRadius: 10,
                      background: (u.authorized || superAdmin) ? '#e6f4ea' : '#fbe9e7',
                      color: (u.authorized || superAdmin) ? '#2D7D46' : '#b3261e' }}>
                      {(u.authorized || superAdmin) ? 'מורשה' : 'חסום'}
                    </span>
                  </td>
                  <td style={td}>
                    <button onClick={() => toggle(u)} disabled={locked}
                      title={lockTitle}
                      style={{ padding: '5px 12px', borderRadius: 'var(--radius)', fontSize: 12, cursor: locked ? 'not-allowed' : 'pointer',
                        border: '0.5px solid ' + (u.authorized ? 'var(--red)' : 'var(--border-card)'),
                        background: u.authorized ? '#fff5f4' : 'var(--bg-row)',
                        color: u.authorized ? '#b3261e' : 'var(--text-sub)', opacity: locked ? 0.4 : 1 }}>
                      {u.authorized ? '🚫 חסום' : '✓ שחרר'}
                    </button>
                    <button onClick={() => remove(u)} disabled={locked} title={lockTitle}
                      style={{ marginRight: 6, padding: '5px 10px', borderRadius: 'var(--radius)', fontSize: 12, cursor: locked ? 'not-allowed' : 'pointer',
                        border: '0.5px solid var(--border-card)', background: 'var(--bg-row)', color: 'var(--text-muted)', opacity: locked ? 0.4 : 1 }}>
                      🗑
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {loading && <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>טוען...</div>}
        {!loading && users.length === 0 && <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>אין משתמשים</div>}
      </div>
    </div>
  )
}
