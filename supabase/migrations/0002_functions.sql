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
