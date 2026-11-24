-- Favo Enterprise — complete database setup (schema + functions + starter catalog).
-- Paste this whole file into Supabase SQL Editor and click Run once.


-- ================= supabase/migrations/0001_schema.sql =================
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


-- ================= supabase/migrations/0002_functions.sql =================
-- Favo Enterprise — server functions.
-- Customers can only write through the five public functions below; everything else is admin-only.

-- Normalises a Kenyan mobile number to 07XXXXXXXX / 01XXXXXXXX, or null if invalid.
create or replace function public.normalize_ke_phone(p text)
returns text language plpgsql immutable set search_path = ''
as $$
declare d text := regexp_replace(coalesce(p, ''), '\D', '', 'g');
begin
  if d ~ '^0[17][0-9]{8}$' then return d; end if;
  if d ~ '^254[17][0-9]{8}$' then return '0' || substr(d, 4); end if;
  if d ~ '^[17][0-9]{8}$' then return '0' || d; end if;
  return null;
end; $$;

-- Customer-safe view of an order. p_full = true only for the buyer right after checkout.
create or replace function public.customer_order_json(o public.orders, p_full boolean)
returns jsonb language sql stable set search_path = ''
as $$
  select jsonb_build_object(
    'id', o.id,
    'mpesaCode', o.mpesa_code,
    'customerName', case when p_full then o.customer_name else split_part(o.customer_name, ' ', 1) end,
    'phone', case when p_full then o.phone else overlay(o.phone placing '****' from 4 for 4) end,
    'location', o.location,
    'status', o.status,
    'deliveryFee', o.delivery_fee,
    'total', o.total,
    'createdAt', (extract(epoch from o.created_at) * 1000)::bigint,
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'productId', e->>'productId', 'title', e->>'title',
        'price', (e->>'price')::int, 'qty', (e->>'qty')::int, 'image', e->>'image')), '[]'::jsonb)
      from jsonb_array_elements(o.items) e)
  );
$$;

