import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import SalesDashboard from './components/SalesDashboard'
import CustomerCard from './components/CustomerCard'
import CustomerInfoView from './components/CustomerInfoView'
import InvoicesView from './components/InvoicesView'
import BOView from './components/BOView'
import UrgentView from './components/UrgentView'
import ShipmentPlanView from './components/ShipmentPlanView'
import MonthlyStatusView from './components/MonthlyStatusView'
import FileUpload from './components/FileUpload'
import DeliveryNotesView from './components/DeliveryNotesView'
import LocalMarketView from './components/LocalMarketView'
import {
  fetchCustomers, fetchSalesOrders, fetchProduction,
  fetchAllocation, fetchPurchaseOrders, fetchDR4, fetchDR5,
  fetchInvoicesDetail, fetchBO, fetchProcurementNotes, fetchUrgent
} from './utils/db'
import './App.css'

export default function App() {
  const VALID_PAGES = ['sales', 'monthly', 'bo', 'urgent', 'invoices', 'delivery', 'customer', 'custinfo', 'shipplan', 'localmarket', 'upload']
  const [page, setPage] = useState(() => {
    const saved = localStorage.getItem('sales_active_page')
    return VALID_PAGES.includes(saved) ? saved : 'sales'
  })

  function handleNav(key) {
    localStorage.setItem('sales_active_page', key)
    setPage(key)
  }
  const [data, setData] = useState({
    customers: [], salesOrders: [], production: [],
    allocation: [], purchaseOrders: [], dr4: [], dr5: [],
    invoicesDetail: [], bo: [], procurementNotes: {}, urgent: []
  })
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    Promise.all([
      fetchCustomers(), fetchSalesOrders(), fetchProduction(),
      fetchAllocation(), fetchPurchaseOrders(), fetchDR4(), fetchDR5(),
      fetchInvoicesDetail(), fetchBO(), fetchProcurementNotes(), fetchUrgent()
    ]).then(([customers, salesOrders, production, allocation, purchaseOrders, dr4, dr5, invoicesDetail, bo, procurementNotes, urgent]) => {
      setData({ customers, salesOrders, production, allocation, purchaseOrders, dr4, dr5, invoicesDetail, bo, procurementNotes, urgent })
      setLoaded(true)
    })
  }, [])

  function reload() {
    setLoaded(false)
    Promise.all([
      fetchCustomers(), fetchSalesOrders(), fetchProduction(),
      fetchAllocation(), fetchPurchaseOrders(), fetchDR4(), fetchDR5(),
      fetchInvoicesDetail(), fetchBO(), fetchProcurementNotes(), fetchUrgent()
    ]).then(([customers, salesOrders, production, allocation, purchaseOrders, dr4, dr5, invoicesDetail, bo, procurementNotes, urgent]) => {
      setData({ customers, salesOrders, production, allocation, purchaseOrders, dr4, dr5, invoicesDetail, bo, procurementNotes, urgent })
      setLoaded(true)
    })
  }

  // רענון קל של רשימת הדחופות בלבד (אחרי סימון/ביטול)
  async function reloadUrgent() {
    const urgent = await fetchUrgent()
    setData(d => ({ ...d, urgent }))
  }

  const loading = !loaded && page !== 'upload'

  return (
    <div className="layout" dir="rtl">
      <Sidebar page={page} onNav={handleNav} />
      <main className="main-content">
        {loading && <div className="loading">טוען נתונים...</div>}
        {page === 'monthly'    && loaded && <MonthlyStatusView production={data.production} dr4={data.dr4} dr5={data.dr5} />}
        {page === 'sales'      && loaded && <SalesDashboard />}
        {page === 'bo'         && loaded && <BOView bo={data.bo} allocation={data.allocation} purchaseOrders={data.purchaseOrders} procurementNotes={data.procurementNotes} production={data.production} salesOrders={data.salesOrders} dr4={data.dr4} dr5={data.dr5} />}
        {page === 'urgent'     && loaded && <UrgentView urgent={data.urgent} salesOrders={data.salesOrders} allocation={data.allocation} purchaseOrders={data.purchaseOrders} procurementNotes={data.procurementNotes} production={data.production} dr4={data.dr4} dr5={data.dr5} onUrgentChange={reloadUrgent} />}
        {page === 'invoices'   && loaded && <InvoicesView />}
        {page === 'delivery'   && loaded && <DeliveryNotesView />}
        {page === 'customer'   && loaded && <CustomerCard customers={data.customers} salesOrders={data.salesOrders} production={data.production} allocation={data.allocation} purchaseOrders={data.purchaseOrders} dr4={data.dr4} dr5={data.dr5} urgent={data.urgent} onUrgentChange={reloadUrgent} />}
        {page === 'custinfo'   && loaded && <CustomerInfoView customers={data.customers} />}
        {page === 'shipplan'   && loaded && <ShipmentPlanView salesOrders={data.salesOrders} customers={data.customers} production={data.production} allocation={data.allocation} purchaseOrders={data.purchaseOrders} dr4={data.dr4} dr5={data.dr5} procurementNotes={data.procurementNotes} />}
        {page === 'localmarket' && <LocalMarketView />}
        {page === 'upload'     && <FileUpload onUploaded={reload} />}
      </main>
    </div>
  )
}
