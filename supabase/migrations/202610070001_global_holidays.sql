begin;

-- A private allowlist, derived only from the existing owner's verified Auth
-- account. No student profile or client-supplied role can authorize a holiday.
create table public.calendar_administrators (
  user_id uuid primary key references auth.users(id)
);
alter table public.calendar_administrators enable row level security;
revoke all on public.calendar_administrators from public, anon, authenticated;
grant all on public.calendar_administrators to service_role;
insert into public.calendar_administrators(user_id)
select id from auth.users where lower(email) = 'jvictordesc99@gmail.com'
  and email_confirmed_at is not null on conflict do nothing;

create function public.protect_global_holidays() returns trigger
language plpgsql security definer set search_path = '' as $$
declare prior jsonb := '[]'; upcoming jsonb := '[]'; doc jsonb; item jsonb;
begin
  if tg_op <> 'INSERT' then
    select coalesce(jsonb_agg(x order by x->>'id'),'[]') into prior
      from jsonb_array_elements(coalesce(old.data->'agendaEvents','[]')) x
      where x->>'type'='global-holiday';
  end if;
  if tg_op <> 'DELETE' then
    doc := new.data;
    select coalesce(jsonb_agg(x order by x->>'id'),'[]') into upcoming
      from jsonb_array_elements(coalesce(doc->'agendaEvents','[]')) x
      where x->>'type'='global-holiday';
  end if;
  if prior is distinct from upcoming then
    if not exists(select 1 from public.calendar_administrators where user_id=auth.uid()) then
      raise exception 'Somente o administrador pode marcar ou remover feriados' using errcode='42501';
    end if;
    if exists(select 1 from jsonb_array_elements(upcoming) x
      where x->>'dateKey' !~ '^\d{4}-\d{2}-\d{2}$'
      or x->>'dateKey' is null or jsonb_typeof(x->'holidayActive') is distinct from 'boolean') then
      raise exception 'Feriado invalido';
    end if;
    -- Cast also rejects impossible dates; never convert through UTC timestamps.
    perform (x->>'dateKey')::date from jsonb_array_elements(upcoming) x;
    if exists(select 1 from jsonb_array_elements(upcoming) x group by x->>'dateKey' having count(*)>1) then
      raise exception 'Feriado duplicado';
    end if;
  end if;
  if tg_op = 'UPDATE' then
    for item in select x from jsonb_array_elements(coalesce(doc->'agendaEvents','[]')) x
      where x->>'type' <> 'global-holiday'
      and exists(select 1 from jsonb_array_elements(upcoming) h where h->>'holidayActive'='true' and h->>'dateKey'=x->>'dateKey')
      and not exists(select 1 from jsonb_array_elements(coalesce(old.data->'agendaEvents','[]')) p where p->>'id'=x->>'id')
    loop
      -- Materializing an existing recurring lesson for Google is permitted;
      -- explicit new bookings on the holiday are not.
      if coalesce(item->>'source','manual') in ('manual','manual-cancel') then
        raise exception 'Feriado: novos agendamentos bloqueados';
      end if;
    end loop;
    if exists(select 1 from jsonb_array_elements(coalesce(doc->'checkins','[]')) x
      where exists(select 1 from jsonb_array_elements(upcoming) h where h->>'holidayActive'='true' and h->>'dateKey'=x->>'dateKey')
      and not exists(select 1 from jsonb_array_elements(coalesce(old.data->'checkins','[]')) p where p->>'id'=x->>'id')) then
      raise exception 'Feriado: sem presenca, falta ou cancelamento';
    end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.protect_global_holidays() from public, anon, authenticated;
-- Run after the existing official cancellation projection.
create trigger zz_protect_global_holidays before insert or update or delete on public.app_state
for each row execute function public.protect_global_holidays();

-- Reject cancellation at the authoritative table as well as in the UI.
create function public.block_holiday_cancellation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists(select 1 from public.app_state a,
    lateral jsonb_array_elements(coalesce(a.data->'agendaEvents','[]')) h
    where a.id='main' and h->>'type'='global-holiday'
      and h->>'holidayActive'='true' and h->>'dateKey'=new.date_key::text) then
    raise exception 'Feriado: nao ha aula para cancelar ou gerar reposicao';
  end if;
  return new;
end;
$$;
revoke all on function public.block_holiday_cancellation() from public,anon,authenticated;
create trigger block_holiday_cancellation before insert on public.lesson_cancellations
for each row execute function public.block_holiday_cancellation();

commit;