-- Atomic checkout: validates input, re-prices from the DB, checks and deducts stock, records the order.
create or replace function public.place_order(p_name text, p_phone text, p_location text, p_notes text, p_items jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_phone text := public.normalize_ke_phone(p_phone);
  v_item jsonb;
  v_prod record;
  v_qty int;
  v_items jsonb := '[]'::jsonb;
  v_total int := 0;
  v_id text;
  v_code text;
  v_chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  v_order public.orders;
begin
  if length(trim(coalesce(p_name, ''))) not between 2 and 100 then raise exception 'Please enter your full name.'; end if;
  if v_phone is null then raise exception 'Enter a valid phone number (07XX… or 01XX…).'; end if;
  if length(trim(coalesce(p_location, ''))) not between 2 and 120 then raise exception 'Tell us where to deliver.'; end if;
  if length(coalesce(p_notes, '')) > 500 then raise exception 'Directions are too long (max 500 characters).'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 30 then
    raise exception 'Your cart is empty.';
  end if;
  if (select count(*) from public.orders where phone = v_phone and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Too many orders from this number in the last hour. Please contact us on WhatsApp.';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    if coalesce(v_item->>'qty', '') !~ '^[0-9]{1,3}$' then raise exception 'Invalid quantity in cart.'; end if;
    v_qty := (v_item->>'qty')::int;
    if v_qty < 1 or v_qty > 50 then raise exception 'Invalid quantity in cart.'; end if;

    select p.id, p.title, p.price, p.stock, p.section_id, p.image, coalesce(c.cost_price, 0) as cost_price
      into v_prod
      from public.products p left join public.product_costs c on c.product_id = p.id
      where p.id = v_item->>'productId'
      for update of p;
    if not found then raise exception 'A product in your cart is no longer available. Please refresh your cart.'; end if;
    if v_prod.stock < v_qty then
      raise exception 'Only % unit(s) of % left. Please update your cart.', v_prod.stock, v_prod.title;
    end if;

    update public.products set stock = stock - v_qty where id = v_prod.id;
    v_items := v_items || jsonb_build_object(
      'productId', v_prod.id, 'title', v_prod.title, 'price', v_prod.price, 'costPrice', v_prod.cost_price,
      'qty', v_qty, 'sectionId', v_prod.section_id, 'image', v_prod.image);
    v_total := v_total + v_prod.price * v_qty;
  end loop;

  loop
    v_id := 'FAVO-' || (10000 + floor(random() * 90000))::int;
    exit when not exists (select 1 from public.orders where id = v_id);
  end loop;
  loop
    v_code := 'S' || substr('ABCDEFGHIJKL', extract(month from now())::int, 1);
    for i in 1..8 loop
      v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    end loop;
    exit when not exists (select 1 from public.orders where mpesa_code = v_code);
  end loop;

  insert into public.orders (id, mpesa_code, customer_name, phone, location, notes, items, total)
  values (v_id, v_code, trim(p_name), v_phone, trim(p_location), trim(coalesce(p_notes, '')), v_items, v_total)
  returning * into v_order;

  return public.customer_order_json(v_order, true);
end; $$;

-- Order lookup by order number or M-Pesa code (both printed on the receipt).
create or replace function public.track_orders(p_refs text[])
returns jsonb language sql stable security definer set search_path = ''
as $$
  with refs as (
    select distinct upper(trim(r)) as r from unnest(coalesce(p_refs, '{}'::text[])) r limit 25
  )
  select coalesce(jsonb_agg(public.customer_order_json(o, false) order by o.created_at desc), '[]'::jsonb)
  from public.orders o
  where o.id in (select r from refs) or o.mpesa_code in (select r from refs);
$$;

-- Customer chat. The token is the customer's private key to their own conversation.
create or replace function public.send_customer_message(p_token uuid, p_name text, p_phone text, p_body text, p_kind text default 'chat')
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_phone text := public.normalize_ke_phone(p_phone);
  v_conv public.conversations;
begin
  if length(trim(coalesce(p_name, ''))) not between 2 and 80 then raise exception 'Please enter your name.'; end if;
  if v_phone is null then raise exception 'Enter a valid phone number (07XX… or 01XX…).'; end if;
  if length(trim(coalesce(p_body, ''))) not between 1 and 4000 then raise exception 'Message must be 1–4000 characters.'; end if;
  if coalesce(p_kind, 'chat') not in ('chat', 'import') then raise exception 'Invalid message type.'; end if;

  if p_token is not null then
    select * into v_conv from public.conversations where token = p_token for update;
  end if;

  if v_conv.id is null then
    if (select count(*) from public.conversations where phone = v_phone and created_at > now() - interval '1 hour') >= 5 then
      raise exception 'Too many new chats from this number. Please contact us on WhatsApp.';
    end if;
    insert into public.conversations (name, phone) values (trim(p_name), v_phone) returning * into v_conv;
  elsif (select count(*) from public.messages where conversation_id = v_conv.id and sender = 'customer'
         and created_at > now() - interval '5 minutes') >= 20 then
    raise exception 'You are sending messages too quickly. Please wait a moment.';
  end if;

  insert into public.messages (conversation_id, sender, kind, body)
  values (v_conv.id, 'customer', coalesce(p_kind, 'chat'), trim(p_body));

  update public.conversations
     set name = trim(p_name), phone = v_phone, unread_admin = unread_admin + 1, updated_at = now()
   where id = v_conv.id;

  return v_conv.token;
end; $$;

create or replace function public.get_customer_conversation(p_token uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'id', c.id, 'name', c.name, 'phone', c.phone, 'unreadCustomer', c.unread_customer,
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'from', m.sender, 'kind', m.kind, 'text', m.body,
        'ts', (extract(epoch from m.created_at) * 1000)::bigint) order by m.created_at)
      from public.messages m where m.conversation_id = c.id), '[]'::jsonb))
  from public.conversations c where c.token = p_token;
$$;

create or replace function public.mark_customer_read(p_token uuid)
returns void language sql security definer set search_path = ''
as $$ update public.conversations set unread_customer = 0 where token = p_token and unread_customer <> 0; $$;

