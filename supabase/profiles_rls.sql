-- Execute no SQL Editor do projeto Supabase.
-- Esta migration mantem o RLS ativo e nao concede acesso a anon/public.

alter table public.profiles enable row level security;

grant select, insert, update on table public.profiles to authenticated;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (
  auth.uid() = id
  and auth.uid() = auth_user_id
);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (
  auth.uid() = id
  and auth.uid() = auth_user_id
);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (
  auth.uid() = id
  and auth.uid() = auth_user_id
)
with check (
  auth.uid() = id
  and auth.uid() = auth_user_id
);

-- O upsert usa on conflict (id), portanto id precisa ser PK ou UNIQUE.
-- Consulte antes de alterar o schema:
-- select indexdef from pg_indexes
-- where schemaname = 'public' and tablename = 'profiles';
