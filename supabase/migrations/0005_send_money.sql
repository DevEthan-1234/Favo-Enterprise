-- Favo Enterprise: M-Pesa "Send Money" checkout.
-- Customers send money to the shop's M-Pesa number and submit the confirmation code.
-- Each order waits as 'unverified' until the admin matches the code to their own M-Pesa SMS.
-- Safe to run more than once.

-- 1) Payment state on orders. Existing orders count as verified; new ones start unverified.
alter table public.orders add column if not exists payment_status text not null default 'verified';
alter table public.orders alter column payment_status set default 'unverified';
alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders add constraint orders_payment_status_check
  check (payment_status in ('unverified', 'verified', 'rejected'));
alter table public.orders add column if not exists payment_checked_at timestamptz;

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pending', 'confirmed', 'dispatched', 'delivered', 'cancelled'));

-- 2) Customer-facing order JSON now includes the payment state.
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
    'paymentStatus', o.payment_status,
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

-- 3) Checkout now takes the customer's real M-Pesa confirmation code.
drop function if exists public.place_order(text, text, text, text, jsonb);

create or replace function public.place_order(p_name text, p_phone text, p_location text, p_notes text, p_items jsonb, p_mpesa_code text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_phone text := public.normalize_ke_phone(p_phone);
  v_code text := upper(regexp_replace(coalesce(p_mpesa_code, ''), '\s', '', 'g'));
  v_item jsonb;
  v_prod record;
  v_qty int;
  v_items jsonb := '[]'::jsonb;
  v_total int := 0;
  v_id text;
  v_order public.orders;
begin
  if length(trim(coalesce(p_name, ''))) not between 2 and 100 then raise exception 'Please enter your full name.'; end if;
  if v_phone is null then raise exception 'Enter a valid phone number (07XX… or 01XX…).'; end if;
  if length(trim(coalesce(p_location, ''))) not between 2 and 120 then raise exception 'Tell us where to deliver.'; end if;
  if length(coalesce(p_notes, '')) > 500 then raise exception 'Directions are too long (max 500 characters).'; end if;
  if v_code !~ '^[A-Z][A-Z0-9]{9}$' or v_code !~ '[0-9]' then
    raise exception 'That M-Pesa code doesn''t look right. It is 10 letters and numbers at the start of your M-Pesa SMS, e.g. TKL7H2J9QX.';
  end if;
  if exists (select 1 from public.orders where mpesa_code = v_code) then
    raise exception 'This M-Pesa code has already been used for another order. Contact us on WhatsApp if this is a mistake.';
  end if;
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

  insert into public.orders (id, mpesa_code, customer_name, phone, location, notes, items, total, payment_status)
  values (v_id, v_code, trim(p_name), v_phone, trim(p_location), trim(coalesce(p_notes, '')), v_items, v_total, 'unverified')
  returning * into v_order;

  return public.customer_order_json(v_order, true);
exception
  when unique_violation then
    raise exception 'This M-Pesa code has already been used for another order. Contact us on WhatsApp if this is a mistake.';
end; $$;

-- 4) Admin confirms or rejects a payment. Rejecting cancels the order and returns the stock.
create or replace function public.admin_review_payment(p_id text, p_received boolean)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders;
  v_item jsonb;
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;
  select * into v_order from public.orders where id = p_id for update;
  if not found then raise exception 'Order not found.'; end if;

  if p_received then
    if v_order.payment_status = 'rejected' then raise exception 'This order was already cancelled. Ask the customer to order again.'; end if;
    update public.orders set payment_status = 'verified', payment_checked_at = now() where id = p_id;
    return 'verified';
  end if;

  if v_order.payment_status = 'rejected' then return 'rejected'; end if;
  for v_item in select * from jsonb_array_elements(v_order.items) loop
    update public.products set stock = stock + (v_item->>'qty')::int where id = v_item->>'productId';
  end loop;
  update public.orders set payment_status = 'rejected', status = 'cancelled', payment_checked_at = now() where id = p_id;
  return 'rejected';
end; $$;

revoke execute on function public.customer_order_json(public.orders, boolean) from public, anon, authenticated;
revoke execute on function public.place_order(text, text, text, text, jsonb, text) from public;
grant execute on function public.place_order(text, text, text, text, jsonb, text) to anon, authenticated;
revoke execute on function public.admin_review_payment(text, boolean) from public, anon;
grant execute on function public.admin_review_payment(text, boolean) to authenticated;
