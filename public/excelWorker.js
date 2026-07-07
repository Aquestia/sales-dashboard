importScripts('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js')

function isInternal(account) {
  return String(account || '').trim().toUpperCase().startsWith('CS')
}

function safeDate(val) {
  if (!val) return null
  try {
    const d = val instanceof Date ? val : new Date(val)
    if (isNaN(d)) return null
    // Use LOCAL date to avoid UTC timezone shift (e.g. Israel UTC+3)
    const y = d.getFullYear()
    const m = String(d.getMonth()+1).padStart(2,'0')
    const day = String(d.getDate()).padStart(2,'0')
    return y + '-' + m + '-' + day
  } catch { return null }
}

function safeNum(val) {
  if (val === '' || val === null || val === undefined) return 0
  const n = parseFloat(val)
  return isNaN(n) ? 0 : n
}

function safeStr(val) {
  if (val === null || val === undefined) return ''
  return String(val).trim()
}

function readSheet(wb, name) {
  const sheet = wb.Sheets[name]
  if (!sheet) throw new Error(`לא נמצאה לשונית "${name}"`)
  return XLSX.utils.sheet_to_json(sheet, { defval: '' })
}

self.onmessage = function (e) {
  const { buffer, fileType } = e.data

  try {
    postMessage({ type: 'progress', msg: 'קורא קובץ Excel...' })
    const wb = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true })
    postMessage({ type: 'progress', msg: 'לשוניות: ' + wb.SheetNames.join(', ') })

    if (fileType === 'snapshot') {
      // קובץ דוח מכירות יומי
      const planRows = readSheet(wb, 'שורות הזמנה')
      const nisoRows = readSheet(wb, 'NISO')
      const invRows  = readSheet(wb, 'דוח חשבוניות')

      postMessage({ type: 'progress', msg: `עיבוד תוכנית (${planRows.length} שורות)...` })
      const plan = planRows.map(r => ({
        report_date: safeDate(r['Report Date']),
        sales_order: safeStr(r['Sales order']),
        line_number: safeNum(r['Line number']),
        customer_account: safeStr(r['Customer account']),
        customer_name: safeStr(r['Customer name']),
        item_number: safeStr(r['Item number']),
        item_group: safeStr(r['Item group']),
        status: safeStr(r['Status']),
        confirmed_ship_date: safeDate(r['Confirmed ship date']),
        remaining_amount: safeNum(r['Remainig amount main currency']),
        cat: isInternal(r['Customer account']) ? 'Internal' : 'External'
      })).filter(r => r.report_date)

      postMessage({ type: 'progress', msg: `עיבוד NISO (${nisoRows.length} שורות)...` })
      const niso = nisoRows.map(r => ({
        report_date: safeDate(r['Report Date']),
        sales_order: safeStr(r['Sales order']),
        line_number: safeNum(r['Line number']),
        customer: safeStr(r['Customer']),
        customer_name: safeStr(r['Customer Name']),
        item_number: safeStr(r['Item number']),
        ship_date: safeDate(r['Ship date']),
        quantity: safeNum(r['Quantity']),
        amount: safeNum(r['Amount $']),
        cat: isInternal(r['Customer']) ? 'Internal' : 'External'
      })).filter(r => r.report_date)

      postMessage({ type: 'progress', msg: `עיבוד חשבוניות (${invRows.length} שורות)...` })
      const invoices = invRows.map(r => ({
        report_date: safeDate(r['Report Date']),
        invoice: safeStr(r['Invoice']),
        invoice_account: safeStr(r['Invoice account']),
        name: safeStr(r['Name']),
        sales_order: safeStr(r['Sales order']),
        invoice_date: safeDate(r['Date']),
        invoice_amount: safeNum(r['Invoice amount']),
        cat: isInternal(r['Invoice account']) ? 'Internal' : 'External'
      })).filter(r => r.report_date)

      postMessage({ type: 'done', fileType: 'snapshot', plan, niso, invoices })

    } else if (fileType === 'main') {
      // קובץ check_data.xlsx — כל 12 הלשוניות
      const soRows    = readSheet(wb, 'Sales orders')
      const prodRows  = readSheet(wb, 'Production')
      const custRows  = readSheet(wb, 'Customers')
      const allocRows = readSheet(wb, 'Calculated Allocation')
      const poRows    = readSheet(wb, 'Open Purchase Orders')
      const dr4Rows   = readSheet(wb, 'DR4')
      const dr5Rows   = readSheet(wb, 'DR5')
      const invRows   = readSheet(wb, 'Invoices')
      const boRows    = readSheet(wb, 'BO')

      // Customers
      postMessage({ type: 'progress', msg: `עיבוד ${custRows.length} לקוחות...` })
      const customers = custRows.map(r => ({
        customer_account: safeStr(r['Customer account']),
        name: safeStr(r['Name']),
        search_name: safeStr(r['Search name']),
        phone: safeStr(r['Phone']),
        email: safeStr(r['Email address']),
        city: safeStr(r['City']),
        state: safeStr(r['State']),
        country: safeStr(r['Country/region']),
        zip: safeStr(r['ZIP/postal code']),
        account_number: safeStr(r['Account number']),
        cat: isInternal(r['Customer account']) ? 'Internal' : 'External'
      })).filter(r => r.customer_account)

      // Sales orders
      postMessage({ type: 'progress', msg: `עיבוד ${soRows.length} שורות הזמנות...` })
      const salesOrders = soRows.map(r => ({
        sales_order: safeStr(r['Sales order']),
        line_number: safeNum(r['Line number']),
        customer_account: safeStr(r['Customer account']),
        customer_name: safeStr(r['Customer name']),
        sale_type_code: safeStr(r['Sale type code']),
        item_number: safeStr(r['Item number']),
        item_group: safeStr(r['Item group']),
        production_number: safeStr(r['Production']),
        status: safeStr(r['Status']),
        mode_of_delivery: safeStr(r['Mode of delivery']),
        pool: safeStr(r['Pool']),
        family: safeStr(r['Family']),
        confirmed_ship_date: safeDate(r['Confirmed ship date']),
        requested_ship_date: safeDate(r['Requested ship date']),
        ordered_quantity: safeNum(r['Ordered quantity']),
        deliver_remainder: safeNum(r['Deliver remainder']),
        qty_picked: safeNum(r['Quantity picked']),
        qty_packed: safeNum(r['Quantity packed']),
        remaining_amount: safeNum(r['Remainig amount main currency']),
        gm_pct: safeNum(r['GM %']),
        gm_amount: safeNum(r['GM  Main Currency']),
        planning_priority: parseInt(r['Planning priority']) || 188,
        zip_code: safeStr(r['ZIP/postal code']),
        cat: isInternal(r['Customer account']) ? 'Internal' : 'External'
      })).filter(r => r.sales_order)

      // Production
      postMessage({ type: 'progress', msg: `עיבוד ${prodRows.length} פק"עות...` })
      const production = prodRows.map(r => ({
        production: safeStr(r['Production']),
        reference_number: safeStr(r['Reference number']),
        customer_name: safeStr(r['Customer name']),
        item_number: safeStr(r['Item number']),
        name: safeStr(r['Name']),
        pool: safeStr(r['Pool']),
        quantity: safeNum(r['Quantity']),
        status: safeStr(r['Status']),
        planning_priority: parseInt(r['Planning priority']) || 188,
        estimated_run_time: safeNum(r['Estimated run time']),
        start_date: safeDate(r['Start date']),
        shortage_exist: safeStr(r['Production shortage exist']) || 'No',
        components_in_station: safeStr(r['Components in station']),
        component_in_station_date: safeDate(r['Component in station date']),
        planning_comment: safeStr(r['Planning Comment']),
        reference_production: safeStr(r['Reference production'])
      })).filter(r => r.production)

      // Calculated Allocation — רק חוסרים
      postMessage({ type: 'progress', msg: `עיבוד ${allocRows.length} שורות חוסרים...` })
      const allocation = allocRows.map(r => {
        const req    = safeNum(r['Requested quantity'])
        const alloc  = safeNum(r['Quantity allocated'])
        return {
          number: safeStr(r['Number']),
          reference: safeStr(r['Reference']),
          item_number: safeStr(r['Item number']),
          product_name: safeStr(r['Product name']),
          default_order_type: safeStr(r['Default order type']),
          customer_name: safeStr(r['Customer name']),
          sale_type_code: safeStr(r['Sale type code']),
          requested_qty: req,
          allocated_qty: alloc,
          missing_qty: Math.max(0, req - alloc),
          requested_delivery_date: safeDate(r['Requested delivery date']),
          shortage_exist: safeStr(r['Shortage exist']),
          run_date: safeDate(r['Run Date'])
        }
      }).filter(r => r.shortage_exist === 'Yes' && r.number)

      // Open Purchase Orders
      postMessage({ type: 'progress', msg: `עיבוד ${poRows.length} הזמנות רכש...` })
      const purchaseOrders = poRows.map(r => ({
        item_number: safeStr(r['Item number']),
        purchase_order: safeStr(r['Purchase order']),
        line_number: safeNum(r['Line number']),
        vendor_name: safeStr(r['Vendor name']),
        buyer_group: safeStr(r['Buyer group']),
        text: safeStr(r['Text']),
        quantity: safeNum(r['Quantity']),
        deliver_remainder: safeNum(r['Deliver remainder']),
        confirmed_receipt_date: safeDate(r['Confirmed receipt date']),
        requested_receipt_date: safeDate(r['Requested receipt date']),
        document_status: safeStr(r['Document status'])
      })).filter(r => r.deliver_remainder > 0 && r.item_number)

      // DR4
      postMessage({ type: 'progress', msg: `עיבוד ${dr4Rows.length} שורות DR4...` })
      const dr4 = dr4Rows.map(r => ({
        parent_production_order: safeStr(r['Parent production order '] || r['Parent production order']),
        production_order: safeStr(r['Production order']),
        item_number: safeStr(r['Item number']),
        product_name: safeStr(r['Product name']),
        quantity: safeNum(r['Quantity']),
        quantity_for_parent_po: safeNum(r['Quantity for parent PO']),
        status: safeStr(r['Status']),
        estimated_run_time: safeNum(r['Estimated run time']),
        actual_run_time: safeNum(r['Actual run time']),
        main_component: safeStr(r['Main component']),
        main_component_name: safeStr(r['Main component name']),
        main_component_available: safeNum(r['Main component available physical']),
        components_in_station: safeStr(r['Components in station']),
        original_delivery_date: safeDate(r['Original Delivery Date']),
        production_date: safeDate(r['Production date'])
      })).filter(r => r.parent_production_order)

      // DR5
      postMessage({ type: 'progress', msg: `עיבוד ${dr5Rows.length} שורות DR5...` })
      const dr5 = dr5Rows.map(r => ({
        parent_production_order: safeStr(r['Parent production order '] || r['Parent production order']),
        production_order: safeStr(r['Production order']),
        item_number: safeStr(r['Item number']),
        product_name: safeStr(r['Product name']),
        quantity: safeNum(r['Quantity']),
        quantity_for_parent_po: safeNum(r['Quantity for parent PO']),
        status: safeStr(r['Status']),
        estimated_run_time: safeNum(r['Estimated run time']),
        actual_run_time: safeNum(r['Actual run time']),
        main_component: safeStr(r['Main component']),
        main_component_name: safeStr(r['Main component name']),
        main_component_available: safeNum(r['Main component available physical']),
        components_in_station: safeStr(r['Components in station']),
        original_delivery_date: safeDate(r['Original Delivery Date']),
        production_date: safeDate(r['Production date'])
      })).filter(r => r.parent_production_order)

      // Invoices
      postMessage({ type: 'progress', msg: `עיבוד ${invRows.length} חשבוניות...` })
      const invoicesDetail = invRows.map(r => ({
        invoice: safeStr(r['Invoice']),
        invoice_account: safeStr(r['Invoice account']),
        name: safeStr(r['Name']),
        sales_order: safeStr(r['Sales order']),
        sale_type_code: safeStr(r['Sale type code']),
        invoice_date: safeDate(r['Date']),
        currency: safeStr(r['Currency']),
        invoice_amount: safeNum(r['The sales subtotal amount, in the accounting currency']),
        cat: isInternal(r['Invoice account']) ? 'Internal' : 'External'
      })).filter(r => r.invoice)

      // BO
      postMessage({ type: 'progress', msg: `עיבוד ${boRows.length} שורות Back Orders...` })
      const bo = boRows.map(r => ({
        doc: safeStr(r['Doc']),
        line: safeNum(r['Line']),
        sales_status: safeStr(r['Sales Status']),
        creation_date: safeDate(r['Creation Date']),
        requested_date: safeDate(r['Requested Date']),
        customer: safeStr(r['Customer']),
        item_code: safeStr(r['Item Code']),
        back_orders_amount: safeNum(r['Back Orders $']),
        open_sales_amount: safeNum(r['Open Sales Amount USD']),
        past_due: safeNum(r['Past Due $']),
        unconfirmed: safeNum(r['Unconfirmed $'])
      })).filter(r => r.doc)

      // תעודות משלוח ללא חשבוניות (לשונית חדשה — אופציונלית לתאימות לאחור)
      const dnRows = wb.Sheets['תעודות משלוח'] ? readSheet(wb, 'תעודות משלוח') : []
      postMessage({ type: 'progress', msg: `עיבוד ${dnRows.length} תעודות משלוח...` })
      const deliveryNotes = dnRows.map(r => ({
        customer: safeStr(r['Customer']),
        sales_order: safeStr(r['Sales order']),
        line_number: safeNum(r['Line number']),
        item_number: safeStr(r['Item number']),
        ship_date: safeDate(r['Ship date']),
        quantity: safeNum(r['Quantity']),
        currency: (safeStr(r['Currency']) || 'ILS').toUpperCase(),
        unit_price: safeNum(r['Unit price']),
        cat: isInternal(r['Customer']) ? 'Internal' : 'External'
      })).filter(r => r.customer && r.sales_order)

      postMessage({ type: 'done', fileType: 'main', customers, salesOrders, production, allocation, purchaseOrders, dr4, dr5, invoicesDetail, bo, deliveryNotes })
    }

  } catch (err) {
    postMessage({ type: 'error', msg: String(err.message || err) })
  }
}
