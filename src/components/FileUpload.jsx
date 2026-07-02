import { useState, useRef, useEffect } from 'react'
import { uploadSnapshot, uploadMain, fetchSalesFiles } from '../utils/db'

const FILE_TYPES = [
  { key: 'main',     label: 'קובץ ראשי (check_data)',  hint: 'לשוניות: Customers / Sales orders / Production / Calculated Allocation / Open Purchase Orders / DR4 / DR5 / Invoices / BO' },
  { key: 'snapshot', label: 'דוח מכירות יומי',         hint: 'לשוניות: שורות הזמנה / NISO / דוח חשבוניות' },
]

export default function FileUpload() {
  const [fileType, setFileType] = useState('main')
  const [messages, setMessages] = useState([])
  const [uploading, setUploading] = useState(false)
  const [savedFiles, setSavedFiles] = useState([])
  const inputRef = useRef()

  useEffect(() => {
    fetchSalesFiles().then(setSavedFiles)
  }, [])

  function addMsg(type, msg) {
    setMessages(prev => [...prev, { type, msg, time: new Date().toLocaleTimeString('he-IL') }])
  }

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setMessages([])
    setUploading(true)
    addMsg('progress', `קורא קובץ: ${file.name} (${(file.size/1024).toFixed(0)} KB)`)

    const reader = new FileReader()
    reader.onerror = () => { addMsg('error', 'שגיאה בקריאת הקובץ'); setUploading(false) }
    reader.onload = ev => {
      const worker = new Worker('/excelWorker.js')
      worker.onerror = err => { addMsg('error', 'שגיאה ב-Worker: ' + (err.message || 'לא ידועה')); setUploading(false); worker.terminate() }
      worker.onmessage = async me => {
        if (me.data.type === 'progress') {
          addMsg('progress', me.data.msg)
        } else if (me.data.type === 'error') {
          addMsg('error', me.data.msg)
          setUploading(false)
          worker.terminate()
        } else if (me.data.type === 'done') {
          try {
            addMsg('progress', 'שומר ל-Supabase...')
            if (me.data.fileType === 'snapshot') {
              await uploadSnapshot(me.data.plan, me.data.niso, me.data.invoices)
              addMsg('success', `✓ הועלו: ${me.data.plan.length} תוכנית · ${me.data.niso.length} NISO · ${me.data.invoices.length} חשבוניות`)
            } else if (me.data.fileType === 'main') {
              await uploadMain({ filename: file.name, ...me.data })
              addMsg('success',
                `✓ הועלו: ${me.data.customers.length} לקוחות · ${me.data.salesOrders.length} הזמנות · ` +
                `${me.data.production.length} פק"עות · ${me.data.allocation.length} חוסרים · ` +
                `${me.data.purchaseOrders.length} הזמנות רכש · ${me.data.dr4.length} DR4 · ` +
                `${me.data.dr5.length} DR5 · ${me.data.invoicesDetail.length} חשבוניות · ${me.data.bo.length} BO`
              )
            }
          } catch (err) {
            addMsg('error', 'שגיאת Supabase: ' + err.message)
          }
          setUploading(false)
          worker.terminate()
          if (inputRef.current) inputRef.current.value = ''
          fetchSalesFiles().then(setSavedFiles)
        }
      }
      worker.postMessage({ buffer: ev.target.result, fileType })
    }
    reader.readAsArrayBuffer(file)
  }

  const lastMsg = messages[messages.length - 1]

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ background: 'var(--surface-2)', border: '0.5px solid var(--border)', borderRadius: 12, padding: '1.2rem 1.4rem', marginBottom: '1rem' }}>
        <div style={{ fontWeight: 500, fontSize: 15, marginBottom: 12 }}>העלאת קובץ Excel</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {FILE_TYPES.map(ft => (
            <button key={ft.key} onClick={() => setFileType(ft.key)}
              style={{ padding: '7px 14px', borderRadius: 'var(--radius)',
                border: '0.5px solid ' + (fileType === ft.key ? 'var(--border-accent)' : 'var(--border)'),
                background: fileType === ft.key ? 'var(--bg-accent)' : 'var(--surface-1)',
                cursor: 'pointer', fontSize: 13 }}>
              {ft.label}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
          {FILE_TYPES.find(f => f.key === fileType)?.hint}
        </div>
        <input ref={inputRef} type="file" accept=".xlsx,.xls" onChange={handleFile}
          disabled={uploading} style={{ display: 'block', marginBottom: 12 }} />
        {lastMsg && (
          <div style={{ fontSize: 13, padding: '8px 12px', borderRadius: 'var(--radius)',
            background: lastMsg.type === 'success' ? '#eaf3de' : lastMsg.type === 'error' ? '#fbe9e7' : 'var(--bg-accent)',
            color: lastMsg.type === 'success' ? '#1a6e3a' : lastMsg.type === 'error' ? 'var(--red)' : 'var(--text-primary)' }}>
            {lastMsg.msg}
          </div>
        )}
      </div>
      {messages.length > 1 && (
        <div style={{ background: 'var(--surface-2)', border: '0.5px solid var(--border)', borderRadius: 12, padding: '1rem 1.4rem' }}>
          <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8, color: 'var(--text-secondary)' }}>לוג:</div>
          {messages.map((m, i) => (
            <div key={i} style={{ fontSize: 12, marginBottom: 4,
              color: m.type === 'success' ? '#1a6e3a' : m.type === 'error' ? 'var(--red)' : 'var(--text-secondary)' }}>
              <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>{m.time}</span>{m.msg}
            </div>
          ))}
        </div>
      )}
      {/* Saved files list */}
      {savedFiles.length > 0 && (
        <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border-card)', borderRadius: 10, padding: '1rem 1.2rem', marginTop: '1rem' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-sub)', marginBottom: 10 }}>קבצים שמורים (עד 2 גרסאות):</div>
          {savedFiles.map((f, i) => (
            <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 10px', borderRadius: 8, marginBottom: 6,
              background: i === 0 ? 'var(--blue-bg)' : 'var(--bg-row)',
              border: '0.5px solid ' + (i === 0 ? 'var(--border-blue)' : 'var(--border-card)') }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: i === 0 ? 600 : 400, color: i === 0 ? 'var(--blue-dark)' : 'var(--text-main)' }}>
                  {i === 0 ? '📅 היום — ' : '📅 אתמול — '}{f.filename}
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {f.batch_date} · {new Date(f.uploaded_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
