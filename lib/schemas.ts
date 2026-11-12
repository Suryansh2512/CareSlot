import { z } from "zod";

export const isoDate = z.iso.date().describe("A real calendar date, YYYY-MM-DD, in Asia/Kolkata clinic time");
export const recordId = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const doctorId = z.string().regex(/^DR\d{2}$/).describe("An actual doctor ID returned by searchDoctors, e.g. DR03");
export const statusSchema = z.enum(["booked", "cancelled", "completed"]);
export const doctorSearchSchema = z.strictObject({
  query: z.string().trim().max(100).optional().describe("Doctor name, department, specialty or common issue; omit to discover departments"),
  department_id: z.string().regex(/^D\d{2}$/).optional().describe("Actual department ID returned by searchDoctors"),
  language: z.string().trim().min(1).max(40).optional().describe("Spoken language, e.g. Tamil"),
});
export const slotSearchSchema = z.strictObject({
  doctor_id: doctorId,
  date: isoDate.optional().describe("Exact preferred clinic date; omit to find the next free slots"),
  from_date: isoDate.optional(), to_date: isoDate.optional(),
});
export const appointmentSearchSchema = z.strictObject({ status: statusSchema.optional() });
export const bookSchema = z.strictObject({
  slot_id: recordId.describe("Available slot ID returned by getAvailableSlots"),
  reason: z.string().trim().min(1).max(500).optional().describe("Patient's stated reason; do not infer a diagnosis"),
});
export const rescheduleSchema = z.strictObject({
  appointment_id: recordId.describe("P001 appointment ID returned by getMyAppointments"),
  slot_id: recordId.describe("Target available slot ID returned by getAvailableSlots"),
});
export const cancelSchema = z.strictObject({ appointment_id: recordId.describe("P001 appointment ID returned by getMyAppointments") });
export const actionSchema = z.discriminatedUnion("kind", [
  bookSchema.extend({ kind: z.literal("book") }), rescheduleSchema.extend({ kind: z.literal("reschedule") }), cancelSchema.extend({ kind: z.literal("cancel") }),
]);
export type ClinicAction = z.infer<typeof actionSchema>;
export const actionRequestSchema = z.strictObject({ action: actionSchema, confirmation: z.string().max(5000).optional() });
export const chatMessageSchema = z.strictObject({ role: z.enum(["user", "model"]), text: z.string().trim().min(1).max(4000) });
export const agentRequestSchema = z.strictObject({
  messages: z.array(chatMessageSchema).min(1).max(30).refine(m => m.at(-1)?.role === "user", "Last message must be from the user"),
  confirmation: z.string().max(5000).optional(),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;
