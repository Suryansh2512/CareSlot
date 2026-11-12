import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import { getSupabase } from "./supabase";
import { CURRENT_USER_ID } from "./currentUser";
import { isFutureSlot, todayInIndia } from "./dates";
import { ClinicError } from "./errors";
import { readConfirmation, sameAction, signConfirmation } from "./confirmation";
import { doctorSearchSchema, slotSearchSchema, type ClinicAction } from "./schemas";
import type { Appointment, Confirmation, Department, Doctor, MutationResult, Slot } from "./clinic-types";
const doctorColumns = "id,name,department_id,qualification,experience_years,consultation_fee,languages,room,department:departments(id,name,common_issues)";
const slotColumns = "id,doctor_id,slot_date,start_time,is_booked";
const appointmentColumns = `id,doctor_id,slot_id,reason,status,created_at,doctor:doctors!appointments_doctor_id_fkey(${doctorColumns}),slot:slots!appointments_slot_id_fkey(${slotColumns})`;
function one<T>(value: T | T[]): T { return Array.isArray(value) ? value[0] : value; }
function normalizeDoctor(raw: Doctor): Doctor { return { ...raw, department: one(raw.department) }; }
function normalizeAppointment(raw: Appointment): Appointment { return { ...raw, doctor: normalizeDoctor(one(raw.doctor)), slot: one(raw.slot) }; }
function dbFailure(error: { code?: string } | null) {
  if (error) {
    console.error("[clinic database]", error.code ?? "query_failed");
    throw new ClinicError("Clinic data could not be loaded. Check Supabase setup and migrations.", 503);
  }
}
export function createClinicService(db: SupabaseClient = getSupabase()) {
  async function searchDoctors(input: z.infer<typeof doctorSearchSchema> = {}, limit = 20) {
    const filters = doctorSearchSchema.parse(input);
    const [doctorsResult, departmentsResult] = await Promise.all([
      db.from("doctors").select(doctorColumns).order("name").limit(50),
      db.from("departments").select("id,name,common_issues").order("name").limit(50),
    ]);
    dbFailure(doctorsResult.error); dbFailure(departmentsResult.error);
    const q = filters.query?.toLocaleLowerCase();
    const doctors = (doctorsResult.data as unknown as Doctor[]).map(normalizeDoctor).filter(d =>
      (!filters.department_id || d.department_id === filters.department_id) &&
      (!filters.language || d.languages.some(l => l.toLowerCase() === filters.language!.toLowerCase())) &&
      (!q || `${d.name} ${d.department.name} ${d.department.common_issues} ${d.qualification} ${d.languages.join(" ")}`.toLowerCase().includes(q))
    ).slice(0, limit);
    return { doctors, departments: departmentsResult.data as Department[], count: doctors.length };
  }
  async function getAvailableSlots(input: z.infer<typeof slotSearchSchema>, limit = 20) {
    const filters = slotSearchSchema.parse(input);
    const from = filters.date ?? filters.from_date ?? todayInIndia(), to = filters.date ?? filters.to_date;
    if (to && to < from) throw new ClinicError("The end date must be on or after the start date.");
    let query = db.from("slots").select(slotColumns).eq("doctor_id", filters.doctor_id)
      .eq("is_booked", false).gte("slot_date", from).order("slot_date").order("start_time").limit(200);
    if (to) query = query.lte("slot_date", to);
    const { data, error } = await query; dbFailure(error);
    const slots = (data as Slot[]).filter(s => isFutureSlot(s)).slice(0, limit);
    return { slots, count: slots.length, timezone: "Asia/Kolkata" };
  }
  async function getMyAppointments(status?: Appointment["status"], limit = 20) {
    let query = db.from("appointments").select(appointmentColumns).eq("patient_id", CURRENT_USER_ID)
      .order("created_at", { ascending: false }).limit(limit);
    if (status) query = query.eq("status", status);
    const { data, error } = await query; dbFailure(error);
    return { appointments: (data as unknown as Appointment[]).map(normalizeAppointment), timezone: "Asia/Kolkata" };
  }
  async function ownedAppointment(id: number) {
    const { data, error } = await db.from("appointments").select(appointmentColumns).eq("id", id).eq("patient_id", CURRENT_USER_ID).maybeSingle();
    dbFailure(error);
    if (!data) throw new ClinicError("Appointment not found.", 404);
    return normalizeAppointment(data as unknown as Appointment);
  }
  async function prepareAction(action: ClinicAction): Promise<Confirmation> {
    let appointment: Appointment | undefined;
    if (action.kind !== "book") appointment = await ownedAppointment(action.appointment_id);
    if (appointment && appointment.status !== "booked") throw new ClinicError("Only booked appointments can be changed.", 409);
    let slot: Slot, doctor: Doctor;
    if (action.kind === "cancel") { slot = appointment!.slot; doctor = appointment!.doctor; }
    else {
      const result = await db.from("slots").select(slotColumns).eq("id", action.slot_id).maybeSingle(); dbFailure(result.error);
      if (!result.data) throw new ClinicError("Slot not found.", 404);
      slot = result.data as Slot;
      if (!isFutureSlot(slot)) throw new ClinicError("Choose a future slot.", 409);
      if (slot.is_booked && appointment?.slot_id !== slot.id) throw new ClinicError("This slot is already booked. Choose another slot.", 409);
      const resultDoctor = await db.from("doctors").select(doctorColumns).eq("id", slot.doctor_id).single(); dbFailure(resultDoctor.error);
      doctor = normalizeDoctor(resultDoctor.data as unknown as Doctor);
    }
    return {
      requires_confirmation: true, changed: false, action, token: signConfirmation(action, appointment?.slot_id),
      title: action.kind === "book" ? "Confirm your appointment" : action.kind === "cancel" ? "Cancel this appointment?" : "Confirm your new appointment time",
      doctor: doctor.name, department: doctor.department.name, date: slot.slot_date, time: slot.start_time, room: doctor.room, fee: doctor.consultation_fee,
      ...(appointment ? { appointment_id: appointment.id } : {}),
      ...(action.kind === "reschedule" ? { previous_date: appointment!.slot.slot_date, previous_time: appointment!.slot.start_time } : {}),
    };
  }
  async function executeAction(action: ClinicAction, token: string): Promise<MutationResult> {
    const payload = readConfirmation(token);
    if (!sameAction(payload.action, action)) throw new ClinicError("The requested change does not match your confirmation.", 409);
    const name = action.kind === "book" ? "careslot_book" : action.kind === "cancel" ? "careslot_cancel" : "careslot_reschedule";
    const args = action.kind === "book" ? { p_slot_id: action.slot_id, p_reason: action.reason ?? null }
      : action.kind === "cancel" ? { p_appointment_id: action.appointment_id }
      : { p_appointment_id: action.appointment_id, p_slot_id: action.slot_id, p_expected_slot_id: payload.expected_slot_id };
    const { data, error } = await db.rpc(name, args);
    if (error) {
      if (error.code === "P0002") throw new ClinicError(error.message, 404);
      if (error.code === "P0001") throw new ClinicError(error.message, 409);
      if (error.code === "23505") throw new ClinicError("This slot is already booked. Choose another slot.", 409);
      if (error.code === "40P01" || error.code === "40001") throw new ClinicError("Another request changed availability. Refresh and try again.", 409);
      dbFailure(error);
    }
    if (!data?.appointment?.id) throw new ClinicError("The database did not confirm this change. Refresh your appointments before retrying.", 503);
    return data as MutationResult;
  }
  return { searchDoctors, getAvailableSlots, getMyAppointments, prepareAction, executeAction };
}
