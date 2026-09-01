begin;

create extension if not exists pgcrypto;

create table if not exists public.google_calendar_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  google_account_id text not null,
  google_email text not null,
  calendar_id text not null default 'primary',
  encrypted_refresh_token text not null,
  access_token_expires_at timestamptz,
  scope text not null,
  sync_token text,
  connection_status text not null default 'connected' check (connection_status in ('connected', 'error', 'disconnected')),
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.google_calendar_oauth_states (
  state_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  redirect_uri text not null,
  app_return_url text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.google_calendar_event_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  app_event_id text not null,
  google_event_id text not null,
  google_recurring_event_id text,
  google_original_start_time timestamptz,
  google_etag text,
  last_google_start timestamptz,
  last_google_end timestamptz,
  app_updated_at bigint,
  payload_hash text,
  last_origin text not null default 'app' check (last_origin in ('app', 'google', 'reconcile')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, app_event_id),
  unique (user_id, google_event_id)
);

create table if not exists public.google_calendar_channels (
  channel_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  resource_id text not null,
  resource_uri text,
  channel_token_hash text not null,
  expires_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'expired', 'stopped', 'error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.google_calendar_sync_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  app_event_id text,
  google_event_id text,
  action text not null,
  origin text not null check (origin in ('app', 'google', 'system')),
  status text not null check (status in ('success', 'ignored', 'error')),
  cancelado_por text,
  cancelado_em timestamptz,
  origem_da_alteracao text not null,
  details jsonb not null default '{}'::jsonb,
  idempotency_key text,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create table if not exists public.google_calendar_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  student_id text,
  student_name text,
  app_event_id text,
  kind text not null check (kind in ('cancelled', 'rescheduled', 'declined', 'sync_error')),
  title text not null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists google_calendar_history_user_created_idx on public.google_calendar_sync_history(user_id, created_at desc);
create index if not exists google_calendar_notifications_user_unread_idx on public.google_calendar_notifications(user_id, read_at, created_at desc);
create index if not exists google_calendar_channels_renew_idx on public.google_calendar_channels(status, expires_at);

alter table public.google_calendar_connections enable row level security;
alter table public.google_calendar_oauth_states enable row level security;
alter table public.google_calendar_event_links enable row level security;
alter table public.google_calendar_channels enable row level security;
alter table public.google_calendar_sync_history enable row level security;
alter table public.google_calendar_notifications enable row level security;

revoke all on public.google_calendar_connections from anon, authenticated;
revoke all on public.google_calendar_oauth_states from anon, authenticated;
revoke all on public.google_calendar_event_links from anon, authenticated;
revoke all on public.google_calendar_channels from anon, authenticated;
revoke all on public.google_calendar_sync_history from anon, authenticated;
revoke all on public.google_calendar_notifications from anon, authenticated;

grant select, update (read_at) on public.google_calendar_notifications to authenticated;
grant select on public.google_calendar_sync_history to authenticated;

drop policy if exists "google_notifications_select_own" on public.google_calendar_notifications;
create policy "google_notifications_select_own" on public.google_calendar_notifications
for select to authenticated using (auth.uid() = user_id);

drop policy if exists "google_notifications_mark_own_read" on public.google_calendar_notifications;
create policy "google_notifications_mark_own_read" on public.google_calendar_notifications
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "google_history_select_own" on public.google_calendar_sync_history;
create policy "google_history_select_own" on public.google_calendar_sync_history
for select to authenticated using (auth.uid() = user_id);

commit;
