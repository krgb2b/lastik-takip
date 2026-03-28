-- Migration: Finalize normalization by removing legacy text columns
-- IMPORTANT: Run this only after application reads/writes region_id and salesperson_id.

begin;

-- Safety checks (fail if unresolved rows still depend on legacy text)
do $$
declare
  unresolved_region_count bigint;
  unresolved_salesperson_count bigint;
begin
  select count(*)
  into unresolved_region_count
  from public.customers
  where region is not null
    and btrim(region) <> ''
    and region_id is null;

  select count(*)
  into unresolved_salesperson_count
  from public.customers
  where salesperson is not null
    and btrim(salesperson) <> ''
    and salesperson_id is null;

  if unresolved_region_count > 0 then
    raise exception 'Finalize blocked: % customers have region text but null region_id', unresolved_region_count;
  end if;

  if unresolved_salesperson_count > 0 then
    raise exception 'Finalize blocked: % customers have salesperson text but null salesperson_id', unresolved_salesperson_count;
  end if;
end
$$;

-- Optional hardening after app rollout
alter table public.customers
  alter column region_id set not null,
  alter column salesperson_id set not null;

-- Remove legacy text columns
alter table public.customers
  drop column if exists region,
  drop column if exists salesperson;

commit;
