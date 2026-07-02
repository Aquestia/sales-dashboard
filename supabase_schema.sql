-- Sales Dashboard Schema
-- Run in Supabase SQL Editor

-- 1. תוכנית (שורות הזמנה)
create table if not exists sales_plan (
  id bigserial primary key,
  report_date date,
  sales_order text,
  line_number numeric,
  customer_account text,
  customer_name text,
  item_number text,
  item_group text,
  status text,
  confirmed_ship_date date,
  remaining_amount numeric,
  cat text, -- 'Internal' | 'External'
  uploaded_at timestamptz default now()
);
create index if not exists sales_plan_date_idx on sales_plan(report_date);

-- 2. תעודות משלוח (NISO)
create table if not exists sales_niso (
  id bigserial primary key,
  report_date date,
  sales_order text,
  line_number numeric,
  customer text,
  customer_name text,
  item_number text,
  ship_date date,
  quantity numeric,
  amount numeric,
  cat text,
  uploaded_at timestamptz default now()
);
create index if not exists sales_niso_date_idx on sales_niso(report_date);

-- 3. חשבוניות
create table if not exists sales_invoices (
  id bigserial primary key,
  report_date date,
  invoice text,
  invoice_account text,
  name text,
  sales_order text,
  invoice_date date,
  invoice_amount numeric,
  cat text,
  uploaded_at timestamptz default now()
);
create index if not exists sales_invoices_date_idx on sales_invoices(report_date);

-- 4. הזמנות פתוחות
create table if not exists sales_open_orders (
  id bigserial primary key,
  sales_order text,
  line_number numeric,
  customer_account text,
  customer_name text,
  sale_type_code text,
  item_number text,
  item_group text,
  status text,
  mode_of_delivery text,
  pool text,
  family text,
  confirmed_ship_date date,
  remaining_amount numeric,
  gm_pct numeric,
  gm_amount numeric,
  planning_priority integer,
  cat text,
  uploaded_at timestamptz default now()
);

-- 5. לקוחות
create table if not exists sales_customers (
  id bigserial primary key,
  customer_account text unique,
  name text,
  search_name text,
  phone text,
  email text,
  city text,
  state text,
  country text,
  zip text,
  account_number text,
  cat text,
  uploaded_at timestamptz default now()
);
create index if not exists sales_customers_account_idx on sales_customers(customer_account);

-- 6. ייצור
create table if not exists sales_production (
  id bigserial primary key,
  production text,
  reference_number text,
  customer_name text,
  item_number text,
  quantity numeric,
  status text,
  planning_priority integer,
  start_date date,
  shortage_exist text,
  components_in_station text,
  uploaded_at timestamptz default now()
);
create index if not exists sales_production_ref_idx on sales_production(reference_number);

-- 7. Calculated Allocation
create table if not exists sales_allocation (
  id bigserial primary key,
  number text,
  reference text,
  item_number text,
  product_name text,
  customer_name text,
  requested_qty numeric,
  allocated_qty numeric,
  missing_qty numeric,
  requested_delivery_date date,
  run_date date,
  uploaded_at timestamptz default now()
);
create index if not exists sales_allocation_number_idx on sales_allocation(number);

-- 8. Open Purchase Orders
create table if not exists sales_purchase_orders (
  id bigserial primary key,
  item_number text,
  purchase_order text,
  vendor_name text,
  deliver_remainder numeric,
  confirmed_receipt_date date,
  requested_receipt_date date,
  document_status text,
  uploaded_at timestamptz default now()
);
create index if not exists sales_po_item_idx on sales_purchase_orders(item_number);
