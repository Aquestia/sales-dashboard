import { useState, useRef } from 'react'
import { uploadSnapshot, uploadOpenOrders, uploadCustomersProduction } from '../utils/db'

const FILE_TYPES = [
  { key: 'snapshot',              label: 'דוח מכירות יומי',           hint: 'לשוניות: שורות הזמנה / NISO / דוח חשבוניות' },
  { key: 'openorders',            label: 'הזמנות פתוחות',             hint: 'גיליון מכירות.xlsx' },
  { key: 'customers_production',  label: 'לקוחות + ייצור + רכש',      hint: 'לשוניות: Customers / Production / Calculated Allocation / Open Purchase Orders' },
]

export default function FileUpload() {
  const [fileType, setFileType] = useState('snapshot')
  const [status, setStatus] = useState(null) // null | {type: 'progress'|'success'|'error', msg}
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef()

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setStatus({ type: 'progress', msg: 'קורא קובץ...' })
    setUploading(true)
    const reader = new FileReader()
    reader.onload = ev => {
      const worker = new Worker('/excelWorker.js')
      worker.onmessage = async (me) => {
        if (me.data.type === 'progress') {
          setStatus({ type: 'progress', msg: me.data.msg })
        } else if (me.data.type === 'error') {
          setStatus({ type: 'error', msg: me.data.msg })
          setUploading(false)
          worker.terminate()
        } else if (me.data.type === 'done') {
          try {
            setStatus({ type: 'progress', msg: 'שומר ל-Supabase...' })
            if (me.data.fileType === 'snapshot') {
              await uploadSnapshot(me.data.plan, me.data.niso, me.data.invoices)
              setStatus({ type: 'success', msg: `✓ הועלו: ${me.data.plan.length} שורות תוכנית, ${me.data.niso.length} NISO, ${me.data.invoices.length} חשבוניות` })
            } else if (me.data.fileType === 'openorders') {
              await uploadOpenOrders(me.data.data)
              setStatus({ type: 'success', msg: `✓ הועלו ${me.data.data.length} הזמנות פתוחות` })
            } else if (me.data.fileType === 'customers_production') {
              await uploadCustomersProduction(me.data.customers, me.data.production, me.data.allocation, me.data.purchaseOrders)
              setStatus({ type: 'success', msg: `✓ הועלו: ${me.data.customers.length} לקוחות, ${me.data.production.length} פק"עות, ${me.data.allocation.length} חוסרים, ${me.data.purchaseOrders.length} הזמנות רכש` })
            }
          } catch (err) {
            setStatus({ type: 'error', msg: err.message })
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

  return (
    <div style={{ background: 'var(--surface-2)', border: '0.5px solid var(--border)', borderRadius: 12, padding: '1.2rem 1.4rem', maxWidth: 520 }}>
      <div style={{ fontWeight: 500, fontSize: 15, marginBottom: 12 }}>העלאת קובץ Excel</div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {FILE_TYPES.map(ft => (
          <button key={ft.key} onClick={() => setFileType(ft.key)}
            style={{ padding: '7px 14px', borderRadius: 'var(--radius)', border: '0.5px solid ' + (fileType === ft.key ? 'var(--border-accent)' : 'var(--border)'),
              background: fileType === ft.key ? 'var(--bg-accent)' : 'var(--surface-1)', cursor: 'pointer', fontSize: 13 }}>
            {ft.label}
          </button>
        ))}
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>{selected?.hint}</div>

      <input ref={inputRef} type="file" accept=".xlsx,.xls" onChange={handleFile} disabled={uploading}
        style={{ display: 'block', marginBottom: 12 }} />

      {status && (
        <div style={{ fontSize: 13, padding: '8px 12px', borderRadius: 'var(--radius)',
          background: status.type === 'success' ? '#eaf3de' : status.type === 'error' ? '#fbe9e7' : 'var(--bg-accent)',
          color: status.type === 'success' ? '#1a6e3a' : status.type === 'error' ? 'var(--red)' : 'var(--text-primary)' }}>
          {status.msg}
        </div>
      )}
    </div>
  )
}
