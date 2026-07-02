import { useState, useRef } from 'react'
import { uploadSnapshot, uploadOpenOrders, uploadCustomersProduction } from '../utils/db'

const FILE_TYPES = [
  { key: 'snapshot',             label: 'דוח מכירות יומי',          hint: 'לשוניות: שורות הזמנה / NISO / דוח חשבוניות' },
  { key: 'openorders',           label: 'הזמנות פתוחות',            hint: 'קובץ מכירות.xlsx — גיליון Sheet1' },
  { key: 'customers_production', label: 'לקוחות + ייצור + רכש',     hint: 'לשוניות: Customers / Production / Calculated Allocation / Open Purchase Orders' },
]

export default function FileUpload() {
  const [fileType, setFileType] = useState('customers_production')
  const [messages, setMessages] = useState([])
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef()

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
      addMsg('progress', 'מפעיל Web Worker...')
      const worker = new Worker('/excelWorker.js')

      worker.onerror = (err) => {
        addMsg('error', 'שגיאה ב-Worker: ' + (err.message || 'לא ידועה'))
        setUploading(false)
        worker.terminate()
      }

      worker.onmessage = async (me) => {
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
              addMsg('success', `✓ הועלו: ${me.data.plan.length} שורות תוכנית, ${me.data.niso.length} NISO, ${me.data.invoices.length} חשבוניות`)
            } else if (me.data.fileType === 'openorders') {
              await uploadOpenOrders(me.data.data)
              addMsg('success', `✓ הועלו ${me.data.data.length} הזמנות פתוחות`)
            } else if (me.data.fileType === 'customers_production') {
              await uploadCustomersProduction(me.data.customers, me.data.production, me.data.allocation, me.data.purchaseOrders)
              addMsg('success', `✓ הועלו: ${me.data.customers.length} לקוחות, ${me.data.production.length} פק"עות, ${me.data.allocation.length} חוסרים, ${me.data.purchaseOrders.length} הזמנות רכש`)
            }
          } catch (err) {
            addMsg('error', 'שגיאת Supabase: ' + err.message)
          }
          setUploading(false)
          worker.terminate()
          if (inputRef.current) inputRef.current.value = ''
        }
      }

      worker.postMessage({ buffer: ev.target.result, fileType })
    }
    reader.readAsArrayBuffer(file)
  }

  const selected = FILE_TYPES.find(f => f.key === fileType)
  const lastMsg = messages[messages.length - 1]

  return (
    <div style={{ maxWidth: 560 }}>
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

        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>{selected?.hint}</div>

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
          <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8, color: 'var(--text-secondary)' }}>לוג פעולות:</div>
          {messages.map((m, i) => (
            <div key={i} style={{ fontSize: 12, marginBottom: 4,
              color: m.type === 'success' ? '#1a6e3a' : m.type === 'error' ? 'var(--red)' : 'var(--text-secondary)' }}>
              <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>{m.time}</span>
              {m.msg}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
