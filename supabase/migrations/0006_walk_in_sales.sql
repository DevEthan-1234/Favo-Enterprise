-- Favo Enterprise: record in-shop (walk-in) sales from the admin.
-- A walk-in sale is saved as a normal order (so it shows in Financials), marked channel = 'walk_in',
-- already paid and delivered, and takes the items out of stock.
-- Safe to run more than once. Needs 0005_send_money.sql first.

alter table public.orders add column if not exists channel text not null default 'online';
alter table public.orders drop constraint if exists orders_channel_check;
alter table public.orders add constraint orders_channel_check check (channel in ('online', 'walk_in'));

alter table public.orders add column if not exists payment_method text not null default 'mpesa';
alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check check (payment_method in ('mpesa', 'cash'));

-- Cash sales have no M-Pesa code, and walk-in buyers may not give a phone number.
alter table public.orders alter column mpesa_code drop not null;
alter table public.orders alter column phone drop not null;

create or replace function public.admin_record_sale(p jsonb)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  v_method text := coalesce(p->>'paymentMethod', 'cash');
  v_code text := nullif(upper(regexp_replace(coalesce(p->>'mpesaCode', ''), '\s', '', 'g')), '');
  v_phone text := nullif(trim(coalesce(p->>'phone', '')), '');
  v_name text := coalesce(nullif(trim(coalesce(p->>'customerName', '')), ''), 'Walk-in customer');
  v_item jsonb;
  v_prod record;
  v_qty int;
  v_price int;
  v_items jsonb := '[]'::jsonb;
  v_total int := 0;
  v_id text;
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;
  if v_method not in ('cash', 'mpesa') then raise exception 'Choose Cash or M-Pesa.'; end if;
  if length(v_name) > 100 then raise exception 'Customer name is too long.'; end if;

  if v_phone is not null then
    v_phone := public.normalize_ke_phone(v_phone);
    if v_phone is null then raise exception 'Phone number is not valid. Leave it empty if the buyer did not give one.'; end if;
  end if;

  if v_method = 'mpesa' then
    if v_code is null or v_code !~ '^[A-Z][A-Z0-9]{9}$' or v_code !~ '[0-9]' then
      raise exception 'Enter the 10-character M-Pesa code from your SMS, e.g. TKL7H2J9QX.';
    end if;
    if exists (select 1 from public.orders where mpesa_code = v_code) then
      raise exception 'This M-Pesa code is already recorded on order %.', (select id from public.orders where mpesa_code = v_code);
    end if;
  else
    v_code := null;
  end if;

  if jsonb_typeof(p->'items') <> 'array' or jsonb_array_length(p->'items') not between 1 and 50 then
    raise exception 'Add at least one product.';
  end if;

  for v_item in select * from jsonb_array_elements(p->'items') loop
    if coalesce(v_item->>'qty', '') !~ '^[0-9]{1,4}$' or (v_item->>'qty')::int < 1 then raise exception 'Invalid quantity.'; end if;
    v_qty := (v_item->>'qty')::int;

    select pr.id, pr.title, pr.price, pr.stock, pr.section_id, pr.image, coalesce(c.cost_price, 0) as cost_price
      into v_prod
      from public.products pr left join public.product_costs c on c.product_id = pr.id
      where pr.id = v_item->>'productId'
      for update of pr;
    if not found then raise exception 'A product in this sale no longer exists.'; end if;
    if v_prod.stock < v_qty then
      raise exception 'Only % unit(s) of % in stock.', v_prod.stock, v_prod.title;
    end if;

    -- Selling price can differ from the listed price (e.g. a discount in the shop).
    if coalesce(v_item->>'price', '') ~ '^[0-9]{1,9}$' then v_price := (v_item->>'price')::int; else v_price := v_prod.price; end if;

    update public.products set stock = stock - v_qty where id = v_prod.id;
    v_items := v_items || jsonb_build_object(
      'productId', v_prod.id, 'title', v_prod.title, 'price', v_price, 'costPrice', v_prod.cost_price,
      'qty', v_qty, 'sectionId', v_prod.section_id, 'image', v_prod.image);
    v_total := v_total + v_price * v_qty;
  end loop;

  loop
    v_id := 'FAVO-' || (10000 + floor(random() * 90000))::int;
    exit when not exists (select 1 from public.orders where id = v_id);
  end loop;

  insert into public.orders (id, mpesa_code, customer_name, phone, location, notes, items, total,
                             status, payment_status, payment_checked_at, delivery_fee, channel, payment_method, created_at)
  values (v_id, v_code, v_name, v_phone, 'In-shop', left(trim(coalesce(p->>'notes', '')), 500), v_items, v_total,
          'delivered', 'verified', now(), 0, 'walk_in', v_method,
          least(coalesce(nullif(p->>'soldAt', '')::timestamptz, now()), now()));
  return v_id;
end; $$;

revoke execute on function public.admin_record_sale(jsonb) from public, anon;
grant execute on function public.admin_record_sale(jsonb) to authenticated;
