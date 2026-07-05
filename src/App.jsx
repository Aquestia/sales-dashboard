import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import SalesDashboard from './components/SalesDashboard'
import CustomerCard from './components/CustomerCard'
import ProductionView from './components/ProductionView'
import CustomerInfoView from './components/CustomerInfoView'
import InvoicesView from './components/InvoicesView'
import BOView from './components/BOView'
import SnapshotView from './components/SnapshotView'
import MonthlyStatusView from './components/MonthlyStatusView'
import FileUpload from './components/FileUpload'
import {
  fetchCustomers, fetchSalesOrders, fetchProduction,
  fetchAllocation, fetchPurchaseOrders, fetchDR4, fetchDR5,
  fetchInvoicesDetail, fetchBO, fetchProcurementNotes
} from './utils/db'
import './App.css'

export default function App() {
  const [page, setPage] = useState(() => localStorage.getItem('sales_active_page') || 'sales')

  function handleNav(key) {
    localStorage.setItem('sales_active_page', key)
    setPage(key)
  }
  const [data, setData] = useState({
    customers: [], salesOrders: [], production: [],
    allocation: [], purchaseOrders: [], dr4: [], dr5: [],
    invoicesDetail: [], bo: [], procurementNotes: {}
  })
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    Promise.all([
      fetchCustomers(), fetchSalesOrders(), fetchProduction(),
      fetchAllocation(), fetchPurchaseOrders(), fetchDR4(), fetchDR5(),
      fetchInvoicesDetail(), fetchBO(), fetchProcurementNotes()
    ]).then(([customers, salesOrders, production, allocation, purchaseOrders, dr4, dr5, invoicesDetail, bo, procurementNotes]) => {
      setData({ customers, salesOrders, production, allocation, purchaseOrders, dr4, dr5, invoicesDetail, bo, procurementNotes })
      setLoaded(true)
    })
  }, [])

  function reload() {
    setLoaded(false)
    Promise.all([
      fetchCustomers(), fetchSalesOrders(), fetchProduction(),
      fetchAllocation(), fetchPurchaseOrders(), fetchDR4(), fetchDR5(),
      fetchInvoicesDetail(), fetchBO(), fetchProcurementNotes()
    ]).then(([customers, salesOrders, production, allocation, purchaseOrders, dr4, dr5, invoicesDetail, bo, procurementNotes]) => {
      setData({ customers, salesOrders, production, allocation, purchaseOrders, dr4, dr5, invoicesDetail, bo, procurementNotes })
      setLoaded(true)
    })
  }

  const loading = !loaded && page !== 'snapshot' && page !== 'upload'

  return (
    <div className="layout" dir="rtl">
      <Sidebar page={page} onNav={handleNav} />
      <main className="main-content">
        {loading && <div className="loading">טוען נתונים...</div>}
        {page === 'monthly'    && loaded && <MonthlyStatusView production={data.production} dr4={data.dr4} dr5={data.dr5} />}
        {page === 'sales'      && loaded && <SalesDashboard />}
        {page === 'bo'         && loaded && <BOView bo={data.bo} allocation={data.allocation} purchaseOrders={data.purchaseOrders} procurementNotes={data.procurementNotes} production={data.production} salesOrders={data.salesOrders} dr4={data.dr4} dr5={data.dr5} />}
        {page === 'invoices'   && loaded && <InvoicesView invoices={data.invoicesDetail} />}
        {page === 'production' && loaded && <ProductionView production={data.production} allocation={data.allocation} purchaseOrders={data.purchaseOrders} dr4={data.dr4} dr5={data.dr5} />}
        {page === 'customer'   && loaded && <CustomerCard customers={data.customers} salesOrders={data.salesOrders} production={data.production} allocation={data.allocation} purchaseOrders={data.purchaseOrders} dr4={data.dr4} dr5={data.dr5} />}
        {page === 'custinfo'   && loaded && <CustomerInfoView customers={data.customers} />}
        {page === 'snapshot'   && <SnapshotView />}
        {page === 'upload'     && <FileUpload onUploaded={reload} />}
      </main>
    </div>
  )
}
