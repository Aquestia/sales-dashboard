import { useState, useEffect } from 'react'
import FileUpload from './FileUpload'
import AuthUsersManager from './AuthUsersManager'
import { authByEmployeeNumber } from '../utils/db'

const SESSION_KEY = 'sales_upload_user'

export default function UploadGate({ onUploaded }) {
  const [authed, setAuthed] = useState(null)   // אובייקט המשתמש לאחר אימות
  const [code, setCode] = useState('')
  const [checking, setChecking] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [denied, setDenied] = useState(false)  // מציג את הודעת הדחייה הנעלמת

  // אימות מחדש של סשן שמור בעת טעינה (כדי שחסימה תיכנס לתוקף גם ברענון)
  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY)
    if (!saved) { setChecking(false); return }
    authByEmployeeNumber(saved)
      .then(u => {
        if (u && u.authorized) setAuthed(u)
        else sessionStorage.removeItem(SESSION_KEY)
      })
      .catch(() => {})
      .finally(() => setChecking(false))
  }, [])

  function showDenied() {
    setDenied(true)
    setTimeout(() => setDenied(false), 3000)
  }

  async function submit() {
    const c = code.trim()
    if (!c) return
    setSubmitting(true)
    try {
      const u = await authByEmployeeNumber(c)
      if (u && u.authorized) {
        setAuthed(u)
        sessionStorage.setItem(SESSION_KEY, u.employee_number)
        setCode('')
      } else {
        setCode('')
        showDenied()
      }
    } catch (e) {
      showDenied()
    } finally {
      setSubmitting(false)
    }
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY)
    setAuthed(null)
    setCode('')
  }

  if (checking) return <div className="loading">בודק הרשאה...</div>

  // ─── מחובר: אזור מוגן פתוח ───
  if (authed) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            מחובר: <strong>{authed.first_name} {authed.last_name}</strong> · {authed.role} · מס' עובד {authed.employee_number}
          </div>
          <button onClick={logout}
            style={{ padding: '6px 14px', borderRadius: 'var(--radius)', fontSize: 12,
              border: '0.5px solid var(--border-card)', background: 'var(--bg-row)', cursor: 'pointer', color: 'var(--text-sub)' }}>
            🔒 יציאה מהאזור
          </button>
        </div>
        {authed.is_admin && <AuthUsersManager currentUser={authed} />}
        <FileUpload onUploaded={onUploaded} />
      </div>
    )
  }

  // ─── שער נעילה ───
  return (
    <div style={{ maxWidth: 440, margin: '3rem auto' }}>
      <div className="section-box" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>🔒</div>
        <div className="page-heading" style={{ marginBottom: 6 }}>אזור מוגן</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
          הזן קוד כניסה (מספר עובד) כדי לגשת לאזור העלאת הקבצים
        </div>
        <input
          type="password"
          value={code}
          onChange={e => setCode(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
          placeholder="מספר עובד"
          autoFocus
          style={{ width: '100%', height: 42, textAlign: 'center', fontSize: 16, letterSpacing: 2, marginBottom: 12 }}
        />
        <button onClick={submit} disabled={submitting}
          style={{ width: '100%', height: 42, borderRadius: 'var(--radius)', fontSize: 15, fontWeight: 600,
            border: 'none', background: 'var(--blue-dark)', color: '#fff', cursor: 'pointer' }}>
          {submitting ? 'בודק...' : 'כניסה'}
        </button>
      </div>

      {denied && (
        <div style={{ marginTop: 16, padding: '18px 20px', borderRadius: 12, textAlign: 'center',
          background: '#fbe9e7', border: '0.5px solid var(--red)', color: '#7a2e1d', lineHeight: 1.9 }}>
          <div>שלום רב,</div>
          <div style={{ margin: '8px 0' }}>לצורך קבלת הרשאה לאזור זה יש לבקש אישור משי שמאי</div>
          <div>תודה והמשך יום נפלא</div>
        </div>
      )}
    </div>
  )
}
