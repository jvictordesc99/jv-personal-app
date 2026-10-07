begin;

-- Only the owner-authenticated provisioning endpoint may populate this catalog.
-- Never backfill identities automatically from profiles or anonymous app_state.
create table public.cancellation_students (
  student_id text primary key,
  auth_user_id uuid not null unique references auth.users(id),
  owner_id uuid not null references auth.users(id),
  student_name text not null,
  active boolean not null default true
);
create table public.cancellation_packages (
  id text primary key,
  student_id text not null references public.cancellation_students(student_id),
  name text not null,
  total integer not null check (total > 0),
  active boolean not null default true
);
create table public.cancellation_lessons (
  package_id text not null references public.cancellation_packages(id),
  date_key date not null,
  starts_at timestamptz not null,
  duration integer not null check (duration > 0),
  app_event_id text not null unique,
  recorded boolean not null default false,
  consumed boolean not null default false,
  active boolean not null default true,
  primary key (package_id, date_key)
);
create table public.lesson_cancellations (
  id uuid primary key default gen_random_uuid(),
  package_id text not null,
  date_key date not null,
  student_id text not null,
  user_id uuid not null,
  owner_id uuid not null,
  request_id uuid not null,
  received_at timestamptz not null,
  generated boolean not null,
  checkin jsonb not null,
  credit jsonb,
  event jsonb not null,
  unique (package_id, date_key),
  unique (user_id, request_id),
  foreign key (package_id, date_key) references public.cancellation_lessons(package_id, date_key)
);
create table public.calendar_cancellation_jobs (
  id uuid primary key default gen_random_uuid(),
  cancellation_id uuid not null unique references public.lesson_cancellations(id),
  status text not null default 'pending' check (status in ('pending','processing','done','failed')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  lease_until timestamptz,
  lease_token uuid,
  last_error text,
  completed_at timestamptz
);
create unique index lesson_cancellations_event on public.lesson_cancellations(owner_id, (event->>'id'));
create index calendar_cancellation_jobs_due on public.calendar_cancellation_jobs(status, available_at);

-- A Google create already in flight can finish after cancellation found no link.
-- Requeue on link creation/update, invalidating any older worker acknowledgement.
create function public.requeue_linked_cancellation() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.deleted_at is null then
    update public.calendar_cancellation_jobs j set status='pending', attempts=0,
      available_at=now(),lease_until=null,lease_token=null,completed_at=null
    from public.lesson_cancellations c where j.cancellation_id=c.id
      and c.owner_id=new.user_id and c.event->>'id'=new.app_event_id;
  end if;
  return new;
end;
$$;
create trigger requeue_official_calendar_cancellation after insert or update on public.google_calendar_event_links
for each row execute function public.requeue_linked_cancellation();
revoke all on function public.requeue_linked_cancellation() from public,anon,authenticated;

alter table public.cancellation_students enable row level security;
alter table public.cancellation_packages enable row level security;
alter table public.cancellation_lessons enable row level security;
alter table public.lesson_cancellations enable row level security;
alter table public.calendar_cancellation_jobs enable row level security;
revoke all on public.cancellation_students, public.cancellation_packages, public.cancellation_lessons,
  public.lesson_cancellations, public.calendar_cancellation_jobs from public, anon, authenticated;
grant all on public.cancellation_students, public.cancellation_packages, public.cancellation_lessons,
  public.lesson_cancellations, public.calendar_cancellation_jobs to service_role;

-- Replace only records belonging to an official cancellation. Other modules survive.
-- The immutable credit is the issuance receipt; existing redemption workflow fields
-- remain editable in the projection, but cannot change the grant, owner or expiry.
create function public.project_official_cancellations() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c record; doc jsonb; items jsonb; projected_credit jsonb; workflow jsonb;
begin
  if old.id = 'main' and (tg_op = 'DELETE' or new.id <> 'main') then
    if exists (select 1 from public.lesson_cancellations) then
      raise exception 'Official cancellations prevent removal of app_state/main';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  if new.id <> 'main' then return new; end if;
  doc := new.data::jsonb;
  if doc is null or jsonb_typeof(doc) <> 'object' then
    raise exception 'app_state/main must remain a JSON object';
  end if;
  for c in select * from public.lesson_cancellations loop
    select coalesce(jsonb_agg(x), '[]') into items from jsonb_array_elements(coalesce(doc->'checkins','[]')) x
      where coalesce(x->>'id','') <> c.checkin->>'id'
        and (x->>'packageId' = c.package_id and x->>'dateKey' = c.date_key::text and coalesce(x->>'lessonType','package') = 'package') is not true;
    doc := jsonb_set(doc, '{checkins}', items || jsonb_build_array(c.checkin));
    select coalesce(jsonb_agg(x), '[]') into items from jsonb_array_elements(coalesce(doc->'agendaEvents','[]')) x
      where coalesce(x->>'id','') <> c.event->>'id'
        and (x->>'packageId' = c.package_id and x->>'dateKey' = c.date_key::text and coalesce(x->>'type','package') = 'package') is not true;
    doc := jsonb_set(doc, '{agendaEvents}', items || jsonb_build_array(c.event));
    if c.credit is not null then
      select x into projected_credit from jsonb_array_elements(coalesce(doc->'makeupCredits','[]')) x where x->>'id' = c.credit->>'id' limit 1;
      if projected_credit is null then
        select x into projected_credit from jsonb_array_elements(coalesce(old.data::jsonb->'makeupCredits','[]')) x where x->>'id' = c.credit->>'id' limit 1;
      end if;
      select coalesce(jsonb_object_agg(key,value),'{}') into workflow from jsonb_each(coalesce(projected_credit,'{}'))
        where key in ('status','usedAt','requestedAt','approvedAt','rejectedAt','expiredAt','replacementDate','replacementTime','note','personalNote');
      select coalesce(jsonb_agg(x),'[]') into items from jsonb_array_elements(coalesce(doc->'makeupCredits','[]')) x
        where coalesce(x->>'id','') <> c.credit->>'id' and coalesce(x->>'sourceCheckinId','') <> c.checkin->>'id';
      doc := jsonb_set(doc, '{makeupCredits}', items || jsonb_build_array(c.credit || workflow));
    else
      select coalesce(jsonb_agg(x),'[]') into items from jsonb_array_elements(coalesce(doc->'makeupCredits','[]')) x
        where coalesce(x->>'sourceCheckinId','') <> c.checkin->>'id' and coalesce(x->>'officialCancellationId','') <> c.id::text;
      doc := jsonb_set(doc, '{makeupCredits}', items);
    end if;
    select coalesce(jsonb_agg(x),'[]') into items from jsonb_array_elements(coalesce(doc->'deletionTombstones','[]')) x
      where coalesce(x->>'itemId',x->>'id','') not in (c.checkin->>'id', c.event->>'id', coalesce(c.credit->>'id',''));
    doc := jsonb_set(doc, '{deletionTombstones}', items);
  end loop;
  new.data := doc;
  return new;
end;
$$;
create trigger preserve_official_cancellations before insert or update or delete on public.app_state
for each row execute function public.project_official_cancellations();
revoke truncate on public.app_state from anon,authenticated;
revoke all on function public.project_official_cancellations() from public, anon, authenticated;

-- Provisioning is an explicit, reviewed action by the configured owner. Service-only.
create function public.publish_cancellation_catalog(owner_user uuid, catalog jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare s jsonb; p jsonb; l jsonb;
begin
  -- Same lock order as cancellation; serializes catalog replacement and legacy CAS.
  perform 1 from public.app_state where id = 'main' for update;
  if not found then raise exception 'app_state/main missing'; end if;
  update public.cancellation_students set active = false where owner_id = owner_user;
  update public.cancellation_packages set active = false where student_id in (select student_id from public.cancellation_students where owner_id = owner_user);
  update public.cancellation_lessons set active = false where package_id in (select id from public.cancellation_packages where student_id in (select student_id from public.cancellation_students where owner_id = owner_user));
  for s in select * from jsonb_array_elements(catalog->'students') loop
    if exists (select 1 from public.cancellation_students where student_id = s->>'id' and (owner_id <> owner_user or auth_user_id <> (s->>'authUserId')::uuid)) then
      raise exception 'Existing student identity cannot be reassigned by catalog publication';
    end if;
    insert into public.cancellation_students values (s->>'id',(s->>'authUserId')::uuid,owner_user,s->>'name',true)
    on conflict (student_id) do update set student_name = excluded.student_name, active = true;
  end loop;
  for p in select * from jsonb_array_elements(catalog->'packages') loop
    if not exists (select 1 from public.cancellation_students where student_id = p->>'studentId' and owner_id = owner_user and active) then raise exception 'Unbound student'; end if;
    if exists (select 1 from public.cancellation_packages where id = p->>'id' and student_id <> p->>'studentId') then raise exception 'Package cannot be reassigned'; end if;
    insert into public.cancellation_packages values(p->>'id',p->>'studentId',p->>'name',(p->>'total')::integer,true)
    on conflict (id) do update set name=excluded.name,total=excluded.total,active=true;
    for l in select * from jsonb_array_elements(p->'lessons') loop
      insert into public.cancellation_lessons values(p->>'id',(l->>'dateKey')::date,(l->>'startsAt')::timestamptz,(l->>'duration')::integer,l->>'eventId',coalesce((l->>'recorded')::boolean,false),coalesce((l->>'consumed')::boolean,false),true)
      on conflict (package_id,date_key) do update set starts_at=excluded.starts_at,duration=excluded.duration,
        app_event_id=excluded.app_event_id,recorded=excluded.recorded,consumed=excluded.consumed,active=true
      where not exists (select 1 from public.lesson_cancellations c where c.package_id=excluded.package_id and c.date_key=excluded.date_key);
    end loop;
  end loop;
end;
$$;
revoke all on function public.publish_cancellation_catalog(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.publish_cancellation_catalog(uuid,jsonb) to service_role;

create function public.cancel_my_lesson(target_package text, target_date date, request_key uuid, expected_time text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); received timestamptz := statement_timestamp();
  p record; s record; l record; c public.lesson_cancellations; doc jsonb;
  generated boolean; stamp bigint; cid uuid := gen_random_uuid(); credit_id uuid := gen_random_uuid();
  checkin jsonb; credit jsonb; event jsonb; used integer; label text; day_text text; time_text text;
begin
  if actor is null or request_key is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select data::jsonb into doc from public.app_state where id='main' for update;
  if not found then raise exception 'app_state/main missing'; end if;
  select * into p from public.cancellation_packages where id=target_package and active;
  select * into s from public.cancellation_students where student_id=p.student_id and auth_user_id=actor and active;
  if s.student_id is null then raise exception 'Lesson not authorized' using errcode='42501'; end if;
  select * into c from public.lesson_cancellations where user_id=actor and request_id=request_key;
  if found and (c.package_id <> target_package or c.date_key <> target_date) then raise exception 'Idempotency key reused for another lesson'; end if;
  select * into c from public.lesson_cancellations where package_id=target_package and date_key=target_date;
  if found then
    -- Replaying a receipt must not turn an already requested/used credit back
    -- into an available one in the browser cache.
    if c.credit is not null then
      select x into credit from jsonb_array_elements(coalesce(doc->'makeupCredits','[]')) x where x->>'id'=c.credit->>'id' limit 1;
    end if;
    return jsonb_build_object('ok',true,'cancellationId',c.id,'generated',c.generated,'credit',coalesce(credit,c.credit),'checkin',c.checkin,'event',c.event,'duplicate',true);
  end if;
  select * into l from public.cancellation_lessons where package_id=target_package and date_key=target_date and active;
  if not found then raise exception 'Lesson unavailable'; end if;
  if expected_time is not null and expected_time <> to_char(l.starts_at at time zone 'America/Sao_Paulo','HH24:MI') then
    raise exception 'Horario alterado. Peça ao personal para revisar e publicar o cadastro de aulas';
  end if;
  if l.recorded or exists(select 1 from jsonb_array_elements(coalesce(doc->'checkins','[]')) x where x->>'packageId'=target_package and x->>'dateKey'=target_date::text and coalesce(x->>'lessonType','package')='package') then
    raise exception 'Esta aula ja possui registro';
  end if;
  generated := l.starts_at - received > interval '2 hours';
  select count(*) into used from public.cancellation_lessons x where x.package_id=target_package and
    (x.consumed or exists(select 1 from public.lesson_cancellations y where y.package_id=x.package_id and y.date_key=x.date_key and not y.generated));
  -- Legacy attendance may have advanced since the owner published the catalog.
  used := greatest(used, (select count(*) from jsonb_array_elements(coalesce(doc->'checkins','[]')) x where x->>'packageId'=target_package and coalesce(x->>'lessonType','package') not in ('makeup','dropin') and (x->>'consumed'='true' or x->>'status' in ('realizado','aula-dada','cancelada-fora-prazo','falta'))));
  if not generated and used >= p.total then raise exception 'Pacote sem saldo para contabilizar cancelamento'; end if;
  stamp := floor(extract(epoch from received)*1000);
  label := case when generated then 'Cancelada no prazo' else 'Cancelada fora do prazo - aula contabilizada' end;
  day_text := to_char(target_date,'DD/MM/YYYY'); time_text := to_char(l.starts_at at time zone 'America/Sao_Paulo','HH24:MI');
  checkin := jsonb_build_object('id',cid,'studentId',s.student_id,'studentName',s.student_name,'packageId',p.id,'packageName',p.name,'date',day_text,'dateKey',target_date,'time',time_text,'type','cancelamento de aula','lessonType','package','status',case when generated then 'cancelada-no-prazo' else 'cancelada-fora-prazo' end,'statusLabel',label,'consumed',not generated,'generatedMakeup',generated,'makeupValidUntil',case when generated then to_char(target_date+10,'DD/MM/YYYY') else '' end,'markedBy','aluno','month',to_char(received at time zone 'America/Sao_Paulo','YYYY-MM'),'timestamp',stamp,'cancellationDate',to_char(received at time zone 'America/Sao_Paulo','DD/MM/YYYY'),'cancellationTime',to_char(received at time zone 'America/Sao_Paulo','HH24:MI'),'origem_da_alteracao','aplicativo_aluno');
  if generated then credit := jsonb_build_object('id',credit_id,'studentId',s.student_id,'studentName',s.student_name,'packageId',p.id,'packageName',p.name,'sourceLessonDate',day_text,'lessonTime',time_text,'noticeDate',checkin->>'cancellationDate','noticeTime',checkin->>'cancellationTime','validUntil',to_char(target_date+10,'DD/MM/YYYY'),'status','available','generated',true,'sourceCheckinId',cid,'reason','Cancelamento do aluno dentro do prazo.','timestamp',stamp,'createdAt',stamp); end if;
  select x into event from jsonb_array_elements(coalesce(doc->'agendaEvents','[]')) x where x->>'id'=l.app_event_id limit 1;
  event := coalesce(event,'{}') || jsonb_build_object('id',l.app_event_id,'studentId',s.student_id,'studentName',s.student_name,'packageId',p.id,'date',day_text,'dateKey',target_date,'time',time_text,'duration',l.duration,'type','package','modality',p.name,'status',label,'cancelado_por',s.student_name,'cancelado_em',received,'origem_da_alteracao','aplicativo_aluno','updatedAt',stamp,'createdAt',stamp);
  checkin := checkin || jsonb_build_object('officialCancellationId',cid,'reason',case when generated then 'Cancelamento dentro do prazo. Reposicao gerada.' else 'Fora do prazo minimo de 2 horas.' end);
  event := event || jsonb_build_object('officialCancellationId',cid);
  if credit is not null then credit := credit || jsonb_build_object('officialCancellationId',cid); end if;
  insert into public.lesson_cancellations(id,package_id,date_key,student_id,user_id,owner_id,request_id,received_at,generated,checkin,credit,event)
    values(cid,p.id,target_date,s.student_id,actor,s.owner_id,request_key,received,generated,checkin,credit,event);
  insert into public.calendar_cancellation_jobs(cancellation_id) values(cid);
  -- Trigger projects the committed receipt while preserving unrelated data.
  update public.app_state set data=doc,updated_at=clock_timestamp() where id='main';
  return jsonb_build_object('ok',true,'cancellationId',cid,'generated',generated,'credit',credit,'checkin',checkin,'event',event,'duplicate',false);
end;
$$;
revoke all on function public.cancel_my_lesson(text,date,uuid,text) from public,anon;
grant execute on function public.cancel_my_lesson(text,date,uuid,text) to authenticated;

create function public.claim_calendar_cancellations(batch_size integer default 10) returns jsonb
language plpgsql security definer set search_path='' as $$
declare jobs jsonb;
begin
  update public.calendar_cancellation_jobs set status='failed',last_error='Retry limit reached'
    where attempts >= 8 and (status='pending' or (status='processing' and lease_until < now()));
  with due as (
    select id from public.calendar_cancellation_jobs where attempts < 8 and
      ((status='pending' and available_at <= now()) or (status='processing' and lease_until < now()))
    order by available_at for update skip locked limit least(greatest(batch_size,1),20)
  ), claimed as (
    update public.calendar_cancellation_jobs j set status='processing',attempts=attempts+1,
      lease_until=now()+interval '5 minutes',lease_token=gen_random_uuid() from due where j.id=due.id returning j.*
  ) select coalesce(jsonb_agg(to_jsonb(j) || jsonb_build_object('cancellation',to_jsonb(c))),'[]') into jobs
    from claimed j join public.lesson_cancellations c on c.id=j.cancellation_id;
  return jobs;
end;
$$;
create function public.finish_calendar_cancellation(job_id uuid, token uuid, succeeded boolean, failure text default null, retry_seconds integer default 60, permanent boolean default false) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  update public.calendar_cancellation_jobs set
    status=case when succeeded then 'done' when permanent or attempts>=8 then 'failed' else 'pending' end,
    completed_at=case when succeeded then now() else null end,
    last_error=left(failure,300),available_at=now()+make_interval(secs=>least(greatest(retry_seconds,1),86400)),lease_until=null,lease_token=null
    where id=job_id and lease_token=token and status='processing';
  return found;
end;
$$;
revoke all on function public.claim_calendar_cancellations(integer), public.finish_calendar_cancellation(uuid,uuid,boolean,text,integer,boolean) from public,anon,authenticated;
grant execute on function public.claim_calendar_cancellations(integer), public.finish_calendar_cancellation(uuid,uuid,boolean,text,integer,boolean) to service_role;
commit;
