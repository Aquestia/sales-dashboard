-- הוספת טבלאות חדשות לדאשבורד מכירות
-- הרץ ב-Supabase SQL Editor

-- DR4 — עיבוד שבבי
create table if not exists sales_dr4 (
  id bigserial primary key,
  parent_production_order text,
  production_order text,
  item_number text,
  product_name text,
  quantity numeric,
  quantity_for_parent_po numeric,
  status text,
  estimated_run_time numeric,
  actual_run_time numeric,
  main_component text,
  main_component_name text,
  main_component_available numeric,
  components_in_station text,
  original_delivery_date date,
  production_date date,
  uploaded_at timestamptz default now()
);
create index if not exists sales_dr4_parent_idx on sales_dr4(parent_production_order);

-- DR5 — צבע
create table if not exists sales_dr5 (
  id bigserial primary key,
  parent_production_order text,
  production_order text,
  item_number text,
  product_name text,
  quantity numeric,
  quantity_for_parent_po numeric,
  status text,
  estimated_run_time numeric,
  actual_run_time numeric,
  main_component text,
  main_component_name text,
  main_component_available numeric,
  components_in_station text,
  original_delivery_date date,
  production_date date,
  uploaded_at timestamptz default now()
);
create index if not exists sales_dr5_parent_idx on sales_dr5(parent_production_order);

-- Invoices — חשבוניות מפורטות
create table if not exists sales_invoices_detail (
  id bigserial primary key,
  invoice text,
  invoice_account text,
  name text,
  sales_order text,
  sale_type_code text,
  invoice_date date,
  currency text,
  invoice_amount numeric,
  cat text,
  uploaded_at timestamptz default now()
);
create index if not exists sales_inv_detail_date_idx on sales_invoices_detail(invoice_date);

-- BO — Back Orders
create table if not exists sales_bo (
  id bigserial primary key,
  doc text,
  line numeric,
  sales_status text,
  creation_date date,
  requested_date date,
  customer text,
  item_code text,
  back_orders_amount numeric,
  open_sales_amount numeric,
  past_due numeric,
  unconfirmed numeric,
  uploaded_at timestamptz default now()
);
create index if not exists sales_bo_doc_idx on sales_bo(doc);

-- הוסף עמודת production_number לטבלת הזמנות פתוחות (אם לא קיימת)
alter table sales_open_orders add column if not exists production_number text;
