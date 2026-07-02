importScripts('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js')

function isInternal(account) {
  return String(account || '').trim().toUpperCase().startsWith('CS')
}

function safeDate(val) {
  if (!val) return null
  try {
    const d = new Date(val)
    if (isNaN(d)) return null
    return d.toISOString().split('T')[0]
  } catch { return null }
}

function safeNum(val) {
  const n = parseFloat(val)
  return isNaN(n) ? 0 : n
}

self.onmessage = function (e) {
  const { buffer, fileType } = e.data
  // fileType: 'snapshot' | 'openorders' | 'customers_production'

  try {
    const wb = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true })
    const sheets = wb.SheetNames

    postMessage({ type: 'progress', msg: 'קורא לשוניות...' })

    if (fileType === 'snapshot') {
      // File: דוח_מכירות - sheets: שורות הזמנה, NISO, דוח חשבוניות
      const planSheet = wb.Sheets['שורות הזמנה']
      const nisoSheet = wb.Sheets['NISO']
      const invSheet  = wb.Sheets['דוח חשבוניות']

      const planRows = XLSX.utils.sheet_to_json(planSheet, { defval: '' })
      const nisoRows = XLSX.utils.sheet_to_json(nisoSheet, { defval: '' })
      const invRows  = XLSX.utils.sheet_to_json(invSheet,  { defval: '' })

      postMessage({ type: 'progress', msg: `עיבוד תוכנית (${planRows.length} שורות)...` })
      const plan = planRows.map(r => ({
        report_date: safeDate(r['Report Date']),
        sales_order: r['Sales order'] || '',
        line_number: safeNum(r['Line number']),
        customer_account: r['Customer account'] || '',
        customer_name: r['Customer name'] || '',
        item_number: r['Item number'] || '',
        item_group: r['Item group'] || '',
        status: r['Status'] || '',
        confirmed_ship_date: safeDate(r['Confirmed ship date']),
        remaining_amount: safeNum(r['Remainig amount main currency']),
        cat: isInternal(r['Customer account']) ? 'Internal' : 'External'
      }))

      postMessage({ type: 'progress', msg: `עיבוד NISO (${nisoRows.length} שורות)...` })
      const niso = nisoRows.map(r => ({
        report_date: safeDate(r['Report Date']),
        sales_order: r['Sales order'] || '',
        line_number: safeNum(r['Line number']),
        customer: r['Customer'] || '',
        customer_name: r['Customer Name'] || '',
        item_number: r['Item number'] || '',
        ship_date: safeDate(r['Ship date']),
        quantity: safeNum(r['Quantity']),
        amount: safeNum(r['Amount $']),
        cat: isInternal(r['Customer']) ? 'Internal' : 'External'
      }))

      postMessage({ type: 'progress', msg: `עיבוד חשבוניות (${invRows.length} שורות)...` })
      const invoices = invRows.map(r => ({
        report_date: safeDate(r['Report Date']),
        invoice: r['Invoice'] || '',
        invoice_account: r['Invoice account'] || '',
        name: r['Name'] || '',
        sales_order: r['Sales order'] || '',
        invoice_date: safeDate(r['Date']),
        invoice_amount: safeNum(r['Invoice amount']),
        cat: isInternal(r['Invoice account']) ? 'Internal' : 'External'
      }))

      postMessage({ type: 'done', fileType: 'snapshot', plan, niso, invoices })

    } else if (fileType === 'openorders') {
      // File: מכירות.xlsx - sheet: Sheet1
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheets[0]], { defval: '' })
      postMessage({ type: 'progress', msg: `עיבוד ${rows.length} שורות הזמנות פתוחות...` })
      const data = rows.map(r => ({
        sales_order: r['Sales order'] || '',
        line_number: safeNum(r['Line number']),
        customer_account: r['Customer account'] || '',
        customer_name: r['Customer name'] || '',
        sale_type_code: r['Sale type code'] || '',
        item_number: r['Item number'] || '',
        item_group: r['Item group'] || '',
        status: r['Status'] || '',
        mode_of_delivery: r['Mode of delivery'] || '',
        pool: r['Pool'] || '',
        family: r['Family'] || '',
        confirmed_ship_date: safeDate(r['Confirmed ship date']),
        remaining_amount: safeNum(r['Remainig amount main currency']),
        gm_pct: safeNum(r['GM %']),
        gm_amount: safeNum(r['GM  Main Currency']),
        planning_priority: parseInt(r['Planning priority']) || 0,
        cat: isInternal(r['Customer account']) ? 'Internal' : 'External'
      }))
      postMessage({ type: 'done', fileType: 'openorders', data })

    } else if (fileType === 'customers_production') {
      // File: check_data.xlsx - sheets: Customers, Production, Calculated Allocation, Open Purchase Orders
      const custRows  = XLSX.utils.sheet_to_json(wb.Sheets['Customers'] || wb.Sheets[sheets[0]], { defval: '' })
      const prodRows  = XLSX.utils.sheet_to_json(wb.Sheets['Production'] || wb.Sheets[sheets[1]], { defval: '' })
      const allocRows = XLSX.utils.sheet_to_json(wb.Sheets['Calculated Allocation'] || wb.Sheets[sheets[2]], { defval: '' })
      const poRows    = XLSX.utils.sheet_to_json(wb.Sheets['Open Purchase Orders'] || wb.Sheets[sheets[3]], { defval: '' })

      postMessage({ type: 'progress', msg: `עיבוד ${custRows.length} לקוחות...` })
      const customers = custRows.map(r => ({
        customer_account: r['Customer account'] || '',
        name: r['Name'] || r['Account name'] || '',
        search_name: r['Search name'] || '',
        phone: r['Phone'] || '',
        email: r['Email address'] || '',
        city: r['City'] || '',
        state: r['State'] || '',
        country: r['Country/region'] || '',
        zip: r['ZIP/postal code'] || '',
        account_number: r['Account number'] || '',
        cat: isInternal(r['Customer account']) ? 'Internal' : 'External'
      })).filter(r => r.customer_account)

      postMessage({ type: 'progress', msg: `עיבוד ${prodRows.length} פק"עות...` })
      const production = prodRows.map(r => ({
        production: r['Production'] || '',
        reference_number: r['Reference number'] || '',
        customer_name: r['Customer name'] || '',
        item_number: r['Item number'] || '',
        quantity: safeNum(r['Quantity']),
        status: r['Status'] || '',
        planning_priority: parseInt(r['Planning priority']) || 188,
        start_date: safeDate(r['Start date']),
        shortage_exist: r['Production shortage exist'] || 'No',
        components_in_station: r['Components in station'] || ''
      }))

      postMessage({ type: 'progress', msg: `עיבוד ${allocRows.length} שורות Calc Allocation...` })
      const allocation = allocRows.map(r => {
        const req = safeNum(r['Requested quantity'])
        const alloc = safeNum(r['Quantity allocated'])
        return {
          number: r['Number'] || '',
          reference: r['Reference'] || '',
          item_number: r['Item number'] || '',
          product_name: r['Product name'] || '',
          customer_name: r['Customer name'] || '',
          requested_qty: req,
          allocated_qty: alloc,
          missing_qty: Math.max(0, req - alloc),
          requested_delivery_date: safeDate(r['Requested delivery date']),
          run_date: safeDate(r['Run Date'])
        }
      }).filter(r => r.missing_qty > 0)

      postMessage({ type: 'progress', msg: `עיבוד ${poRows.length} הזמנות רכש...` })
      const purchaseOrders = poRows.map(r => ({
        item_number: r['Item number'] || '',
        purchase_order: r['Purchase order'] || '',
        vendor_name: r['Vendor name'] || '',
        deliver_remainder: safeNum(r['Deliver remainder']),
        confirmed_receipt_date: safeDate(r['Confirmed receipt date']),
        requested_receipt_date: safeDate(r['Requested receipt date']),
        document_status: r['Document status'] || ''
      })).filter(r => r.deliver_remainder > 0)

      postMessage({ type: 'done', fileType: 'customers_production', customers, production, allocation, purchaseOrders })
    }

  } catch (err) {
    postMessage({ type: 'error', msg: err.message })
  }
}
