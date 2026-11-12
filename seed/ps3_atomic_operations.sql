-- CareSlot migration. Run AFTER the unmodified ps3_clinic_appointments.sql.
-- Reapply after any seed reset. No new columns, no occupancy reconstruction.
begin;

create unique index if not exists appointments_one_occupant_per_slot
  on public.appointments(slot_id) where status <> 'cancelled';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'slots_id_doctor_key'
                 and conrelid = 'public.slots'::regclass) then
    alter table public.slots add constraint slots_id_doctor_key unique(id, doctor_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'appointments_slot_doctor_fk'
                 and conrelid = 'public.appointments'::regclass) then
    alter table public.appointments add constraint appointments_slot_doctor_fk
      foreign key(slot_id, doctor_id) references public.slots(id, doctor_id);
  end if;
end $$;

create index if not exists appointments_patient_created_idx
  on public.appointments(patient_id, created_at desc);

-- All RPCs deliberately bind to P001. No caller-controlled patient parameter.
-- INVOKER functions run only with server service_role privileges.
create or replace function public.careslot_book(p_slot_id bigint, p_reason text default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare s public.slots%rowtype; a public.appointments%rowtype;
begin
  select * into s from public.slots where id = p_slot_id for update;
  if not found then raise exception using message = 'Slot not found.', errcode = 'P0002'; end if;
  if (s.slot_date + s.start_time) at time zone 'Asia/Kolkata' <= clock_timestamp() then
    raise exception 'Choose a future slot.';
  end if;
  if s.is_booked then raise exception 'This slot is already booked. Choose another slot.'; end if;
  if length(coalesce(p_reason, '')) > 500 then raise exception 'Reason must be at most 500 characters.'; end if;
  update public.slots set is_booked = true where id = s.id;
  insert into public.appointments(patient_id, doctor_id, slot_id, reason)
    values ('P001', s.doctor_id, s.id, nullif(btrim(p_reason), '')) returning * into a;
  return jsonb_build_object('changed', true, 'appointment', to_jsonb(a));
end $$;

create or replace function public.careslot_reschedule(
  p_appointment_id bigint, p_slot_id bigint, p_expected_slot_id bigint)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare a public.appointments%rowtype; target public.slots%rowtype; old_slot bigint;
begin
  select * into a from public.appointments
    where id = p_appointment_id and patient_id = 'P001' for update;
  if not found then raise exception using message = 'Appointment not found.', errcode = 'P0002'; end if;
  if a.status <> 'booked' then raise exception 'Only booked appointments can be rescheduled.'; end if;
  if a.slot_id = p_slot_id then
    return jsonb_build_object('changed', false, 'appointment', to_jsonb(a));
  end if;
  if p_expected_slot_id is null or a.slot_id <> p_expected_slot_id then
    raise exception 'This appointment changed. Review it again before rescheduling.';
  end if;
  old_slot := a.slot_id;
  -- All operations that hold an appointment lock acquire slots in ascending order.
  perform id from public.slots where id in (old_slot, p_slot_id) order by id for update;
  select * into target from public.slots where id = p_slot_id;
  if not found then raise exception using message = 'Slot not found.', errcode = 'P0002'; end if;
  if (target.slot_date + target.start_time) at time zone 'Asia/Kolkata' <= clock_timestamp() then
    raise exception 'Choose a future slot.';
  end if;
  if target.is_booked then raise exception 'This slot is already booked. Your original booking is unchanged.'; end if;
  update public.slots set is_booked = true where id = target.id;
  update public.appointments set slot_id = target.id, doctor_id = target.doctor_id
    where id = a.id returning * into a;
  update public.slots set is_booked = false where id = old_slot;
  return jsonb_build_object('changed', true, 'appointment', to_jsonb(a), 'released_slot_id', old_slot);
end $$;

create or replace function public.careslot_cancel(p_appointment_id bigint)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare a public.appointments%rowtype;
begin
  select * into a from public.appointments
    where id = p_appointment_id and patient_id = 'P001' for update;
  if not found then raise exception using message = 'Appointment not found.', errcode = 'P0002'; end if;
  if a.status = 'cancelled' then
    -- Do not touch its old slot: it may now belong to a different appointment.
    return jsonb_build_object('changed', false, 'appointment', to_jsonb(a));
  end if;
  if a.status <> 'booked' then raise exception 'Completed appointments cannot be cancelled.'; end if;
  perform id from public.slots where id = a.slot_id for update;
  update public.appointments set status = 'cancelled' where id = a.id returning * into a;
  update public.slots set is_booked = false where id = a.slot_id;
  return jsonb_build_object('changed', true, 'appointment', to_jsonb(a));
end $$;

revoke all on function public.careslot_book(bigint, text) from public, anon, authenticated;
revoke all on function public.careslot_reschedule(bigint, bigint, bigint) from public, anon, authenticated;
revoke all on function public.careslot_cancel(bigint) from public, anon, authenticated;
grant execute on function public.careslot_book(bigint, text) to service_role;
grant execute on function public.careslot_reschedule(bigint, bigint, bigint) to service_role;
grant execute on function public.careslot_cancel(bigint) to service_role;

-- The official seed already enables RLS without public policies; retain it.
notify pgrst, 'reload schema';
commit;
