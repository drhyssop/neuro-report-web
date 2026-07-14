alter table holidays enable row level security;

drop policy if exists "holidays_authenticated_all" on holidays;

create policy "holidays_authenticated_all" on holidays
  for all to authenticated
  using (true) with check (true);