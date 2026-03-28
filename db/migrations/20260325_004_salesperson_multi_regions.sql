begin;

create table if not exists public.salesperson_regions (
  salesperson_id bigint not null references public.salespeople(id) on update cascade on delete cascade,
  region_id bigint not null references public.regions(id) on update cascade on delete cascade,
  created_at timestamptz not null default now(),
  primary key (salesperson_id, region_id)
);

create index if not exists salesperson_regions_region_id_idx
  on public.salesperson_regions(region_id);

insert into public.salesperson_regions (salesperson_id, region_id)
select s.id, s.region_id
from public.salespeople s
where s.region_id is not null
on conflict (salesperson_id, region_id) do nothing;

alter table if exists public.salesperson_regions enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'salesperson_regions'
      and policyname = 'salesperson_regions_select_policy'
  ) then
    create policy salesperson_regions_select_policy
      on public.salesperson_regions
      for select
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'salesperson_regions'
      and policyname = 'salesperson_regions_insert_policy'
  ) then
    create policy salesperson_regions_insert_policy
      on public.salesperson_regions
      for insert
      to anon, authenticated
      with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'salesperson_regions'
      and policyname = 'salesperson_regions_update_policy'
  ) then
    create policy salesperson_regions_update_policy
      on public.salesperson_regions
      for update
      to anon, authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'salesperson_regions'
      and policyname = 'salesperson_regions_delete_policy'
  ) then
    create policy salesperson_regions_delete_policy
      on public.salesperson_regions
      for delete
      to anon, authenticated
      using (true);
  end if;
end
$$;

commit;