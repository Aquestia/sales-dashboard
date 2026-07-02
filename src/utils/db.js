import { supabase } from '../supabaseClient'

const CHUNK = 400

async function insertChunked(table, rows) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase.from(table).insert(rows.slice(i, i + CHUNK))
    if (error) throw new Error(`${table}: ${error.message}`)
  }
}

async function upsertChunked(table, rows, conflictCol) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase.from(table).upsert(rows.slice(i, i + CHUNK), { onConflict: conflictCol })
    if (error) throw new Error(`${table}: ${error.message}`)
  }
}

async function clearAndInsert(table, rows) {
  const { error } = await supabase.from(table).delete().neq('id', 0)
  if (error) throw new Error(`clear ${table}: ${error.message}`)
  if (rows.length) await insertChunked(table, rows)
}

// ─── Upload ───────────────────────────────────────────────────────
export async function uploadSnapshot(plan, niso, invoices) {
  const planDates = [...new Set(plan.map(r => r.report_date).filter(Boolean))]
  const nisoDates = [...new Set(niso.map(r => r.report_date).filter(Boolean))]
  const invDates  = [...new Set(invoices.map(r => r.report_date).filter(Boolean))]

  if (planDates.length) await supabase.from('sales_plan').delete().in('report_date', planDates)
  if (nisoDates.length) await supabase.from('sales_niso').delete().in('report_date', nisoDates)
  if (invDates.length)  await supabase.from('sales_invoices').delete().in('report_date', invDates)

  await insertChunked('sales_plan', plan)
  await insertChunked('sales_niso', niso)
  await insertChunked('sales_invoices', invoices)
}

export async function uploadMain({ customers, salesOrders, production, allocation, purchaseOrders, dr4, dr5, invoicesDetail, bo }) {
  await upsertChunked('sales_customers', customers, 'customer_account')
  await clearAndInsert('sales_open_orders', salesOrders)
  await clearAndInsert('sales_production', production)
  await clearAndInsert('sales_allocation', allocation)
  await clearAndInsert('sales_purchase_orders', purchaseOrders)
  await clearAndInsert('sales_dr4', dr4)
  await clearAndInsert('sales_dr5', dr5)
  await clearAndInsert('sales_invoices_detail', invoicesDetail)
  await clearAndInsert('sales_bo', bo)
}

// ─── Read ─────────────────────────────────────────────────────────
export async function fetchSnapshotDates() {
  const { data } = await supabase.from('sales_plan').select('report_date').order('report_date', { ascending: false })
  const seen = new Set()
  return (data || []).map(r => r.report_date).filter(d => { if (seen.has(d)) return false; seen.add(d); return true })
}

export async function fetchSnapshotByDate(date) {
  const [p, n, inv] = await Promise.all([
    supabase.from('sales_plan').select('*').eq('report_date', date),
    supabase.from('sales_niso').select('*').eq('report_date', date),
    supabase.from('sales_invoices').select('*').eq('report_date', date),
  ])
  return { plan: p.data || [], niso: n.data || [], invoices: inv.data || [] }
}

export async function fetchSalesOrders() {
  let all = []
  let from = 0
  const size = 1000
  while (true) {
    const { data, error } = await supabase.from('sales_open_orders').select('*').range(from, from + size - 1)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    all = all.concat(data)
    if (data.length < size) break
    from += size
  }
  return all
}

export async function fetchCustomers() {
  const { data } = await supabase.from('sales_customers').select('*').order('name')
  return data || []
}

export async function fetchProduction() {
  const { data } = await supabase.from('sales_production').select('*')
  return data || []
}

export async function fetchAllocation() {
  const { data } = await supabase.from('sales_allocation').select('*')
  return data || []
}

export async function fetchPurchaseOrders() {
  const { data } = await supabase.from('sales_purchase_orders').select('*')
  return data || []
}

export async function fetchDR4() {
  const { data } = await supabase.from('sales_dr4').select('*')
  return data || []
}

export async function fetchDR5() {
  const { data } = await supabase.from('sales_dr5').select('*')
  return data || []
}

export async function fetchInvoicesDetail() {
  const { data } = await supabase.from('sales_invoices_detail').select('*').order('invoice_date', { ascending: false })
  return data || []
}

export async function fetchBO() {
  const { data } = await supabase.from('sales_bo').select('*')
  return data || []
}
