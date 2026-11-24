-- Favo Enterprise — tables, Row Level Security and realtime.
-- Run in Supabase: SQL Editor → New query → paste → Run.

-- ===== Admin allow-list =====
create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
-- No policies: only security-definer functions read it.

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.admins where user_id = (select auth.uid())); $$;

-- ===== Catalog =====
create table public.sections (
  id text primary key default ('sec-' || substr(md5(gen_random_uuid()::text), 1, 10)),
  name text not null check (length(trim(name)) between 1 and 60),
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create unique index sections_name_unique on public.sections (lower(name));

create table public.products (
  id text primary key default ('p-' || substr(md5(gen_random_uuid()::text), 1, 12)),
  title text not null check (length(trim(title)) between 2 and 160),
  brand text not null default '' check (length(brand) <= 60),
  section_id text not null references public.sections(id),
  price integer not null check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  condition text not null default 'Brand New' check (condition in ('Brand New', 'Ex-UK / Refurbished', 'Pre-Order / Import')),
  image text not null default '' check (length(image) <= 2000),
  specs text not null default '' check (length(specs) <= 4000),
  description text not null default '' check (length(description) <= 4000),
  warranty text not null default '' check (length(warranty) <= 200),
  created_at timestamptz not null default now()
);
create index products_section_idx on public.products (section_id);

-- Cost prices are admin-only, so they live outside the public products table.
create table public.product_costs (
  product_id text primary key references public.products(id) on delete cascade,
  cost_price integer not null default 0 check (cost_price >= 0)
);

-- ===== Orders =====
create table public.orders (
  id text primary key,
  mpesa_code text not null unique,
  customer_name text not null,
  phone text not null check (phone ~ '^0[17][0-9]{8}$'),
  location text not null,
  notes text not null default '',
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'dispatched', 'delivered')),
  delivery_fee integer check (delivery_fee >= 0),
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  total integer not null check (total >= 0),
  created_at timestamptz not null default now()
);
create index orders_created_idx on public.orders (created_at desc);
create index orders_phone_created_idx on public.orders (phone, created_at desc);

-- ===== Messaging =====
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  name text not null,
  phone text not null,
  unread_admin integer not null default 0,
  unread_customer integer not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index conversations_phone_idx on public.conversations (phone, created_at desc);
create index conversations_updated_idx on public.conversations (updated_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender text not null check (sender in ('customer', 'admin')),
  kind text not null default 'chat' check (kind in ('chat', 'import')),
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index messages_conv_created_idx on public.messages (conversation_id, created_at);

-- ===== Table access for the Data API =====
-- Granted explicitly so this works even when "Grant API access to new tables automatically" is off.
-- Row Level Security below then decides which rows each role can actually touch.
revoke all on public.admins from anon, authenticated;
grant select on public.sections, public.products to anon, authenticated;
grant insert, update, delete on public.sections, public.products to authenticated;
grant select, insert, update, delete on public.product_costs, public.orders, public.conversations, public.messages to authenticated;

-- ===== Row Level Security =====
alter table public.sections enable row level security;
alter table public.products enable row level security;
alter table public.product_costs enable row level security;
alter table public.orders enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

create policy "Public can read sections" on public.sections for select to anon, authenticated using (true);
create policy "Admin inserts sections" on public.sections for insert to authenticated with check ((select public.is_admin()));
create policy "Admin updates sections" on public.sections for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admin deletes sections" on public.sections for delete to authenticated using ((select public.is_admin()));

create policy "Public can read products" on public.products for select to anon, authenticated using (true);
create policy "Admin inserts products" on public.products for insert to authenticated with check ((select public.is_admin()));
create policy "Admin updates products" on public.products for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admin deletes products" on public.products for delete to authenticated using ((select public.is_admin()));

create policy "Admin manages costs" on public.product_costs for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admin manages orders" on public.orders for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admin manages conversations" on public.conversations for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admin manages messages" on public.messages for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- ===== Realtime (live updates for storefront + admin) =====
alter publication supabase_realtime add table public.sections, public.products, public.product_costs, public.orders, public.conversations, public.messages;
