importScripts('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js')

function isInternal(account) {
  return String(account || '').trim().toUpperCase().startsWith('CS')
}

function safeDate(val) {
  if (!val) return null
  try {
    if (val instanceof Date) return val.toISOString().split('T')[0]
    const d = new Date(val)
    if (isNaN(d)) return null
    return d.toISOString().split('T')[0]
  } catch { return null }
}

function safeNum(val) {
  if (val === '' || val === null || val === undefined) return 0
  const n = parseFloat(val)
  return isNaN(n) ? 0 : n
}

self.onmessage = function (e) {
  const { buffer, fileType } = e.data

  try {
    postMessage({ type: 'progress', msg: 'קורא קובץ Excel...' })
    const wb = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true })
    const sheets = wb.SheetNames
    postMessage({ type: 'progress', msg: 'לשוניות שנמצאו: ' + sheets.join(', ') })

    if (fileType === 'snapshot') {
      const planSheet = wb.Sheets['שורות הזמנה']
      const nisoSheet = wb.Sheets['NISO']
      const invSheet  = wb.Sheets['דוח חשבוניות']

      if (!planSheet) throw new Error('לא נמצאה לשונית "שורות הזמנה"')
      if (!nisoSheet) throw new Error('לא נמצאה לשונית "NISO"')
      if (!invSheet)  throw new Error('לא נמצאה לשונית "דוח חשבוניות"')

      const planRows = XLSX.utils.sheet_to_json(planSheet, { defval: '' })
      const nisoRows = XLSX.utils.sheet_to_json(nisoSheet, { defval: '' })
      const invRows  = XLSX.utils.sheet_to_json(invSheet,  { defval: '' })

      postMessage({ type: 'progress', msg: `עיבוד תוכנית (${planRows.length} שורות)...` })
      const plan = planRows.map(r => ({
        report_date: safeDate(r['Report Date']),
        sales_order: String(r['Sales order'] || ''),
        line_number: safeNum(r['Line number']),
        customer_account: String(r['Customer account'] || ''),
        customer_name: String(r['Customer name'] || ''),
        item_number: String(r['Item number'] || ''),
        item_group: String(r['Item group'] || ''),
        status: String(r['Status'] || ''),
        confirmed_ship_date: safeDate(r['Confirmed ship date']),
        remaining_amount: safeNum(r['Remainig amount main currency']),
        cat: isInternal(r['Customer account']) ? 'Internal' : 'External'
      })).filter(r => r.report_date)

      postMessage({ type: 'progress', msg: `עיבוד NISO (${nisoRows.length} שורות)...` })
      const niso = nisoRows.map(r => ({
        report_date: safeDate(r['Report Date']),
        sales_order: String(r['Sales order'] || ''),
        line_number: safeNum(r['Line number']),
        customer: String(r['Customer'] || ''),
        customer_name: String(r['Customer Name'] || ''),
        item_number: String(r['Item number'] || ''),
        ship_date: safeDate(r['Ship date']),
        quantity: safeNum(r['Quantity']),
        amount: safeNum(r['Amount $']),
        cat: isInternal(r['Customer']) ? 'Internal' : 'External'
      })).filter(r => r.report_date)

      postMessage({ type: 'progress', msg: `עיבוד חשבוניות (${invRows.length} שורות)...` })
      const invoices = invRows.map(r => ({
        report_date: safeDate(r['Report Date']),
        invoice: String(r['Invoice'] || ''),
        invoice_account: String(r['Invoice account'] || ''),
        name: String(r['Name'] || ''),
        sales_order: String(r['Sales order'] || ''),
        invoice_date: safeDate(r['Date']),
        invoice_amount: safeNum(r['Invoice amount']),
        cat: isInternal(r['Invoice account']) ? 'Internal' : 'External'
      })).filter(r => r.report_date)

      postMessage({ type: 'done', fileType: 'snapshot', plan, niso, invoices })

    } else if (fileType === 'openorders') {
      const sheetName = sheets.includes('Sheet1') ? 'Sheet1' : sheets[0]
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' })
      postMessage({ type: 'progress', msg: `עיבוד ${rows.length} שורות הזמנות פתוחות...` })
      const data = rows.map(r => ({
        sales_order: String(r['Sales order'] || ''),
        line_number: safeNum(r['Line number']),
        customer_account: String(r['Customer account'] || ''),
        customer_name: String(r['Customer name'] || ''),
        sale_type_code: String(r['Sale type code'] || ''),
        item_number: String(r['Item number'] || ''),
        item_group: String(r['Item group'] || ''),
        status: String(r['Status'] || ''),
        mode_of_delivery: String(r['Mode of delivery'] || ''),
        pool: String(r['Pool'] || ''),
        family: String(r['Family'] || ''),
        confirmed_ship_date: safeDate(r['Confirmed ship date']),
        remaining_amount: safeNum(r['Remainig amount main currency']),
        gm_pct: safeNum(r['GM %']),
        gm_amount: safeNum(r['GM  Main Currency']),
        planning_priority: parseInt(r['Planning priority']) || 0,
        cat: isInternal(r['Customer account']) ? 'Internal' : 'External'
      })).filter(r => r.sales_order)
      postMessage({ type: 'done', fileType: 'openorders', data })

    } else if (fileType === 'customers_production') {
      const custSheet  = wb.Sheets['Customers']
      const prodSheet  = wb.Sheets['Production']
      const allocSheet = wb.Sheets['Calculated Allocation']
      const poSheet    = wb.Sheets['Open Purchase Orders']

      if (!custSheet)  throw new Error('לא נמצאה לשונית "Customers"')
      if (!prodSheet)  throw new Error('לא נמצאה לשונית "Production"')
      if (!allocSheet) throw new Error('לא נמצאה לשונית "Calculated Allocation"')
      if (!poSheet)    throw new Error('לא נמצאה לשונית "Open Purchase Orders"')

      const custRows  = XLSX.utils.sheet_to_json(custSheet,  { defval: '' })
      const prodRows  = XLSX.utils.sheet_to_json(prodSheet,  { defval: '' })
      const allocRows = XLSX.utils.sheet_to_json(allocSheet, { defval: '' })
      const poRows    = XLSX.utils.sheet_to_json(poSheet,    { defval: '' })

      postMessage({ type: 'progress', msg: `עיבוד ${custRows.length} לקוחות...` })
      const customers = custRows.map(r => ({
        customer_account: String(r['Customer account'] || ''),
        name: String(r['Name'] || r['Account name'] || ''),
        search_name: String(r['Search name'] || ''),
        phone: String(r['Phone'] || ''),
        email: String(r['Email address'] || ''),
        city: String(r['City'] || ''),
        state: String(r['State'] || ''),
        country: String(r['Country/region'] || ''),
        zip: String(r['ZIP/postal code'] || ''),
        account_number: String(r['Account number'] || ''),
        cat: isInternal(r['Customer account']) ? 'Internal' : 'External'
      })).filter(r => r.customer_account)

      postMessage({ type: 'progress', msg: `עיבוד ${prodRows.length} פק"עות...` })
      const production = prodRows.map(r => ({
        production: String(r['Production'] || ''),
        reference_number: String(r['Reference number'] || ''),
        customer_name: String(r['Customer name'] || ''),
        item_number: String(r['Item number'] || ''),
        quantity: safeNum(r['Quantity']),
        status: String(r['Status'] || ''),
        planning_priority: parseInt(r['Planning priority']) || 188,
        start_date: safeDate(r['Start date']),
        shortage_exist: String(r['Production shortage exist'] || 'No'),
        components_in_station: String(r['Components in station'] || '')
      })).filter(r => r.production)

      postMessage({ type: 'progress', msg: `עיבוד ${allocRows.length} שורות Calc Allocation...` })
      const allocation = allocRows.map(r => {
        const req   = safeNum(r['Requested quantity'])
        const alloc = safeNum(r['Quantity allocated'])
        const missing = Math.max(0, req - alloc)
        return {
          number: String(r['Number'] || ''),
          reference: String(r['Reference'] || ''),
          item_number: String(r['Item number'] || ''),
          product_name: String(r['Product name'] || ''),
          customer_name: String(r['Customer name'] || ''),
          requested_qty: req,
          allocated_qty: alloc,
          missing_qty: missing,
          requested_delivery_date: safeDate(r['Requested delivery date']),
          run_date: safeDate(r['Run Date'])
        }
      }).filter(r => r.missing_qty > 0 && r.number)

      postMessage({ type: 'progress', msg: `עיבוד ${poRows.length} הזמנות רכש...` })
      const purchaseOrders = poRows.map(r => ({
        item_number: String(r['Item number'] || ''),
        purchase_order: String(r['Purchase order'] || ''),
        vendor_name: String(r['Vendor name'] || ''),
        deliver_remainder: safeNum(r['Deliver remainder']),
        confirmed_receipt_date: safeDate(r['Confirmed receipt date']),
        requested_receipt_date: safeDate(r['Requested receipt date']),
        document_status: String(r['Document status'] || '')
      })).filter(r => r.deliver_remainder > 0 && r.item_number)

      postMessage({ type: 'done', fileType: 'customers_production', customers, production, allocation, purchaseOrders })
    }

  } catch (err) {
    postMessage({ type: 'error', msg: String(err.message || err) })
  }
}
