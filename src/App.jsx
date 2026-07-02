import { useState, useEffect } from 'react'
import SnapshotView from './components/SnapshotView'
import OpenOrdersView from './components/OpenOrdersView'
import CustomerCard from './components/CustomerCard'
import ProductionView from './components/ProductionView'
import CustomerInfoView from './components/CustomerInfoView'
import FileUpload from './components/FileUpload'
import { fetchCustomers, fetchProduction, fetchAllocation, fetchPurchaseOrders, fetchOpenOrders } from './utils/db'
import './App.css'

const TOP_TABS = [
  { key: 'snapshot',   label: 'תוכנית / משלוח / חשבוניות' },
  { key: 'openorders', label: 'הזמנות פתוחות' },
  { key: 'customer',   label: 'כרטיס לקוח' },
  { key: 'production', label: 'תכנון ייצור' },
  { key: 'custinfo',   label: 'פרטי לקוח' },
  { key: 'upload',     label: '⬆ העלאת קובץ' },
]

export default function App() {
  const [tab, setTab] = useState('snapshot')
  const [sharedData, setSharedData] = useState({ customers: [], production: [], allocation: [], purchaseOrders: [], openOrders: [] })
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    Promise.all([fetchCustomers(), fetchProduction(), fetchAllocation(), fetchPurchaseOrders()]).then(([c, p, a, po]) => {
      setSharedData(prev => ({ ...prev, customers: c, production: p, allocation: a, purchaseOrders: po }))
      setLoaded(true)
    })
  }, [])

  function handleTabChange(key) {
    setTab(key)
    if (key === 'openorders') {
      fetchOpenOrders().then(d => setSharedData(prev => ({ ...prev, openOrders: d })))
    }
    if (['customer', 'production', 'custinfo'].includes(key)) {
      Promise.all([fetchCustomers(), fetchProduction(), fetchAllocation(), fetchPurchaseOrders()]).then(([c, p, a, po]) => {
        setSharedData(prev => ({ ...prev, customers: c, production: p, allocation: a, purchaseOrders: po }))
      })
    }
  }

  return (
    <div className="page" dir="rtl">
      <h1 className="page-title">דאשבורד מכירות — Aquestia</h1>
      <div className="tabbar">
        {TOP_TABS.map(t => (
          <button key={t.key} className={'tabbtn' + (tab === t.key ? ' active' : '')} onClick={() => handleTabChange(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="tab-content">
        {tab === 'snapshot'   && <SnapshotView />}
        {tab === 'openorders' && <OpenOrdersView />}
        {tab === 'customer'   && loaded && <CustomerCard customers={sharedData.customers} salesOrders={sharedData.openOrders} production={sharedData.production} allocation={sharedData.allocation} purchaseOrders={sharedData.purchaseOrders} />}
        {tab === 'production' && loaded && <ProductionView production={sharedData.production} allocation={sharedData.allocation} purchaseOrders={sharedData.purchaseOrders} />}
        {tab === 'custinfo'   && loaded && <CustomerInfoView customers={sharedData.customers} />}
        {tab === 'upload'     && <FileUpload />}
      </div>
    </div>
  )
}
