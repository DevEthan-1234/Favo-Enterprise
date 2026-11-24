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
