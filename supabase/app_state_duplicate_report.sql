-- Relatorio somente leitura. Nao altera nem exclui dados.
with students as (
  select
    student,
    student ->> 'id' as id,
    nullif(coalesce(student ->> 'auth_user_id', student ->> 'authUserId', student ->> 'supabaseUserId'), '') as auth_user_id,
    nullif(lower(coalesce(student ->> 'email_login', student ->> 'email')), '') as email,
    student ->> 'name' as name
  from public.app_state state
  cross join lateral jsonb_array_elements(coalesce(state.data -> 'students', '[]'::jsonb)) student
  where state.id = 'main'
), duplicate_ids as (
  select 'id' as duplicate_type, id as duplicate_key, count(*) as occurrences,
         jsonb_agg(jsonb_build_object('id', id, 'name', name, 'email', email, 'auth_user_id', auth_user_id)) as records
  from students where id is not null and id <> ''
  group by id having count(*) > 1
), duplicate_auth_ids as (
  select 'auth_user_id', auth_user_id, count(*),
         jsonb_agg(jsonb_build_object('id', id, 'name', name, 'email', email, 'auth_user_id', auth_user_id))
  from students where auth_user_id is not null
  group by auth_user_id having count(*) > 1
), duplicate_emails as (
  select 'email', email, count(*),
         jsonb_agg(jsonb_build_object('id', id, 'name', name, 'email', email, 'auth_user_id', auth_user_id))
  from students where email is not null
  group by email having count(*) > 1
)
select * from duplicate_ids
union all select * from duplicate_auth_ids
union all select * from duplicate_emails
order by duplicate_type, duplicate_key;

-- Revisao manual por nome. Nome nunca deve ser usado para exclusao/mesclagem automatica.
select student ->> 'name' as display_name,
       count(*) as occurrences,
       jsonb_agg(student -> 'id') as ids
from public.app_state state
cross join lateral jsonb_array_elements(coalesce(state.data -> 'students', '[]'::jsonb)) student
where state.id = 'main'
group by student ->> 'name'
having count(*) > 1
order by occurrences desc, display_name;
