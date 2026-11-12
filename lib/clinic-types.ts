import type { ClinicAction } from "./schemas";
export type Department = { id: string; name: string; common_issues: string };
export type Doctor = {
  id: string; name: string; department_id: string; qualification: string;
  experience_years: number; consultation_fee: number; languages: string[]; room: string;
  department: Department;
};
export type Slot = { id: number; doctor_id: string; slot_date: string; start_time: string; is_booked: boolean };
export type Appointment = {
  id: number; doctor_id: string; slot_id: number; reason: string | null;
  status: "booked" | "cancelled" | "completed"; created_at: string;
  doctor: Doctor; slot: Slot;
};
export type Confirmation = {
  requires_confirmation: true; changed: false; token: string; action: ClinicAction;
  title: string; doctor: string; department: string; date: string; time: string; room: string;
  fee: number; appointment_id?: number; previous_date?: string; previous_time?: string;
};
export type MutationResult = { changed: boolean; appointment: { id: number; slot_id: number; doctor_id: string; status: string }; released_slot_id?: number };
