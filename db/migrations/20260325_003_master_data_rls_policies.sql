begin;

alter table if exists public.regions enable row level security;
alter table if exists public.salespeople enable row level security;
alter table if exists public.customer_addresses enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'regions'
      and policyname = 'regions_select_policy'
  ) then
    create policy regions_select_policy
      on public.regions
      for select
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'regions'
      and policyname = 'regions_insert_policy'
  ) then
    create policy regions_insert_policy
      on public.regions
      for insert
      to anon, authenticated
      with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'regions'
      and policyname = 'regions_update_policy'
  ) then
    create policy regions_update_policy
      on public.regions
      for update
      to anon, authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'regions'
      and policyname = 'regions_delete_policy'
  ) then
    create policy regions_delete_policy
      on public.regions
      for delete
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'salespeople'
      and policyname = 'salespeople_select_policy'
  ) then
    create policy salespeople_select_policy
      on public.salespeople
      for select
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'salespeople'
      and policyname = 'salespeople_insert_policy'
  ) then
    create policy salespeople_insert_policy
      on public.salespeople
      for insert
      to anon, authenticated
      with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'salespeople'
      and policyname = 'salespeople_update_policy'
  ) then
    create policy salespeople_update_policy
      on public.salespeople
      for update
      to anon, authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'salespeople'
      and policyname = 'salespeople_delete_policy'
  ) then
    create policy salespeople_delete_policy
      on public.salespeople
      for delete
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'customer_addresses'
      and policyname = 'customer_addresses_select_policy'
  ) then
    create policy customer_addresses_select_policy
      on public.customer_addresses
      for select
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'customer_addresses'
      and policyname = 'customer_addresses_insert_policy'
  ) then
    create policy customer_addresses_insert_policy
      on public.customer_addresses
      for insert
      to anon, authenticated
      with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'customer_addresses'
      and policyname = 'customer_addresses_update_policy'
  ) then
    create policy customer_addresses_update_policy
      on public.customer_addresses
      for update
      to anon, authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'customer_addresses'
      and policyname = 'customer_addresses_delete_policy'
  ) then
    create policy customer_addresses_delete_policy
      on public.customer_addresses
      for delete
      to anon, authenticated
      using (true);
  end if;
end
$$;

commit;