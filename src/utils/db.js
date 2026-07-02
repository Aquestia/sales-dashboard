import { supabase } from '../supabaseClient'

const CHUNK = 500

async function upsertChunked(table, rows, conflictCol) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    const { error } = conflictCol
      ? await supabase.from(table).upsert(chunk, { onConflict: conflictCol })
      : await supabase.from(table).insert(chunk)
    if (error) throw new Error(`${table}: ${error.message}`)
  }
}

export async function uploadSnapshot(plan, niso, invoices) {
  const planDates = [...new Set(plan.map(r => r.report_date).filter(Boolean))]
  const nisoDates = [...new Set(niso.map(r => r.report_date).filter(Boolean))]
  const invDates  = [...new Set(invoices.map(r => r.report_date).filter(Boolean))]

  if (planDates.length) await supabase.from('sales_plan').delete().in('report_date', planDates)
  if (nisoDates.length) await supabase.from('sales_niso').delete().in('report_date', nisoDates)
  if (invDates.length)  await supabase.from('sales_invoices').delete().in('report_date', invDates)

  await upsertChunked('sales_plan', plan)
  await upsertChunked('sales_niso', niso)
  await upsertChunked('sales_invoices', invoices)
}

export async function uploadOpenOrders(data) {
  await supabase.from('sales_open_orders').delete().neq('id', 0)
  await upsertChunked('sales_open_orders', data)
}

export async function uploadCustomersProduction(customers, salesOrders, production, allocation, purchaseOrders) {
  await upsertChunked('sales_customers', customers, 'customer_account')

  await supabase.from('sales_open_orders').delete().neq('id', 0)
  if (salesOrders && salesOrders.length) await upsertChunked('sales_open_orders', salesOrders)

  await supabase.from('sales_production').delete().neq('id', 0)
  await supabase.from('sales_allocation').delete().neq('id', 0)
  await supabase.from('sales_purchase_orders').delete().neq('id', 0)

  await upsertChunked('sales_production', production)
  await upsertChunked('sales_allocation', allocation)
  await upsertChunked('sales_purchase_orders', purchaseOrders)
}

// ─── Read helpers ─────────────────────────────────────────────────
export async function fetchSnapshotDates() {
  const { data } = await supabase
    .from('sales_plan')
    .select('report_date')
    .order('report_date', { ascending: false })
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

export async function fetchOpenOrders() {
  const { data } = await supabase.from('sales_open_orders').select('*')
  return data || []
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