-- ===== Admin-only helpers =====
create or replace function public.admin_reply(p_conv uuid, p_body text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;
  if length(trim(coalesce(p_body, ''))) not between 1 and 4000 then raise exception 'Message must be 1–4000 characters.'; end if;
  insert into public.messages (conversation_id, sender, body) values (p_conv, 'admin', trim(p_body));
  update public.conversations
     set unread_customer = unread_customer + 1, unread_admin = 0, updated_at = now()
   where id = p_conv;
end; $$;

create or replace function public.admin_adjust_stock(p_id text, p_delta int)
returns integer language plpgsql security definer set search_path = ''
as $$
declare v_stock int;
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;
  update public.products set stock = greatest(0, stock + p_delta) where id = p_id returning stock into v_stock;
  return v_stock;
end; $$;

create or replace function public.admin_save_product(p jsonb)
returns text language plpgsql security definer set search_path = ''
as $$
declare v_id text := nullif(p->>'id', '');
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;
  if v_id is null then
    insert into public.products (title, brand, section_id, price, stock, condition, image, specs, description, warranty)
    values (trim(p->>'title'), trim(coalesce(p->>'brand', '')), p->>'sectionId', (p->>'price')::int, (p->>'stock')::int,
            p->>'condition', coalesce(p->>'image', ''), coalesce(p->>'specs', ''), coalesce(p->>'description', ''), coalesce(p->>'warranty', ''))
    returning id into v_id;
  else
    update public.products set
      title = trim(p->>'title'), brand = trim(coalesce(p->>'brand', '')), section_id = p->>'sectionId',
      price = (p->>'price')::int, stock = (p->>'stock')::int, condition = p->>'condition',
      image = coalesce(p->>'image', ''), specs = coalesce(p->>'specs', ''),
      description = coalesce(p->>'description', ''), warranty = coalesce(p->>'warranty', '')
    where id = v_id;
    if not found then raise exception 'Product no longer exists.'; end if;
  end if;
  insert into public.product_costs (product_id, cost_price) values (v_id, coalesce((p->>'costPrice')::int, 0))
  on conflict (product_id) do update set cost_price = excluded.cost_price;
  return v_id;
end; $$;

create or replace function public.admin_add_section(p_name text)
returns text language plpgsql security definer set search_path = ''
as $$
declare v_id text;
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;
  if length(trim(coalesce(p_name, ''))) not between 1 and 60 then raise exception 'Section name is required.'; end if;
  if exists (select 1 from public.sections where lower(name) = lower(trim(p_name))) then
    raise exception 'A section with that name already exists.';
  end if;
  insert into public.sections (name, position)
  values (trim(p_name), coalesce((select max(position) + 1 from public.sections), 0))
  returning id into v_id;
  return v_id;
end; $$;

create or replace function public.admin_move_section(p_id text, p_dir int)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_ids text[]; v_i int; v_j int; v_tmp text;
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;
  perform 1 from public.sections for update;
  select array_agg(id order by position, id) into v_ids from public.sections;
  v_i := array_position(v_ids, p_id);
  if v_i is null then return; end if;
  v_j := v_i + sign(p_dir)::int;
  if v_j < 1 or v_j > array_length(v_ids, 1) then return; end if;
  v_tmp := v_ids[v_i]; v_ids[v_i] := v_ids[v_j]; v_ids[v_j] := v_tmp;
  update public.sections s set position = t.ord - 1
    from unnest(v_ids) with ordinality as t(id, ord)
   where s.id = t.id and s.position <> t.ord - 1;
end; $$;

create or replace function public.admin_delete_section(p_id text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_fallback text;
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;
  select id into v_fallback from public.sections where id <> p_id order by position, id limit 1;
  if v_fallback is null then raise exception 'The store needs at least one section.'; end if;
  update public.products set section_id = v_fallback where section_id = p_id;
  delete from public.sections where id = p_id;
end; $$;

-- ===== Execute grants: only the functions each role needs =====
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.normalize_ke_phone(text) from public, anon, authenticated;
revoke execute on function public.customer_order_json(public.orders, boolean) from public, anon, authenticated;
revoke execute on function public.admin_reply(uuid, text) from public, anon;
revoke execute on function public.admin_adjust_stock(text, int) from public, anon;
revoke execute on function public.admin_save_product(jsonb) from public, anon;
revoke execute on function public.admin_add_section(text) from public, anon;
revoke execute on function public.admin_move_section(text, int) from public, anon;
revoke execute on function public.admin_delete_section(text) from public, anon;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.place_order(text, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.track_orders(text[]) to anon, authenticated;
grant execute on function public.send_customer_message(uuid, text, text, text, text) to anon, authenticated;
grant execute on function public.get_customer_conversation(uuid) to anon, authenticated;
grant execute on function public.mark_customer_read(uuid) to anon, authenticated;
grant execute on function public.admin_reply(uuid, text) to authenticated;
grant execute on function public.admin_adjust_stock(text, int) to authenticated;
grant execute on function public.admin_save_product(jsonb) to authenticated;
grant execute on function public.admin_add_section(text) to authenticated;
grant execute on function public.admin_move_section(text, int) to authenticated;
grant execute on function public.admin_delete_section(text) to authenticated;


-- ================= supabase/migrations/0003_seed.sql =================
-- Favo Enterprise — starter catalog (4 sections, 8 products). Safe to skip if you'd rather start empty.

insert into public.sections (id, name, position) values
  ('sec-phones', 'Smartphones & Tablets', 0),
  ('sec-laptops', 'Laptops & Computing', 1),
  ('sec-audio', 'Audio & Wearables', 2),
  ('sec-gaming', 'Gaming & Accessories', 3)
on conflict (id) do nothing;

insert into public.products (id, title, brand, section_id, price, stock, condition, image, specs, description, warranty, created_at) values
  ('p-iphone15pro', 'iPhone 15 Pro 256GB', 'Apple', 'sec-phones', 142000, 6, 'Brand New',
   'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=800&q=75',
   '6.1" Super Retina XDR ProMotion
A17 Pro chip, 8GB RAM
48MP main + 5x telephoto
Titanium frame, USB-C
eSIM + physical SIM',
   'Titanium flagship with the A17 Pro chip and the most capable iPhone camera system yet.', '1-year Apple international warranty', now() - interval '0 hours'),
  ('p-s24ultra', 'Samsung Galaxy S24 Ultra 512GB', 'Samsung', 'sec-phones', 158500, 3, 'Brand New',
   'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?auto=format&fit=crop&w=800&q=75',
   '6.8" QHD+ Dynamic AMOLED 120Hz
Snapdragon 8 Gen 3, 12GB RAM
200MP quad camera, 100x Space Zoom
Built-in S Pen
5000mAh, 45W charging',
   'Galaxy AI powerhouse with a titanium build, S Pen and a 200MP camera.', '1-year Samsung Kenya warranty', now() - interval '1 hours'),
  ('p-macbookairm2', 'MacBook Air M2 13" 8GB/256GB', 'Apple', 'sec-laptops', 118000, 4, 'Brand New',
   'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=75',
   '13.6" Liquid Retina display
Apple M2 8-core CPU, 8-core GPU
8GB unified memory, 256GB SSD
Up to 18hrs battery
MagSafe charging',
   'Fanless, featherlight and blazing fast — the everyday laptop for students and creators.', '1-year Apple warranty', now() - interval '2 hours'),
  ('p-sonyxm5', 'Sony WH-1000XM5 Headphones', 'Sony', 'sec-audio', 44500, 5, 'Brand New',
   'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=75',
   'Industry-leading noise cancelling
30hrs battery, 3-min quick charge = 3hrs
Multipoint Bluetooth 5.2
LDAC Hi-Res audio
Speak-to-chat',
   'Silence the matatu noise. World-class ANC with crystal clear calls.', '1-year Sony warranty', now() - interval '3 hours'),
  ('p-airpodspro2', 'AirPods Pro (2nd Gen) USB-C', 'Apple', 'sec-audio', 32500, 1, 'Brand New',
   'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?auto=format&fit=crop&w=800&q=75',
   'Active Noise Cancellation 2x stronger
Adaptive Audio & Transparency
H2 chip, Personalised Spatial Audio
MagSafe USB-C case with speaker
IP54 dust & water resistance',
   'Premium earbuds with adaptive audio and best-in-class Apple ecosystem integration.', '1-year Apple warranty', now() - interval '4 hours'),
  ('p-ipadair', 'iPad Air M2 11" 128GB Wi-Fi', 'Apple', 'sec-phones', 86500, 2, 'Pre-Order / Import',
   'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=800&q=75',
   '11" Liquid Retina display
Apple M2 chip
12MP landscape front camera
Apple Pencil Pro support
Touch ID, USB-C',
   'Imported on order — light, powerful and perfect for study, design and entertainment. 7–14 day lead time.', '1-year Apple warranty', now() - interval '5 hours'),
  ('p-ps5slim', 'PlayStation 5 Slim Disc Edition', 'Sony', 'sec-gaming', 78500, 0, 'Brand New',
   'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=800&q=75',
   '1TB SSD storage
4K gaming up to 120fps
Ray tracing, Tempest 3D Audio
DualSense wireless controller included
Ultra HD Blu-ray drive',
   'Next-gen gaming. Currently sold out — chat with us to reserve the next shipment.', '1-year Sony warranty', now() - interval '6 hours'),
  ('p-hpelitebook', 'HP EliteBook 840 G6 Core i7', 'HP', 'sec-laptops', 46500, 9, 'Ex-UK / Refurbished',
   'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=800&q=75',
   '14" Full HD IPS display
Intel Core i7 8th Gen
16GB DDR4 RAM, 512GB SSD
Backlit keyboard, fingerprint
Windows 11 Pro',
   'Business-grade Ex-UK laptop in excellent condition, tested and certified by our technicians.', '6-month Favo Enterprise warranty', now() - interval '7 hours')
on conflict (id) do nothing;

insert into public.product_costs (product_id, cost_price) values
  ('p-iphone15pro', 124000),
  ('p-s24ultra', 139000),
  ('p-ipadair', 74000),
  ('p-macbookairm2', 101000),
  ('p-hpelitebook', 36000),
  ('p-sonyxm5', 36500),
  ('p-airpodspro2', 26000),
  ('p-ps5slim', 67000)
on conflict (product_id) do nothing;



-- Favo Enterprise: multiple photos per product + photo uploads.
-- Safe to run more than once.

-- 1) Gallery column. `image` stays as the cover photo (= first in the gallery)
--    so orders, cart and older code keep working.
alter table public.products add column if not exists images text[] not null default '{}';
update public.products set images = array[image] where image <> '' and cardinality(images) = 0;
alter table public.products drop constraint if exists products_images_max;
alter table public.products add constraint products_images_max check (cardinality(images) <= 8);

-- 2) Save product now stores the gallery.
create or replace function public.admin_save_product(p jsonb)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  v_id text := nullif(p->>'id', '');
  v_images text[];
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;

  select coalesce(array_agg(u order by n), '{}') into v_images
  from (
    select trim(x) as u, n
    from jsonb_array_elements_text(
      case when jsonb_typeof(p->'images') = 'array' then p->'images'
           when coalesce(p->>'image', '') <> '' then jsonb_build_array(p->>'image')
           else '[]'::jsonb end
    ) with ordinality as t(x, n)
    where trim(x) <> '' and length(x) <= 2000
    order by n
    limit 8
  ) s;

  if v_id is null then
    insert into public.products (title, brand, section_id, price, stock, condition, image, images, specs, description, warranty)
    values (trim(p->>'title'), trim(coalesce(p->>'brand', '')), p->>'sectionId', (p->>'price')::int, (p->>'stock')::int,
            p->>'condition', coalesce(v_images[1], ''), v_images, coalesce(p->>'specs', ''), coalesce(p->>'description', ''), coalesce(p->>'warranty', ''))
    returning id into v_id;
  else
    update public.products set
      title = trim(p->>'title'), brand = trim(coalesce(p->>'brand', '')), section_id = p->>'sectionId',
      price = (p->>'price')::int, stock = (p->>'stock')::int, condition = p->>'condition',
      image = coalesce(v_images[1], ''), images = v_images, specs = coalesce(p->>'specs', ''),
      description = coalesce(p->>'description', ''), warranty = coalesce(p->>'warranty', '')
    where id = v_id;
    if not found then raise exception 'Product no longer exists.'; end if;
  end if;
  insert into public.product_costs (product_id, cost_price) values (v_id, coalesce((p->>'costPrice')::int, 0))
  on conflict (product_id) do update set cost_price = excluded.cost_price;
  return v_id;
end; $$;

revoke execute on function public.admin_save_product(jsonb) from public, anon;
grant execute on function public.admin_save_product(jsonb) to authenticated;

-- 3) Photo storage: anyone can view, only the admin can upload or delete.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "favo admin uploads product images" on storage.objects;
create policy "favo admin uploads product images" on storage.objects
  for insert to authenticated with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "favo admin deletes product images" on storage.objects;
create policy "favo admin deletes product images" on storage.objects
  for delete to authenticated using (bucket_id = 'product-images' and public.is_admin());
