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

export async function uploadMain({ filename, customers, salesOrders, production, allocation, purchaseOrders, dr4, dr5, invoicesDetail, bo, deliveryNotes }) {
  await upsertChunked('sales_customers', customers, 'customer_account')

  // Create file record and get id
  const fileRecord = await createSalesFile(filename || 'check_data.xlsx')
  const fileId = fileRecord.id

  // Insert sales orders with file_id
  const ordersWithFileId = salesOrders.map(o => ({ ...o, file_id: fileId }))
  await insertChunked('sales_open_orders', ordersWithFileId)

  await clearAndInsert('sales_production', production)
  await clearAndInsert('sales_allocation', allocation)
  await clearAndInsert('sales_purchase_orders', purchaseOrders)
  await clearAndInsert('sales_dr4', dr4)
  await clearAndInsert('sales_dr5', dr5)
  // Store invoices with file_id (like orders)
  const invoicesWithFileId = invoicesDetail.map(r => ({ ...r, file_id: fileId }))
  await supabase.from('sales_invoices_detail').delete().eq('file_id', fileId)
  if (invoicesWithFileId.length) await insertChunked('sales_invoices_detail', invoicesWithFileId)
  await clearAndInsert('sales_bo', bo)

  // תעודות משלוח ללא חשבוניות — נשמר לפי file_id (כמו הזמנות)
  const dnWithFileId = (deliveryNotes || []).map(r => ({ ...r, file_id: fileId }))
  await supabase.from('sales_delivery_notes').delete().eq('file_id', fileId)
  if (dnWithFileId.length) await insertChunked('sales_delivery_notes', dnWithFileId)
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

export async function fetchSalesOrders(fileId = null) {
  let targetFileId = fileId
  if (!targetFileId) {
    const { data: files } = await supabase
      .from('sales_files')
      .select('id')
      .order('uploaded_at', { ascending: false })
      .limit(1)
    if (!files || files.length === 0) return []
    targetFileId = files[0].id
  }
  return fetchSalesOrdersByFileId(targetFileId)
}

export async function fetchCustomers() {
  const { data } = await supabase.from('sales_customers').select('*').order('name')
  return data || []
}

async function fetchAll(table, extra='') {
  let all = [], from = 0, size = 1000
  while (true) {
    let q = supabase.from(table).select('*').range(from, from + size - 1)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    all = all.concat(data)
    if (data.length < size) break
    from += size
  }
  return all
}

export async function fetchProduction() { return fetchAll('sales_production') }

export async function fetchAllocation() { return fetchAll('sales_allocation') }

export async function fetchPurchaseOrders() { return fetchAll('sales_purchase_orders') }

export async function fetchDR4() { return fetchAll('sales_dr4') }

export async function fetchDR5() { return fetchAll('sales_dr5') }

export async function fetchInvoicesDetail(fileId = null) {
  if (fileId) {
    let all = [], from = 0, size = 1000
    while (true) {
      const { data, error } = await supabase.from('sales_invoices_detail').select('*').eq('file_id', fileId).range(from, from+size-1)
      if (error) throw new Error(error.message)
      if (!data || data.length === 0) break
      all = all.concat(data)
      if (data.length < size) break
      from += size
    }
    return all
  }
  return fetchAll('sales_invoices_detail')
}


export async function fetchDeliveryNotes(fileId = null) {
  let targetFileId = fileId
  if (!targetFileId) {
    const { data: files } = await supabase
      .from('sales_files')
      .select('id')
      .order('uploaded_at', { ascending: false })
      .limit(1)
    if (!files || files.length === 0) return []
    targetFileId = files[0].id
  }
  let all = [], from = 0, size = 1000
  while (true) {
    const { data, error } = await supabase
      .from('sales_delivery_notes')
      .select('*')
      .eq('file_id', targetFileId)
      .range(from, from + size - 1)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    all = all.concat(data)
    if (data.length < size) break
    from += size
  }
  return all
}

export async function createSalesFile(filename) {
  // Try to extract date from filename (e.g. "02.07.2026.xlsx" → "2026-07-02")
  let batchDate = new Date().toISOString().split('T')[0]
  const match = filename.match(/(\d{2})[.\-_](\d{2})[.\-_](\d{4})/)
  if (match) {
    const [, dd, mm, yyyy] = match
    batchDate = `${yyyy}-${mm}-${dd}`
  }

  const { data, error } = await supabase
    .from('sales_files')
    .insert({ filename, batch_date: batchDate })
    .select()
    .single()
  if (error) throw new Error('sales_files: ' + error.message)
  return data
}

export async function pruneSalesFiles() {
  // Keep only last 2 files
  const { data: files } = await supabase
    .from('sales_files')
    .select('id')
    .order('uploaded_at', { ascending: false })
  if (!files || files.length <= 2) return
  const toDelete = files.slice(2).map(f => f.id)
  // Delete associated orders + delivery notes first
  await supabase.from('sales_open_orders').delete().in('file_id', toDelete)
  await supabase.from('sales_delivery_notes').delete().in('file_id', toDelete)
  await supabase.from('sales_files').delete().in('id', toDelete)
}

export async function fetchSalesFiles() {
  const { data } = await supabase
    .from('sales_files')
    .select('*')
    .order('uploaded_at', { ascending: false })
  return data || []
}

export async function fetchSalesOrdersByFileId(fileId) {
  let all = []
  let from = 0
  const size = 1000
  while (true) {
    const { data, error } = await supabase
      .from('sales_open_orders')
      .select('*')
      .eq('file_id', fileId)
      .range(from, from + size - 1)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    all = all.concat(data)
    if (data.length < size) break
    from += size
  }
  return all
}

export async function fetchBO() {
  const { data } = await supabase.from('sales_bo').select('*')
  return data || []
}

export async function fetchProcurementNotes() {
  const { data } = await supabase.from('procurement_notes').select('*')
  const map = {}
  ;(data || []).forEach(n => { map[n.item_number] = n })
  return map
}

export async function saveProcurementNote(itemNumber, fields) {
  const { data: existing } = await supabase
    .from('procurement_notes')
    .select('id')
    .eq('item_number', itemNumber)
    .maybeSingle()

  const payload = {
    item_number: itemNumber,
    sales_order: '',
    line_number: '',
    updated_at: new Date().toISOString(),
    ...fields
  }

  if (existing?.id) {
    await supabase.from('procurement_notes').update(payload).eq('id', existing.id)
  } else {
    await supabase.from('procurement_notes').insert(payload)
  }
}

export async function deleteSalesFile(fileId) {
  await supabase.from('sales_open_orders').delete().eq('file_id', fileId)
  await supabase.from('sales_delivery_notes').delete().eq('file_id', fileId)
  await supabase.from('sales_files').delete().eq('id', fileId)
}

export async function updateSalesFileLabel(fileId, filename, batchDate) {
  const { error } = await supabase.from('sales_files')
    .update({ filename, batch_date: batchDate })
    .eq('id', fileId)
  if (error) throw new Error(error.message)
}
