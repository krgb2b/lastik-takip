begin;

alter table if exists public.retread_brands enable row level security;
alter table if exists public.tread_patterns enable row level security;

do $$
begin
  if to_regclass('public.retread_brands') is not null then
    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'retread_brands'
        and policyname = 'retread_brands_select_policy'
    ) then
      create policy retread_brands_select_policy
        on public.retread_brands
        for select
        to anon, authenticated
        using (true);
    end if;

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'retread_brands'
        and policyname = 'retread_brands_insert_policy'
    ) then
      create policy retread_brands_insert_policy
        on public.retread_brands
        for insert
        to anon, authenticated
        with check (true);
    end if;

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'retread_brands'
        and policyname = 'retread_brands_update_policy'
    ) then
      create policy retread_brands_update_policy
        on public.retread_brands
        for update
        to anon, authenticated
        using (true)
        with check (true);
    end if;

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'retread_brands'
        and policyname = 'retread_brands_delete_policy'
    ) then
      create policy retread_brands_delete_policy
        on public.retread_brands
        for delete
        to anon, authenticated
        using (true);
    end if;
  end if;

  if to_regclass('public.tread_patterns') is not null then
    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'tread_patterns'
        and policyname = 'tread_patterns_select_policy'
    ) then
      create policy tread_patterns_select_policy
        on public.tread_patterns
        for select
        to anon, authenticated
        using (true);
    end if;

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'tread_patterns'
        and policyname = 'tread_patterns_insert_policy'
    ) then
      create policy tread_patterns_insert_policy
        on public.tread_patterns
        for insert
        to anon, authenticated
        with check (true);
    end if;

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'tread_patterns'
        and policyname = 'tread_patterns_update_policy'
    ) then
      create policy tread_patterns_update_policy
        on public.tread_patterns
        for update
        to anon, authenticated
        using (true)
        with check (true);
    end if;

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'tread_patterns'
        and policyname = 'tread_patterns_delete_policy'
    ) then
      create policy tread_patterns_delete_policy
        on public.tread_patterns
        for delete
        to anon, authenticated
        using (true);
    end if;
  end if;
end
$$;

commit;
