-- Favo Enterprise: link an expense (e.g. delivery transport) to the order it was for.
-- Optional: expenses without an order (rent, airtime, ...) keep order_id empty.
-- If the order is deleted, the expense stays and is simply unlinked.
-- Safe to run more than once. Needs 0007_expenses.sql first.

alter table public.expenses add column if not exists order_id text references public.orders(id) on delete set null;
create index if not exists expenses_order_idx on public.expenses (order_id);
