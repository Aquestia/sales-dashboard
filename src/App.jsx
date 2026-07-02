import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import SalesDashboard from './components/SalesDashboard'
import CustomerCard from './components/CustomerCard'
import ProductionView from './components/ProductionView'
import CustomerInfoView from './components/CustomerInfoView'
import InvoicesView from './components/InvoicesView'
import BOView from './components/BOView'
import SnapshotView from './components/SnapshotView'
import FileUpload from './components/FileUpload'
import {
  fetchCustomers, fetchSalesOrders, fetchProduction,
  fetchAllocation, fetchPurchaseOrders, fetchDR4, fetchDR5,
  fetchInvoicesDetail, fetchBO
} from './utils/db'
import './App.css'

export default function App() {
  const [page, setPage] = useState('sales')
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

  const loading = !loaded && page !== 'snapshot' && page !== 'upload'

  return (
    <div className="layout" dir="rtl">
      <Sidebar page={page} onNav={setPage} />
      <main className="main-content">
        {loading && <div className="loading">טוען נתונים...</div>}
        {page === 'sales'      && loaded && <SalesDashboard orders={data.salesOrders} />}
        {page === 'bo'         && loaded && <BOView bo={data.bo} allocation={data.allocation} purchaseOrders={data.purchaseOrders} />}
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
