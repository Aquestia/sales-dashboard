-- ═══════════════════════════════════════════════════════════════
-- מלאי שוק מקומי — 3 טבלאות חדשות
-- הרץ ב-Supabase SQL Editor (iqcqlkpjketbogusgtns)
-- ═══════════════════════════════════════════════════════════════

-- רשימת המק"טים של שוק מקומי + יעדי מלאי
create table if not exists local_items (
  id bigserial primary key,
  item_number text not null,
  description text,
  stock numeric default 0,
  min_qty numeric default 0,
  max_qty numeric default 0,
  family text,
  uploaded_at timestamptz default now()
);
create unique index if not exists local_items_item_idx on local_items(item_number);

-- פק"עות ייצור (לשונית "תוכנית")
create table if not exists local_plan (
  id bigserial primary key,
  production text,
  item_number text,
  name text,
  quantity numeric default 0,
  planning_priority integer,
  status text,
  components_in_station text,
  estimated_run_time numeric default 0,
  planning_comment text,
  start_date date,
  uploaded_at timestamptz default now()
);
create index if not exists local_plan_item_idx on local_plan(item_number);
create index if not exists local_plan_prio_idx on local_plan(planning_priority);

-- מלאי בנמצא (פירוט לפי מחסן/מיקום)
create table if not exists local_stock (
  id bigserial primary key,
  item_number text,
  warehouse text,
  location text,
  physical_inventory numeric default 0,
  total_available numeric default 0,
  uploaded_at timestamptz default now()
);
create index if not exists local_stock_item_idx on local_stock(item_number);
