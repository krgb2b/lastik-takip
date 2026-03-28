begin;

alter table if exists public.collection_receipts enable row level security;
alter table if exists public.collection_receipt_items enable row level security;
alter table if exists public.tyres enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'collection_receipts'
      and policyname = 'collection_receipts_select_policy'
  ) then
    create policy collection_receipts_select_policy
      on public.collection_receipts
      for select
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'collection_receipts'
      and policyname = 'collection_receipts_insert_policy'
  ) then
    create policy collection_receipts_insert_policy
      on public.collection_receipts
      for insert
      to anon, authenticated
      with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'collection_receipts'
      and policyname = 'collection_receipts_update_policy'
  ) then
    create policy collection_receipts_update_policy
      on public.collection_receipts
      for update
      to anon, authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'collection_receipts'
      and policyname = 'collection_receipts_delete_policy'
  ) then
    create policy collection_receipts_delete_policy
      on public.collection_receipts
      for delete
      to anon, authenticated
      using (true);
  end if;

  if to_regclass('public.collection_receipt_items') is not null then
    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'collection_receipt_items'
        and policyname = 'collection_receipt_items_select_policy'
    ) then
      create policy collection_receipt_items_select_policy
        on public.collection_receipt_items
        for select
        to anon, authenticated
        using (true);
    end if;

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'collection_receipt_items'
        and policyname = 'collection_receipt_items_insert_policy'
    ) then
      create policy collection_receipt_items_insert_policy
        on public.collection_receipt_items
        for insert
        to anon, authenticated
        with check (true);
    end if;

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'collection_receipt_items'
        and policyname = 'collection_receipt_items_update_policy'
    ) then
      create policy collection_receipt_items_update_policy
        on public.collection_receipt_items
        for update
        to anon, authenticated
        using (true)
        with check (true);
    end if;

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'collection_receipt_items'
        and policyname = 'collection_receipt_items_delete_policy'
    ) then
      create policy collection_receipt_items_delete_policy
        on public.collection_receipt_items
        for delete
        to anon, authenticated
        using (true);
    end if;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tyres'
      and policyname = 'tyres_select_policy'
  ) then
    create policy tyres_select_policy
      on public.tyres
      for select
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tyres'
      and policyname = 'tyres_insert_policy'
  ) then
    create policy tyres_insert_policy
      on public.tyres
      for insert
      to anon, authenticated
      with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tyres'
      and policyname = 'tyres_update_policy'
  ) then
    create policy tyres_update_policy
      on public.tyres
      for update
      to anon, authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tyres'
      and policyname = 'tyres_delete_policy'
  ) then
    create policy tyres_delete_policy
      on public.tyres
      for delete
      to anon, authenticated
      using (true);
  end if;
end
$$;

commit;