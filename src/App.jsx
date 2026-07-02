import { useState, useEffect } from 'react'
import SnapshotView from './components/SnapshotView'
import CustomerCard from './components/CustomerCard'
import ProductionView from './components/ProductionView'
import CustomerInfoView from './components/CustomerInfoView'
import InvoicesView from './components/InvoicesView'
import BOView from './components/BOView'
import FileUpload from './components/FileUpload'
import {
  fetchCustomers, fetchSalesOrders, fetchProduction,
  fetchAllocation, fetchPurchaseOrders, fetchDR4, fetchDR5,
  fetchInvoicesDetail, fetchBO
} from './utils/db'
import './App.css'

const TABS = [
  { key: 'snapshot',   label: 'תוכנית / משלוח / חשבוניות' },
  { key: 'customer',   label: 'כרטיס לקוח' },
  { key: 'production', label: 'תכנון ייצור' },
  { key: 'bo',         label: 'Back Orders' },
  { key: 'invoices',   label: 'חשבוניות' },
  { key: 'custinfo',   label: 'פרטי לקוח' },
  { key: 'upload',     label: '⬆ העלאת קובץ' },
]

export default function App() {
  const [tab, setTab] = useState('snapshot')
  const [data, setData] = useState({
    customers: [], salesOrders: [], production: [],
    allocation: [], purchaseOrders: [], dr4: [], dr5: [],
    invoicesDetail: [], bo: []
  })
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    Promise.all([
      fetchCustomers(), fetchSalesOrders(), fetchProduction(),
      fetchAllocation(), fetchPurchaseOrders(), fetchDR4(), fetchDR5(),
      fetchInvoicesDetail(), fetchBO()
    ]).then(([customers, salesOrders, production, allocation, purchaseOrders, dr4, dr5, invoicesDetail, bo]) => {
      setData({ customers, salesOrders, production, allocation, purchaseOrders, dr4, dr5, invoicesDetail, bo })
      setLoaded(true)
    })
  }, [])

  function reload() {
    setLoaded(false)
    Promise.all([
      fetchCustomers(), fetchSalesOrders(), fetchProduction(),
      fetchAllocation(), fetchPurchaseOrders(), fetchDR4(), fetchDR5(),
      fetchInvoicesDetail(), fetchBO()
    ]).then(([customers, salesOrders, production, allocation, purchaseOrders, dr4, dr5, invoicesDetail, bo]) => {
      setData({ customers, salesOrders, production, allocation, purchaseOrders, dr4, dr5, invoicesDetail, bo })
      setLoaded(true)
    })
  }

  return (
    <div className="page" dir="rtl">
      <h1 className="page-title">דאשבורד מכירות — Aquestia</h1>
      <div className="tabbar">
        {TABS.map(t => (
          <button key={t.key} className={'tabbtn' + (tab === t.key ? ' active' : '')}
            onClick={() => { setTab(t.key); if (t.key === 'upload') {} }}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="tab-content">
        {!loaded && tab !== 'snapshot' && tab !== 'upload' && (
          <div style={{ color: 'var(--text-muted)', fontSize: 14, padding: '2rem 0' }}>טוען נתונים...</div>
        )}
        {tab === 'snapshot'   && <SnapshotView />}
        {tab === 'customer'   && loaded && <CustomerCard customers={data.customers} salesOrders={data.salesOrders} production={data.production} allocation={data.allocation} purchaseOrders={data.purchaseOrders} dr4={data.dr4} dr5={data.dr5} />}
        {tab === 'production' && loaded && <ProductionView production={data.production} allocation={data.allocation} purchaseOrders={data.purchaseOrders} dr4={data.dr4} dr5={data.dr5} />}
        {tab === 'bo'         && loaded && <BOView bo={data.bo} />}
        {tab === 'invoices'   && loaded && <InvoicesView invoices={data.invoicesDetail} />}
        {tab === 'custinfo'   && loaded && <CustomerInfoView customers={data.customers} />}
        {tab === 'upload'     && <FileUpload onUploaded={reload} />}
      </div>
    </div>
  )
}
