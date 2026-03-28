begin;

alter table if exists public.tyres
  add column if not exists cycle_no integer;

with ranked as (
  select
    id,
    row_number() over (
      partition by serial_no
      order by created_at asc nulls first, id asc
    ) as next_cycle_no
  from public.tyres
  where coalesce(trim(serial_no), '') <> ''
)
update public.tyres as t
set cycle_no = r.next_cycle_no
from ranked as r
where t.id = r.id
  and (t.cycle_no is null or t.cycle_no < 1);

update public.tyres
set cycle_no = 1
where cycle_no is null or cycle_no < 1;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tyres'
      and column_name = 'cycle_no'
      and is_nullable = 'YES'
  ) then
    alter table public.tyres
      alter column cycle_no set default 1,
      alter column cycle_no set not null;
  else
    alter table public.tyres
      alter column cycle_no set default 1;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tyres_serial_no_cycle_no_key'
      and conrelid = 'public.tyres'::regclass
  ) then
    alter table public.tyres
      add constraint tyres_serial_no_cycle_no_key unique (serial_no, cycle_no);
  end if;
end
$$;

create index if not exists tyres_serial_no_cycle_no_idx
  on public.tyres (serial_no, cycle_no);

commit;
