-- Favo Enterprise: business expenses (transport, stock bought, rent, packaging, ...).
-- Financials shows Profit = sales revenue − expenses for the chosen month.
-- Only the admin can read or change expenses. Safe to run more than once.

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  spent_on date not null default current_date,
  category text not null check (category in ('stock', 'transport', 'rent', 'packaging', 'marketing', 'salaries', 'utilities', 'other')),
  amount integer not null check (amount > 0 and amount <= 100000000),
  note text not null default '' check (length(note) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists expenses_spent_on_idx on public.expenses (spent_on desc);

alter table public.expenses enable row level security;
drop policy if exists "Admin manages expenses" on public.expenses;
create policy "Admin manages expenses" on public.expenses
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

revoke all on public.expenses from anon, authenticated;
grant select, insert, update, delete on public.expenses to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'expenses') then
    alter publication supabase_realtime add table public.expenses;
  end if;
end $$;
