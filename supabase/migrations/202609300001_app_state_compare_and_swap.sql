begin;

-- Atomic compare-and-swap for both the browser and Calendar Edge Functions.
-- Compare the JSON too: existing writers may reuse or omit updated_at.
-- SECURITY INVOKER preserves the caller's table grants and existing RLS.
create or replace function public.compare_and_swap_app_state(
  expected_data jsonb,
  expected_updated_at timestamptz,
  next_data jsonb,
  expected_exists boolean default true
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  affected integer;
begin
  if next_data is null or jsonb_typeof(next_data) <> 'object' then
    raise exception 'app_state data must be a JSON object';
  end if;

  if expected_exists then
    update public.app_state
       set data = next_data, updated_at = clock_timestamp()
     where id = 'main'
       and data::jsonb is not distinct from expected_data
       and updated_at is not distinct from expected_updated_at;
  elsif expected_exists = false then
    -- Initial creation must never overwrite a row created concurrently.
    insert into public.app_state (id, data, updated_at)
      values ('main', next_data, clock_timestamp())
      on conflict (id) do nothing;
  else
    raise exception 'expected_exists must not be null';
  end if;

  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;

revoke all on function public.compare_and_swap_app_state(jsonb, timestamptz, jsonb, boolean) from public;
grant execute on function public.compare_and_swap_app_state(jsonb, timestamptz, jsonb, boolean)
  to anon, authenticated, service_role;
-- EXECUTE alone grants no table access; anon still needs existing table/RLS rights.

commit;
