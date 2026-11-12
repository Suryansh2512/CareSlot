-- READ ONLY. Optional hosted catalog verification in Supabase SQL Editor.
-- No seed reset, DDL or appointment writes.
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in
  ('departments', 'doctors', 'slots', 'patients', 'appointments')
order by c.relname;

select p.proname, pg_get_function_identity_arguments(p.oid) as arguments,
       p.prosecdef as security_definer, p.proconfig as settings,
       has_function_privilege('anon', p.oid, 'execute') as anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can_execute,
       has_function_privilege('service_role', p.oid, 'execute') as service_role_can_execute,
       exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
               where a.grantee = 0 and a.privilege_type = 'EXECUTE') as public_can_execute
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in
  ('careslot_book', 'careslot_reschedule', 'careslot_cancel')
order by p.proname;

select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid) as definition
from pg_constraint where conrelid in ('public.slots'::regclass, 'public.appointments'::regclass)
order by conrelid::regclass::text, conname;

select tablename, indexname, indexdef from pg_indexes
where schemaname = 'public' and tablename in ('slots', 'appointments')
order by tablename, indexname;

select 'departments' as table_name, count(*) from public.departments
union all select 'doctors', count(*) from public.doctors
union all select 'slots', count(*) from public.slots
union all select 'patients', count(*) from public.patients
union all select 'appointments', count(*) from public.appointments;

-- These booked slots are intentional seed occupancy; never free them automatically.
select count(*) as booked_slots_without_appointment
from public.slots s where s.is_booked
and not exists (select 1 from public.appointments a where a.slot_id = s.id and a.status <> 'cancelled');
